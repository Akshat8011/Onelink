import { User } from '../models/User.js';
import { ParkingSpot, IParkingSpot } from '../models/ParkingSpot.js';
import { WalletService } from './wallet.service.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { cardUidQuery } from '../utils/cardUid.js';

export class ParkingService {
  private walletService: WalletService;

  constructor() {
    this.walletService = new WalletService();
  }

  /**
   * Get all parking spots with current state
   */
  async getAllSpots(): Promise<IParkingSpot[]> {
    return ParkingSpot.find().sort({ spotId: 1 }).lean();
  }

  /**
   * Spots enriched with occupant display names for mobile/kiosk UIs
   */
  async getEnrichedSpots() {
    const spots = await this.getAllSpots();
    const userIds = [...new Set(spots.map((s) => s.occupiedBy).filter(Boolean))] as string[];
    const users = userIds.length
      ? await User.find({ userId: { $in: userIds } }).select('userId name').lean()
      : [];
    const nameById = Object.fromEntries(users.map((u) => [u.userId, u.name]));
    const demoNames: Record<string, string> = {
      demo_parker_1: 'Rahul S.',
      demo_parker_2: 'Priya M.',
      demo_parker_3: 'Amit K.',
      demo_parker_4: 'Sneha R.',
      demo_parker_5: 'Vikram P.',
      demo_parker_6: 'Ananya D.',
    };

    return spots.map((s) => ({
      spotId: s.spotId,
      zone: s.zone,
      spotNumber: s.spotNumber,
      status: s.status,
      occupiedBy: s.occupiedBy,
      occupantName: s.occupiedBy
        ? (nameById[s.occupiedBy] ?? demoNames[s.occupiedBy] ?? 'Guest')
        : null,
      entryTime: s.entryTime ? new Date(s.entryTime).toISOString() : null,
      reservedUntil: s.reservedUntil ? new Date(s.reservedUntil).toISOString() : null,
      ratePerMinute: s.ratePerMinute,
      ledColor: s.status === 'FREE' ? 'GREEN' : s.status === 'RESERVED' ? 'YELLOW' : 'RED',
    }));
  }

  /**
   * Process parking ENTRY event (from RFID tap or app reservation)
   */
  async processEntry(cardUid: string, spotId?: string): Promise<{
    success: boolean;
    userId?: string;
    spotId?: string;
    message: string;
  }> {
    // 1. Validate user
    const normalizedUid = cardUid.toString().trim().toUpperCase();
    const user = await User.findOne({ ...cardUidQuery(normalizedUid), isCardPaired: true });
    if (!user) {
      return {
        success: false,
        message: 'Enter your 10-digit pairing code on the terminal',
      };
    }

    if (user.card.isBlocked) {
      return { success: false, userId: user.userId, message: 'Card blocked.' };
    }

    // 2. Check if user already has active parking
    if (user.activeParkingSpot) {
      return {
        success: false,
        userId: user.userId,
        spotId: user.activeParkingSpot,
        message: `Already parked at ${user.activeParkingSpot}.`,
      };
    }

    // 3. Find or validate parking spot
    let spot: IParkingSpot | null;

    if (spotId) {
      spot = await ParkingSpot.findOne({ spotId });
      if (!spot) return { success: false, message: `Spot ${spotId} not found.` };
      if (spot.status !== 'FREE' && spot.status !== 'RESERVED') {
        // Try to find another free spot
        spot = await ParkingSpot.findOne({ status: 'FREE' });
        if (!spot) return { success: false, message: 'No available spots.' };
      }
      // If reserved, check it's reserved for this user
      if (spot.status === 'RESERVED' && spot.occupiedBy !== user.userId) {
        spot = await ParkingSpot.findOne({ status: 'FREE' });
        if (!spot) return { success: false, message: 'No available spots.' };
      }
    } else {
      // Auto-assign first available spot
      spot = await ParkingSpot.findOne({ status: 'FREE' });
      if (!spot) {
        return { success: false, userId: user.userId, message: 'No available parking spots!' };
      }
    }

    // 4. Occupy the spot
    spot.status = 'OCCUPIED';
    spot.occupiedBy = user.userId;
    spot.cardUid = user.cardUid;
    spot.entryTime = new Date();
    spot.ledColor = 'RED';
    spot.currentSession = {
      userId: user.userId,
      startTime: new Date(),
      endTime: null,
      totalMinutes: 0,
      totalCharge: 0,
    };
    await spot.save();

    // 5. Update user
    user.activeParkingSpot = spot.spotId;
    await user.save();

    logger.info(`🅿️ Parking ENTRY: ${user.name} at ${spot.spotId}`);

    return {
      success: true,
      userId: user.userId,
      spotId: spot.spotId,
      message: `Welcome ${user.name}! Parked at ${spot.spotId}`,
    };
  }

  /**
   * Process parking EXIT event
   * Calculate charges (₹50/minute) and deduct from wallet
   */
  async processExit(cardUid: string, spotId?: string): Promise<{
    success: boolean;
    userId?: string;
    spotId?: string;
    duration?: number;
    charges?: number;
    newBalance?: number;
    insufficientBalance?: boolean;
    message: string;
  }> {
    // 1. Find user
    const normalizedUid = cardUid.toString().trim().toUpperCase();
    const user = await User.findOne({ ...cardUidQuery(normalizedUid), isCardPaired: true });
    if (!user) return { success: false, message: 'Enter your 10-digit pairing code on the terminal' };

    // 2. Find their active spot
    const activeSpotId = spotId || user.activeParkingSpot;
    if (!activeSpotId) {
      return { success: false, userId: user.userId, message: 'No active parking session.' };
    }

    const spot = await ParkingSpot.findOne({ spotId: activeSpotId });
    if (!spot || spot.status !== 'OCCUPIED') {
      return { success: false, userId: user.userId, message: 'Parking spot not occupied.' };
    }
    if (spot.occupiedBy && spot.occupiedBy !== user.userId) {
      return { success: false, userId: user.userId, message: 'This spot belongs to another user.' };
    }

    // 3. Calculate duration and charges
    const exitTime = new Date();
    const entryTime = spot.entryTime || spot.currentSession.startTime || exitTime;
    const durationMs = exitTime.getTime() - entryTime.getTime();
    const durationMinutes = Math.max(1, Math.ceil(durationMs / 60000)); // Minimum 1 minute
    const charges = durationMinutes * spot.ratePerMinute;

    // 4. Deduct charges from wallet
    const paymentResult = await this.walletService.processPayment(
      user.userId,
      charges,
      'PARKING',
      'WALLET',
      `Parking: Spot ${activeSpotId} (${durationMinutes} min)`,
      { parkingSpot: activeSpotId, duration: durationMinutes }
    );

    // 4b. If payment failed (e.g. insufficient balance / blocked card),
    // DO NOT free the spot or clear the session. Keep the user parked and
    // ask them to recharge their OneLink wallet via the app.
    if (!paymentResult.success) {
      logger.warn(
        `🅿️ Parking EXIT blocked for ${user.name} at ${activeSpotId}: ${paymentResult.message}`,
      );
      return {
        success: false,
        userId: user.userId,
        spotId: activeSpotId,
        duration: durationMinutes,
        charges,
        newBalance: paymentResult.newBalance,
        insufficientBalance: /insufficient/i.test(paymentResult.message),
        message: paymentResult.message,
      };
    }

    // 5. Free the spot
    spot.status = 'FREE';
    spot.occupiedBy = null;
    spot.cardUid = null;
    spot.entryTime = null;
    spot.ledColor = 'GREEN';
    spot.currentSession = {
      userId: null,
      startTime: null,
      endTime: exitTime,
      totalMinutes: durationMinutes,
      totalCharge: charges,
    };
    await spot.save();

    // 6. Clear user's active parking
    user.activeParkingSpot = null;
    await user.save();

    logger.info(`🅿️ Parking EXIT: ${user.name} from ${activeSpotId} — ${durationMinutes}min, ₹${charges}`);

    return {
      success: true,
      userId: user.userId,
      spotId: activeSpotId,
      duration: durationMinutes,
      charges,
      newBalance: paymentResult.newBalance,
      message: `Goodbye ${user.name}! Duration: ${durationMinutes}min, Charges: ₹${charges}`,
    };
  }

  /**
   * Reserve a parking spot from the mobile app
   */
  async reserveSpot(userId: string, spotId: string, durationMinutes: number = 120): Promise<{
    success: boolean;
    spotId: string;
    reservedUntil: Date;
    message: string;
  }> {
    const user = await User.findOne({ userId });
    if (!user) throw new Error('User not found');

    if (user.activeParkingSpot) {
      return {
        success: false,
        spotId,
        reservedUntil: new Date(),
        message: `You already have spot ${user.activeParkingSpot}. Vacate it at the kiosk first.`,
      };
    }

    const existingHold = await ParkingSpot.findOne({
      occupiedBy: userId,
      status: { $in: ['RESERVED', 'OCCUPIED'] },
    });
    if (existingHold) {
      return {
        success: false,
        spotId,
        reservedUntil: new Date(),
        message: `You already hold spot ${existingHold.spotId}. Vacate it at the kiosk first.`,
      };
    }

    const spot = await ParkingSpot.findOne({ spotId });
    if (!spot) throw new Error('Spot not found');

    if (spot.status !== 'FREE') {
      return { success: false, spotId, reservedUntil: new Date(), message: `Spot ${spotId} is not available.` };
    }

    const reservedUntil = new Date(Date.now() + durationMinutes * 60000);

    spot.status = 'RESERVED';
    spot.occupiedBy = userId;
    spot.reservedUntil = reservedUntil;
    spot.ledColor = 'YELLOW';
    await spot.save();

    user.activeParkingSpot = spotId;
    await user.save();

    logger.info(`🅿️ RESERVED: Spot ${spotId} for ${userId} until ${reservedUntil.toISOString()}`);

    return {
      success: true,
      spotId,
      reservedUntil,
      message: `Spot ${spotId} reserved for ${durationMinutes} minutes`,
    };
  }

  /**
   * Release a reservation
   */
  async releaseReservation(spotId: string): Promise<void> {
    const spot = await ParkingSpot.findOne({ spotId });
    if (spot && spot.status === 'RESERVED') {
      const holderId = spot.occupiedBy;
      spot.status = 'FREE';
      spot.occupiedBy = null;
      spot.reservedUntil = null;
      spot.ledColor = 'GREEN';
      await spot.save();
      if (holderId) {
        await User.updateOne(
          { userId: holderId, activeParkingSpot: spotId },
          { $set: { activeParkingSpot: null } },
        );
      }
      logger.info(`🅿️ Reservation released: Spot ${spotId}`);
    }
  }

  /**
   * Update IR sensor state from hardware (bulk update)
   */
  async updateSensorState(sensorData: Record<string, { occupied: boolean; irSensorValue: number }>): Promise<void> {
    for (const [spotId, data] of Object.entries(sensorData)) {
      await ParkingSpot.findOneAndUpdate(
        { spotId },
        { irSensorValue: data.irSensorValue },
        { upsert: false }
      );
    }
  }

  /**
   * Initialize parking spots — 5 zones (A–E), 4 spots each
   */
  async initializeSpots(): Promise<void> {
    const zones = ['A', 'B', 'C', 'D', 'E'];
    for (const zone of zones) {
      for (let n = 1; n <= 4; n++) {
        const spotId = `${zone}${n}`;
        const exists = await ParkingSpot.findOne({ spotId });
        if (!exists) {
          await ParkingSpot.create({
            spotId,
            zone,
            spotNumber: n,
            status: 'FREE',
            ratePerMinute: env.PARKING_RATE_PER_MINUTE,
          });
          logger.info(`🅿️ Initialized parking spot: ${spotId}`);
        }
      }
    }
    await this.seedDemoVarietyIfEmpty();
  }

  /** Seed a mix of free / reserved / occupied spots when the grid is entirely empty */
  private async seedDemoVarietyIfEmpty(): Promise<void> {
    const nonFree = await ParkingSpot.countDocuments({ status: { $ne: 'FREE' } });
    if (nonFree > 0) return;

    const now = Date.now();
    const patches: Array<Record<string, unknown>> = [
      { spotId: 'A2', status: 'OCCUPIED', occupiedBy: 'demo_parker_1', entryTime: new Date(now - 45 * 60000), ledColor: 'RED' },
      { spotId: 'A3', status: 'RESERVED', occupiedBy: 'demo_parker_2', reservedUntil: new Date(now + 90 * 60000), ledColor: 'YELLOW' },
      { spotId: 'B1', status: 'OCCUPIED', occupiedBy: 'demo_parker_3', entryTime: new Date(now - 120 * 60000), ledColor: 'RED' },
      { spotId: 'B4', status: 'RESERVED', occupiedBy: 'demo_parker_4', reservedUntil: new Date(now + 60 * 60000), ledColor: 'YELLOW' },
      { spotId: 'C2', status: 'OCCUPIED', occupiedBy: 'demo_parker_5', entryTime: new Date(now - 30 * 60000), ledColor: 'RED' },
      { spotId: 'D3', status: 'RESERVED', occupiedBy: 'demo_parker_6', reservedUntil: new Date(now + 45 * 60000), ledColor: 'YELLOW' },
    ];

    for (const patch of patches) {
      const { spotId, ...rest } = patch;
      await ParkingSpot.updateOne({ spotId, status: 'FREE' }, { $set: rest });
    }
    logger.info('🅿️ Seeded demo parking variety (free / reserved / occupied)');
  }
}
