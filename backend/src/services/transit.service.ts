import { User } from '../models/User.js';
import { MetroJourney } from '../models/MetroJourney.js';
import { WalletService } from './wallet.service.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { cardUidQuery } from '../utils/cardUid.js';
import { METRO_STATIONS, metroDistanceKm } from '../utils/metroStations.js';
import { v4 as uuidv4 } from 'uuid';

export class TransitService {
  private walletService: WalletService;

  constructor() {
    this.walletService = new WalletService();
  }

  /**
   * Process metro ENTRY event
   * Called when RFID card is tapped at entry gate
   */
  async processEntry(cardUid: string, station: string, gateId: string): Promise<{
    success: boolean;
    userId?: string;
    userName?: string;
    journeyId?: string;
    message: string;
    pairingRequired?: boolean;
  }> {
    const normalizedUid = cardUid.toString().trim().toUpperCase();
    const user = await User.findOne({ ...cardUidQuery(normalizedUid), isCardPaired: true });
    if (!user) {
      return {
        success: false,
        message: 'Enter your 10-digit pairing code on the terminal',
        pairingRequired: true,
      };
    }

    if (user.card.isBlocked) {
      return { success: false, userId: user.userId, userName: user.name, message: 'Card is blocked. Contact support.' };
    }

    // 2. Check if user already has an active journey
    if (user.activeMetroJourney) {
      const activeJourney = await MetroJourney.findById(user.activeMetroJourney);
      if (activeJourney && activeJourney.status === 'IN_PROGRESS') {
        return {
          success: false,
          userId: user.userId,
          userName: user.name,
          message: `Already in metro! Entry: ${activeJourney.entryStation}`,
        };
      }
    }

    // 3. Check minimum balance for entry (₹10 base fare)
    if (user.wallet.balance < env.METRO_BASE_FARE) {
      return {
        success: false,
        userId: user.userId,
        userName: user.name,
        message: `Low balance: ₹${user.wallet.balance}. Min required: ₹${env.METRO_BASE_FARE}`,
      };
    }

    // 4. Create journey record
    const journeyId = `jrn_${Date.now()}_${uuidv4().substring(0, 8)}`;
    const journey = await MetroJourney.create({
      journeyId,
      userId: user.userId,
      cardUid: user.cardUid,
      entryStation: station,
      entryGateId: gateId,
      entryTime: new Date(),
      status: 'IN_PROGRESS',
      fareCalculation: {
        baseFare: env.METRO_BASE_FARE,
        perKmRate: env.METRO_PER_KM_RATE,
      },
    });

    // 5. Link journey to user
    user.activeMetroJourney = journey._id as any;
    await user.save();

    logger.info(`🚇 Metro ENTRY: ${user.name} at ${station} (Journey: ${journeyId})`);

    return {
      success: true,
      userId: user.userId,
      userName: user.name,
      journeyId,
      message: `Welcome ${user.name}! Entry: ${station}`,
    };
  }

  /**
   * Process metro EXIT event
   * Calculate fare, deduct balance, complete journey
   */
  async processExit(cardUid: string, station: string, gateId: string): Promise<{
    success: boolean;
    userId?: string;
    userName?: string;
    fare?: number;
    duration?: number;
    newBalance?: number;
    insufficientBalance?: boolean;
    message: string;
    pairingRequired?: boolean;
  }> {
    const normalizedUid = cardUid.toString().trim().toUpperCase();
    const user = await User.findOne({ ...cardUidQuery(normalizedUid), isCardPaired: true });
    if (!user) {
      return {
        success: false,
        message: 'Enter your 10-digit pairing code on the terminal',
        pairingRequired: true,
      };
    }

    // 2. Find active journey
    if (!user.activeMetroJourney) {
      return { success: false, userId: user.userId, userName: user.name, message: 'No active journey found. Please tap at entry first.' };
    }

    const journey = await MetroJourney.findById(user.activeMetroJourney);
    if (!journey || journey.status !== 'IN_PROGRESS') {
      return { success: false, userId: user.userId, userName: user.name, message: 'No active journey found.' };
    }

    // 3. Calculate fare
    const exitTime = new Date();
    const durationMs = exitTime.getTime() - journey.entryTime.getTime();
    const durationMinutes = Math.ceil(durationMs / 60000);

    // Distance-based fare calculation
    const distance = this.getDistance(journey.entryStation, station);
    const fare = env.METRO_BASE_FARE + (distance * env.METRO_PER_KM_RATE);
    const roundedFare = Math.ceil(fare);

    // 4. Deduct fare from wallet
    const paymentResult = await this.walletService.processPayment(
      user.userId,
      roundedFare,
      'METRO',
      'WALLET',
      `Metro: ${journey.entryStation} → ${station} (${durationMinutes}min, ${distance}km)`,
      { station: `${journey.entryStation} → ${station}`, duration: durationMinutes }
    );

    // 4b. Block exit if the fare could not be charged (insufficient balance /
    // blocked card). The journey stays IN_PROGRESS so it can be settled once
    // the user recharges their OneLink wallet via the app.
    if (!paymentResult.success) {
      logger.warn(
        `🚇 Metro EXIT blocked for ${user.name} at ${station}: ${paymentResult.message}`,
      );
      return {
        success: false,
        userId: user.userId,
        userName: user.name,
        fare: roundedFare,
        duration: durationMinutes,
        newBalance: paymentResult.newBalance,
        insufficientBalance: /insufficient/i.test(paymentResult.message),
        message: paymentResult.message,
      };
    }

    // 5. Complete journey record
    journey.exitStation = station;
    journey.exitGateId = gateId;
    journey.exitTime = exitTime;
    journey.durationMinutes = durationMinutes;
    journey.fare = roundedFare;
    journey.fareCalculation.distance = distance;
    journey.status = 'COMPLETED';
    await journey.save();

    // 6. Clear active journey from user
    user.activeMetroJourney = null;
    await user.save();

    logger.info(`🚇 Metro EXIT: ${user.name} at ${station} — Fare: ₹${roundedFare} (${durationMinutes}min, ${distance}km)`);

    return {
      success: true,
      userId: user.userId,
      userName: user.name,
      fare: roundedFare,
      duration: durationMinutes,
      newBalance: paymentResult.newBalance,
      message: `Goodbye ${user.name}! Fare: ₹${roundedFare}`,
    };
  }

  /**
   * Get active journey for a user
   */
  async getActiveJourney(userId: string) {
    const user = await User.findOne({ userId });
    if (!user || !user.activeMetroJourney) return null;

    const journey = await MetroJourney.findById(user.activeMetroJourney);
    if (!journey || journey.status !== 'IN_PROGRESS') return null;

    const durationMs = Date.now() - journey.entryTime.getTime();
    const durationMinutes = Math.ceil(durationMs / 60000);

    return {
      journeyId: journey.journeyId,
      entryStation: journey.entryStation,
      entryTime: journey.entryTime,
      durationMinutes,
      estimatedFare: env.METRO_BASE_FARE,
    };
  }

  /**
   * Get journey history for a user
   */
  async getJourneyHistory(userId: string, limit: number = 20) {
    return MetroJourney.find({ userId, status: 'COMPLETED' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  /**
   * Calculate distance between two stations
   */
  private getDistance(from: string, to: string): number {
    return metroDistanceKm(from, to);
  }

  /**
   * Get all stations list
   */
  getStations(): string[] {
    return [...METRO_STATIONS];
  }
}
