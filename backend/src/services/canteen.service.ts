import { v4 as uuidv4 } from 'uuid';
import { User } from '../models/User.js';
import { CanteenCart, ICanteenCart, ICanteenCartItem } from '../models/CanteenCart.js';
import { CanteenOrder } from '../models/CanteenOrder.js';
import { CanteenQueue } from '../models/CanteenQueue.js';
import { WalletService } from './wallet.service.js';
import { emitToUser, emitBroadcast } from '../utils/realtime.js';
import { logger } from '../utils/logger.js';
import { runInTransaction } from '../utils/db-transaction.js';
import { withIdempotency } from '../utils/idempotency.js';
import { cardUidQuery } from '../utils/cardUid.js';
import { CANTEEN_MENU, type CanteenMenuItem } from '../data/canteenMenu.js';

export type { CanteenMenuItem };
export { CANTEEN_MENU };

/** Minutes each order number waits in the queue. */
export const CANTEEN_MINUTES_PER_ORDER = 2;

async function findUserByCard(cardUid: string) {
  return User.findOne({ ...cardUidQuery(cardUid), isCardPaired: true });
}

async function getOrCreateQueue() {
  let q = await CanteenQueue.findOne({ key: 'global' });
  if (!q) {
    q = await CanteenQueue.create({ key: 'global', nowServing: 0, nextOrderNumber: 1 });
  }
  return q;
}

export class CanteenService {
  private wallet = new WalletService();
  private queueTimer: ReturnType<typeof setInterval> | null = null;

  getMenu() {
    const categories = ['All', ...Array.from(new Set(CANTEEN_MENU.map((i) => i.category)))];
    return { items: CANTEEN_MENU, categories };
  }

  async pushCart(userId: string, items: ICanteenCartItem[], subtotal: number) {
    const cartId = `CNCART_${Date.now()}_${uuidv4().slice(0, 6)}`;
    const cart = await CanteenCart.create({
      cartId,
      userId,
      items,
      subtotal,
      total: subtotal,
      status: 'PENDING',
    });
    emitToUser(userId, 'canteen:cart-pushed', {
      cartId,
      total: cart.total,
      itemCount: items.length,
    });
    return cart;
  }

  async getPendingCarts(userId: string) {
    return CanteenCart.find({ userId, status: 'PENDING' }).sort({ createdAt: -1 }).lean();
  }

  async getOrders(userId: string) {
    const orders = await CanteenOrder.find({ userId })
      .sort({ paidAt: -1 })
      .limit(100)
      .lean();
    const queue = await getOrCreateQueue();
    return {
      nowServing: queue.nowServing,
      orders: orders.map((o) => this.serializeOrder(o, queue.nowServing)),
    };
  }

  async getOrder(userId: string, orderId: string) {
    const order = await CanteenOrder.findOne({ orderId, userId }).lean();
    if (!order) return null;
    const queue = await getOrCreateQueue();
    return this.serializeOrder(order, queue.nowServing);
  }

  async getQueue() {
    const queue = await getOrCreateQueue();
    // Promote overdue PREPARING → READY so the board stays accurate between ticks
    await this.markReadyByTime(queue.nowServing);
    const preparing = await CanteenOrder.find({ status: { $in: ['PREPARING', 'READY'] } })
      .sort({ orderNumber: 1 })
      .limit(30)
      .lean();
    return {
      nowServing: queue.nowServing,
      nextOrderNumber: queue.nextOrderNumber,
      orders: preparing.map((o) => ({
        orderNumber: o.orderNumber,
        status:
          o.status === 'READY' || o.orderNumber <= queue.nowServing
            ? 'READY'
            : o.status,
        readyAt: o.readyAt,
        itemCount: o.items?.length || 0,
      })),
    };
  }

  async payCart(
    cardUid: string,
    opts: { cartId?: string; items?: ICanteenCartItem[] },
    idempotencyKey?: string,
  ) {
    const keyScope = opts.cartId
      ? `canteen:pay:${opts.cartId}`
      : `canteen:pay:inline:${cardUid}:${idempotencyKey || Date.now()}`;
    return withIdempotency(
      idempotencyKey,
      keyScope,
      () => this._payCart(cardUid, opts),
      { success: false, message: 'Payment already being processed', duplicate: true },
    );
  }

  private async _payCart(
    cardUid: string,
    opts: { cartId?: string; items?: ICanteenCartItem[] },
  ) {
    const found = await findUserByCard(cardUid);
    if (!found) return { success: false, message: 'Card not registered' };
    const userId = found.userId;

    const result = await runInTransaction(async (session) => {
      const uq = User.findOne({ userId });
      if (session) uq.session(session);
      const user = await uq;
      if (!user) return { success: false, message: 'Card not registered' };

      if (user.card.isBlocked) {
        return { success: false, message: 'Card is blocked. Contact support.', balance: user.wallet.balance };
      }

      let items: ICanteenCartItem[] = [];
      let total = 0;
      let cart: ICanteenCart | null = null;

      if (opts.cartId) {
        const cq = CanteenCart.findOne({ cartId: opts.cartId, userId, status: 'PENDING' });
        if (session) cq.session(session);
        cart = await cq;
        if (!cart) return { success: false, message: 'Cart not found or already paid' };
        items = cart.items;
        total = cart.total;
      } else if (opts.items?.length) {
        items = opts.items;
        total = items.reduce((s, i) => s + i.price * i.quantity, 0);
      } else {
        return { success: false, message: 'No cart or items provided' };
      }

      if (total <= 0) return { success: false, message: 'Invalid cart total' };
      if (user.wallet.balance < total) {
        return { success: false, message: 'Insufficient balance', balance: user.wallet.balance };
      }

      const qq = CanteenQueue.findOne({ key: 'global' });
      if (session) qq.session(session);
      let queue = await qq;
      if (!queue) {
        const created = await CanteenQueue.create(
          [{ key: 'global', nowServing: 0, nextOrderNumber: 1 }],
          session ? { session } : undefined,
        );
        queue = Array.isArray(created) ? created[0] : created;
      }

      const orderNumber = queue.nextOrderNumber;
      queue.nextOrderNumber = orderNumber + 1;
      // Seed nowServing so first order isn't stuck at 0 forever
      if (queue.nowServing === 0 && orderNumber === 1) {
        queue.nowServing = 0;
      }
      await queue.save({ session: session ?? undefined });

      const stepsAhead = Math.max(1, orderNumber - queue.nowServing);
      const paidAt = new Date();
      const readyAt = new Date(paidAt.getTime() + stepsAhead * CANTEEN_MINUTES_PER_ORDER * 60_000);

      const debit = await this.wallet.debitWithinSession(
        session,
        user,
        total,
        'SHOPPING',
        'WALLET',
        `Canteen · Order #${orderNumber} · ${items.length} items`,
        { source: 'canteen', orderNumber, cartId: cart?.cartId },
      );

      const orderId = `CNORD_${Date.now()}_${uuidv4().slice(0, 6)}`;
      const receiptId = `CNRCP_${Date.now()}_${uuidv4().slice(0, 6)}`;

      const oq = CanteenOrder.create(
        [
          {
            orderId,
            orderNumber,
            userId,
            cartId: cart?.cartId,
            items,
            total,
            status: 'PREPARING',
            paidAt,
            readyAt,
            receiptId,
            transactionId: debit.transactionId,
          },
        ],
        session ? { session } : undefined,
      );
      const createdOrders = await oq;
      const order = Array.isArray(createdOrders) ? createdOrders[0] : createdOrders;

      if (cart) {
        cart.status = 'PAID';
        cart.paidAt = paidAt;
        cart.orderId = orderId;
        await cart.save({ session: session ?? undefined });
      }

      return {
        success: true as const,
        orderId: order.orderId,
        orderNumber,
        receiptId,
        cartId: cart?.cartId,
        amount: total,
        items,
        transactionId: debit.transactionId,
        newBalance: debit.balanceAfter,
        nowServing: queue.nowServing,
        readyAt: readyAt.toISOString(),
        etaMinutes: stepsAhead * CANTEEN_MINUTES_PER_ORDER,
        paidAt: paidAt.toISOString(),
        status: 'PREPARING' as const,
      };
    });

    if (!result.success) return result;

    emitToUser(userId, 'canteen:order-paid', result);
    emitToUser(userId, 'payment:receipt', {
      transactionId: result.transactionId,
      amount: result.amount,
      newBalance: result.newBalance,
      category: 'SHOPPING',
      status: 'COMPLETED',
    });
    emitBroadcast('canteen:queue-updated', {
      nowServing: result.nowServing,
      orderNumber: result.orderNumber,
    });

    return result;
  }

  async collectOrder(cardUid: string, orderNumber: number, idempotencyKey?: string) {
    return withIdempotency(
      idempotencyKey,
      `canteen:collect:${orderNumber}`,
      () => this._collectOrder(cardUid, orderNumber),
      { success: false, message: 'Collection already being processed', duplicate: true },
    );
  }

  private async _collectOrder(cardUid: string, orderNumber: number) {
    const found = await findUserByCard(cardUid);
    if (!found) return { success: false, message: 'Card not registered' };
    const userId = found.userId;

    const order = await CanteenOrder.findOne({ userId, orderNumber });
    if (!order) return { success: false, message: 'Order not found for this card' };

    if (order.status === 'COLLECTED') {
      return {
        success: true,
        alreadyCollected: true,
        ...this.serializeOrder(order.toObject(), (await getOrCreateQueue()).nowServing),
      };
    }

    // READY orders can be collected anytime (even if nowServing has moved ahead).
    // PREPARING only if the queue/time says it's ready.
    if (order.status === 'PREPARING') {
      const queue = await getOrCreateQueue();
      const readyByQueue = order.orderNumber <= queue.nowServing;
      const readyByTime = order.readyAt && new Date(order.readyAt).getTime() <= Date.now();
      if (!readyByQueue && !readyByTime) {
        return {
          success: false,
          message: `Order #${orderNumber} is still preparing. Now serving #${queue.nowServing}`,
          nowServing: queue.nowServing,
          orderNumber,
        };
      }
    }

    order.status = 'COLLECTED';
    order.collectedAt = new Date();
    await order.save();

    const queue = await getOrCreateQueue();
    const payload = {
      success: true as const,
      ...this.serializeOrder(order.toObject(), queue.nowServing),
    };

    emitToUser(userId, 'canteen:order-collected', payload);
    return payload;
  }

  /** Advance nowServing by 1 every 2 minutes while PREPARING orders exist. */
  startQueueSimulator() {
    if (this.queueTimer) return;
    this.queueTimer = setInterval(() => {
      this.tickQueue().catch((err) => logger.error('Canteen queue tick failed:', err));
    }, CANTEEN_MINUTES_PER_ORDER * 60_000);
    logger.info(`🍽️ Canteen queue simulator started (every ${CANTEEN_MINUTES_PER_ORDER} min)`);
  }

  stopQueueSimulator() {
    if (this.queueTimer) {
      clearInterval(this.queueTimer);
      this.queueTimer = null;
    }
  }

  async tickQueue() {
    const preparingCount = await CanteenOrder.countDocuments({ status: 'PREPARING' });
    if (preparingCount === 0) return;

    const queue = await getOrCreateQueue();
    const maxOrder = await CanteenOrder.findOne({ status: 'PREPARING' })
      .sort({ orderNumber: -1 })
      .select('orderNumber')
      .lean();
    if (!maxOrder || queue.nowServing >= maxOrder.orderNumber) {
      // Still mark any overdue by readyAt
      await this.markReadyByTime(queue.nowServing);
      return;
    }

    queue.nowServing += 1;
    await queue.save();

    const readyOrders = await CanteenOrder.find({
      status: 'PREPARING',
      orderNumber: { $lte: queue.nowServing },
    });

    for (const order of readyOrders) {
      order.status = 'READY';
      await order.save();
      emitToUser(order.userId, 'canteen:order-ready', {
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        receiptId: order.receiptId,
        total: order.total,
        items: order.items,
        nowServing: queue.nowServing,
        status: 'READY',
      });
    }

    emitBroadcast('canteen:queue-updated', {
      nowServing: queue.nowServing,
      readyCount: readyOrders.length,
    });

    logger.info(`🍽️ Canteen now serving #${queue.nowServing} (${readyOrders.length} marked ready)`);
  }

  private async markReadyByTime(nowServing: number) {
    const due = await CanteenOrder.find({
      status: 'PREPARING',
      readyAt: { $lte: new Date() },
    });
    for (const order of due) {
      order.status = 'READY';
      await order.save();
      emitToUser(order.userId, 'canteen:order-ready', {
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        receiptId: order.receiptId,
        total: order.total,
        items: order.items,
        nowServing,
        status: 'READY',
      });
    }
  }

  serializeOrder(
    o: {
      orderId: string;
      orderNumber: number;
      userId?: string;
      cartId?: string;
      items: ICanteenCartItem[];
      total: number;
      status: string;
      paidAt: Date | string;
      readyAt: Date | string;
      collectedAt?: Date | string;
      receiptId: string;
      transactionId?: string;
    },
    nowServing: number,
  ) {
    const orderNumber = o.orderNumber;
    const etaSteps = Math.max(0, orderNumber - nowServing);
    return {
      orderId: o.orderId,
      orderNumber,
      cartId: o.cartId,
      items: o.items,
      total: o.total,
      status: o.status,
      paidAt: new Date(o.paidAt).toISOString(),
      readyAt: new Date(o.readyAt).toISOString(),
      collectedAt: o.collectedAt ? new Date(o.collectedAt).toISOString() : undefined,
      receiptId: o.receiptId,
      transactionId: o.transactionId,
      nowServing,
      etaMinutes: o.status === 'PREPARING' ? etaSteps * CANTEEN_MINUTES_PER_ORDER : 0,
    };
  }
}

export const canteenService = new CanteenService();
