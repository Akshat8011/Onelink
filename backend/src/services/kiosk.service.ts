import { v4 as uuidv4 } from 'uuid';
import { User } from '../models/User.js';
import { KioskCart, IKioskCart } from '../models/KioskCart.js';
import { MetroTicket } from '../models/MetroTicket.js';
import { ParkingReceipt } from '../models/ParkingReceipt.js';
import { ParkingSpot } from '../models/ParkingSpot.js';
import { TransitService } from './transit.service.js';
import { ParkingService } from './parking.service.js';
import { WalletService } from './wallet.service.js';
import { emitToUser, emitBroadcast } from '../utils/realtime.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { runInTransaction } from '../utils/db-transaction.js';
import { withIdempotency } from '../utils/idempotency.js';
import { cardUidQuery } from '../utils/cardUid.js';
import { METRO_STATIONS, metroStationIndex } from '../utils/metroStations.js';

export { METRO_STATIONS };

function stationIndex(name: string): number {
  return metroStationIndex(name);
}

export function calculateSlabFare(from: string, to: string): number {
  const a = stationIndex(from);
  const b = stationIndex(to);
  if (a === -1 || b === -1) return env.METRO_BASE_FARE;
  const travel = Math.abs(b - a);
  if (travel === 0) return env.METRO_BASE_FARE;
  if (travel === 1) return 10;
  if (travel === 2) return 15;
  if (travel <= 6) return 20;
  if (travel <= 9) return 30;
  if (travel <= 13) return 40;
  if (travel <= 17) return 50;
  return 60;
}

function buildQrPayload(ticket: {
  ticketId: string;
  from: string;
  to: string;
  fare: number;
  validUntil: Date;
}): string {
  return JSON.stringify({
    v: 1,
    app: 'ONELINK',
    type: 'METRO',
    id: ticket.ticketId,
    from: ticket.from,
    to: ticket.to,
    fare: ticket.fare,
    expires: ticket.validUntil.toISOString(),
  });
}

async function findUserByCard(cardUid: string) {
  return User.findOne({ ...cardUidQuery(cardUid), isCardPaired: true });
}

export class KioskService {
  private transit = new TransitService();
  private parking = new ParkingService();
  private wallet = new WalletService();

  async getUserByCard(cardUid: string) {
    const user = await findUserByCard(cardUid);
    if (!user) return null;

    let activeParking: {
      spotId: string;
      entryTime: string | null;
      ratePerMinute: number;
      status: string;
      elapsedMinutes: number;
      estimatedCharge: number;
    } | null = null;

    if (user.activeParkingSpot) {
      const spot = await ParkingSpot.findOne({ spotId: user.activeParkingSpot }).lean();
      if (spot) {
        const entryTime = spot.entryTime ? new Date(spot.entryTime) : null;
        const elapsedMinutes = entryTime
          ? Math.max(1, Math.ceil((Date.now() - entryTime.getTime()) / 60000))
          : 0;
        activeParking = {
          spotId: spot.spotId,
          entryTime: entryTime?.toISOString() ?? null,
          ratePerMinute: spot.ratePerMinute,
          status: spot.status,
          elapsedMinutes,
          estimatedCharge: elapsedMinutes * spot.ratePerMinute,
        };
      }
    }

    return {
      userId: user.userId,
      name: user.name,
      cardUid: user.cardUid,
      balance: user.wallet?.balance ?? 0,
      currency: user.wallet?.currency ?? 'INR',
      loyaltyPoints: user.loyaltyPoints ?? 0,
      memberTier: user.memberTier ?? 'BRONZE',
      dailyLimit: user.wallet?.dailyLimit ?? 0,
      lastTopUp: user.wallet?.lastTopUp ? new Date(user.wallet.lastTopUp).toISOString() : null,
      cardBlocked: user.card?.isBlocked ?? false,
      activeParkingSpot: user.activeParkingSpot,
      activeParking,
    };
  }

  async exitParkingForUser(userId: string) {
    const user = await User.findOne({ userId, isCardPaired: true });
    if (!user?.cardUid) {
      return { success: false, message: 'No linked card on account' };
    }
    return this.exitParking(user.cardUid);
  }

  async pushShopCart(userId: string, items: IKioskCart['items'], subtotal: number) {
    const cartId = `CART_${Date.now()}_${uuidv4().slice(0, 6)}`;
    const cart = await KioskCart.create({
      cartId,
      userId,
      items,
      subtotal,
      total: subtotal,
      status: 'PENDING',
    });
    emitToUser(userId, 'shop:cart-pushed', { cartId, total: cart.total, itemCount: items.length });
    return cart;
  }

  async getPendingCarts(userId: string) {
    return KioskCart.find({ userId, status: 'PENDING' }).sort({ createdAt: -1 }).lean();
  }

  async getShopOrders(userId: string) {
    const user = await User.findOne({ userId }).lean();
    const carts = await KioskCart.find({ userId, status: 'PAID' })
      .sort({ paidAt: -1, updatedAt: -1 })
      .limit(100)
      .lean();

    return carts.map((cart) => ({
      orderId: cart.orderId || cart.cartId,
      username: user?.username || '',
      customerName: user?.name || user?.username || 'Guest',
      items: (cart.items || []).map((item) => ({
        productId: item.productId,
        name: item.name,
        brand: item.brand || '',
        quantity: item.quantity,
        unit: item.unit || '1 pc',
        price: item.price,
      })),
      subtotal: cart.subtotal,
      handlingFee: 0,
      deliveryFee: 0,
      total: cart.total,
      paymentMode: 'Pay via Card · Kiosk',
      deliveryAddress: 'OneLink Supermarket · Kiosk pickup',
      status: 'PLACED' as const,
      placedAt: (cart.paidAt || cart.updatedAt || cart.createdAt).toISOString(),
    }));
  }

  async payShopCart(cardUid: string, cartId: string, idempotencyKey?: string) {
    return withIdempotency(
      idempotencyKey,
      `shop:pay:${cartId}`,
      () => this._payShopCart(cardUid, cartId),
      { success: false, message: 'Payment already being processed', duplicate: true },
    );
  }

  private async _payShopCart(cardUid: string, cartId: string) {
    const found = await findUserByCard(cardUid);
    if (!found) return { success: false, message: 'Card not registered' };
    const userId = found.userId;

    // Debit + mark cart paid atomically: either both happen or neither does.
    const result = await runInTransaction(async (session) => {
      const uq = User.findOne({ userId });
      if (session) uq.session(session);
      const user = await uq;
      if (!user) return { success: false, message: 'Card not registered' };

      const cq = KioskCart.findOne({ cartId, userId, status: 'PENDING' });
      if (session) cq.session(session);
      const cart = await cq;
      if (!cart) return { success: false, message: 'Cart not found or already paid' };

      if (user.card.isBlocked) {
        return { success: false, message: 'Card is blocked. Contact support.', balance: user.wallet.balance };
      }
      if (user.wallet.balance < cart.total) {
        return { success: false, message: 'Insufficient balance', balance: user.wallet.balance };
      }

      const debit = await this.wallet.debitWithinSession(
        session, user, cart.total, 'SHOPPING', 'WALLET',
        `Kiosk shop · ${cart.items.length} items`, { cartId, source: 'kiosk' },
      );

      cart.status = 'PAID';
      cart.paidAt = new Date();
      cart.orderId = debit.transactionId;
      await cart.save({ session: session ?? undefined });

      return {
        success: true as const,
        orderId: cart.orderId,
        cartId: cart.cartId,
        amount: cart.total,
        items: cart.items,
        transactionId: debit.transactionId,
        newBalance: debit.balanceAfter,
        receiptAt: new Date().toISOString(),
      };
    });

    if (!result.success) return result;

    // Side-effects run only after the transaction has committed.
    emitToUser(userId, 'shop:order-paid', result);
    emitToUser(userId, 'payment:receipt', {
      transactionId: result.transactionId,
      amount: result.amount,
      newBalance: result.newBalance,
      category: 'SHOPPING',
      status: 'COMPLETED',
    });

    return result;
  }

  async getActiveTickets(userId: string) {
    const now = new Date();
    return MetroTicket.find({
      userId,
      status: { $in: ['ACTIVE', 'ENTRY_USED'] },
      validUntil: { $gt: now },
    }).sort({ bookedAt: -1 }).lean();
  }

  async bookTransitTicket(cardUid: string, from: string, to: string, idempotencyKey?: string) {
    return withIdempotency(
      idempotencyKey,
      `transit:book:${from}:${to}`,
      () => this._bookTransitTicket(cardUid, from, to),
      { success: false, message: 'Booking already being processed', duplicate: true },
    );
  }

  private async _bookTransitTicket(cardUid: string, from: string, to: string) {
    const found = await findUserByCard(cardUid);
    if (!found) return { success: false, message: 'Card not registered' };
    const userId = found.userId;
    const fare = calculateSlabFare(from, to);

    // Debit + create ticket atomically.
    const result = await runInTransaction(async (session) => {
      const uq = User.findOne({ userId });
      if (session) uq.session(session);
      const user = await uq;
      if (!user) return { success: false, message: 'Card not registered' };

      if (user.card.isBlocked) {
        return { success: false, message: 'Card is blocked. Contact support.', required: fare };
      }
      if (user.wallet.balance < fare) {
        return { success: false, message: 'Insufficient balance', required: fare };
      }

      const debit = await this.wallet.debitWithinSession(
        session, user, fare, 'METRO', 'WALLET', `Metro: ${from} → ${to}`, { from, to, source: 'kiosk' },
      );

      const ticketId = `TKT_${Date.now()}_${uuidv4().slice(0, 6)}`;
      const validUntil = new Date(Date.now() + 3600000);
      const qrPayload = buildQrPayload({ ticketId, from, to, fare, validUntil });
      await MetroTicket.create([{
        ticketId,
        userId,
        cardUid: user.cardUid,
        type: 'METRO',
        from,
        to,
        fare,
        qrPayload,
        validUntil,
        status: 'ACTIVE',
      }], { session: session ?? undefined });

      return {
        success: true as const,
        ticketId,
        from,
        to,
        fare,
        qrPayload,
        validUntil,
        transactionId: debit.transactionId,
        newBalance: debit.balanceAfter,
      };
    });

    if (!result.success) return result;

    emitToUser(userId, 'transit:ticket-booked', result);
    emitToUser(userId, 'payment:receipt', {
      transactionId: result.transactionId,
      amount: result.fare,
      newBalance: result.newBalance,
      category: 'METRO',
      status: 'COMPLETED',
    });

    return result;
  }

  async useTransitTicket(cardUid: string, ticketId: string) {
    const user = await findUserByCard(cardUid);
    if (!user) return { success: false, message: 'Card not registered' };
    if (user.card?.isBlocked) {
      return { success: false, message: 'Card is locked. Unlock it in the OneLink app.', cardBlocked: true };
    }

    const ticket = await MetroTicket.findOne({ ticketId, userId: user.userId });
    if (!ticket) return { success: false, message: 'Ticket not found' };
    if (ticket.validUntil < new Date()) {
      ticket.status = 'EXPIRED';
      await ticket.save();
      return { success: false, message: 'Ticket expired' };
    }

    if (ticket.status === 'ACTIVE') {
      ticket.status = 'ENTRY_USED';
      ticket.entryStation = ticket.from;
      ticket.entryTime = new Date();
      await ticket.save();
      emitToUser(user.userId, 'transit:entry', {
        ticketId,
        station: ticket.from,
        destination: ticket.to,
        message: `Entry at ${ticket.from}. Destination: ${ticket.to}`,
      });
      return {
        success: true,
        phase: 'ENTRY',
        station: ticket.from,
        destination: ticket.to,
        qrPayload: ticket.qrPayload,
      };
    }

    if (ticket.status === 'ENTRY_USED') {
      ticket.status = 'COMPLETED';
      ticket.exitStation = ticket.to;
      ticket.exitTime = new Date();
      await ticket.save();
      emitToUser(user.userId, 'transit:exit', {
        ticketId,
        station: ticket.to,
        message: `Exit at ${ticket.to}. Journey complete.`,
      });
      return {
        success: true,
        phase: 'EXIT',
        station: ticket.to,
        entryStation: ticket.entryStation,
      };
    }

    return { success: false, message: 'Ticket already used' };
  }

  async getParkingSpots() {
    return this.parking.getEnrichedSpots();
  }

  async allocateParking(cardUid: string, spotId?: string, idempotencyKey?: string) {
    return withIdempotency(
      idempotencyKey,
      `parking:allocate:${cardUid}`,
      () => this._allocateParking(cardUid, spotId),
      { success: false, message: 'Allocation already being processed', duplicate: true },
    );
  }

  private async _allocateParking(cardUid: string, spotId?: string) {
    const blocked = await findUserByCard(cardUid);
    if (blocked?.card?.isBlocked) {
      return { success: false, message: 'Card is locked. Unlock it in the OneLink app.', cardBlocked: true };
    }
    const result = await this.parking.processEntry(cardUid, spotId);
    if (!result.success || !result.userId) return result;

    const spots = await this.parking.getEnrichedSpots();
    emitBroadcast('parking:update', spots);
    emitToUser(result.userId, 'parking:entry', {
      spotId: result.spotId,
      entryTime: new Date().toISOString(),
      message: result.message,
    });

    return result;
  }

  async exitParking(cardUid: string, idempotencyKey?: string) {
    return withIdempotency(
      idempotencyKey,
      `parking:exit:${cardUid}`,
      () => this._exitParking(cardUid),
      { success: false, message: 'Exit already being processed', duplicate: true },
    );
  }

  private async _exitParking(cardUid: string) {
    const user = await findUserByCard(cardUid);
    if (!user?.activeParkingSpot) {
      return { success: false, message: 'No active parking session' };
    }
    if (user.card?.isBlocked) {
      return { success: false, message: 'Card is locked. Unlock it in the OneLink app.', cardBlocked: true };
    }

    const spotBefore = await this.parking.getAllSpots();
    const activeSpot = spotBefore.find((s) => s.spotId === user.activeParkingSpot);
    const entryTime = activeSpot?.entryTime ? new Date(activeSpot.entryTime) : new Date();

    const result = await this.parking.processExit(cardUid);
    if (!result.success || !result.userId) return result;

    const receiptId = `PRCP_${Date.now()}`;
    const exitTime = new Date();
    const durationMinutes = result.duration ?? 1;
    const ratePerMinute = activeSpot?.ratePerMinute ?? env.PARKING_RATE_PER_MINUTE;

    await ParkingReceipt.create({
      receiptId,
      userId: result.userId,
      spotId: result.spotId!,
      zone: result.spotId![0],
      entryTime,
      exitTime,
      durationMinutes,
      ratePerMinute,
      totalCharge: result.charges ?? 0,
    });

    const spots = await this.parking.getEnrichedSpots();
    emitBroadcast('parking:update', spots);
    emitToUser(result.userId, 'parking:exit', {
      spotId: result.spotId,
      duration: durationMinutes,
      charges: result.charges,
      newBalance: result.newBalance,
      receiptId,
      message: result.message,
    });
    emitToUser(result.userId, 'parking:receipt', {
      receiptId,
      spotId: result.spotId,
      durationMinutes,
      totalCharge: result.charges,
      exitTime: exitTime.toISOString(),
    });

    return { ...result, receiptId };
  }

  async getParkingReceipts(userId: string) {
    return ParkingReceipt.find({ userId }).sort({ createdAt: -1 }).limit(50).lean();
  }
}

export const kioskService = new KioskService();
