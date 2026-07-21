import { ClientSession } from 'mongoose';
import { User, IUser } from '../models/User.js';
import { Transaction } from '../models/Transaction.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { runInTransaction } from '../utils/db-transaction.js';
import { cardUidQuery } from '../utils/cardUid.js';
import { v4 as uuidv4 } from 'uuid';

function recalcTier(loyaltyPoints: number): IUser['memberTier'] {
  if (loyaltyPoints >= 1000) return 'PLATINUM';
  if (loyaltyPoints >= 500) return 'GOLD';
  if (loyaltyPoints >= 200) return 'SILVER';
  return 'BRONZE';
}

const WALLET_CATEGORIES = [
  'METRO', 'PARKING', 'SHOPPING', 'BILL_PAY', 'EVENT', 'TOP_UP', 'REWARD_REDEEM',
  'INVEST', 'INSURANCE', 'LOAN', 'WITHDRAW', 'RECHARGE', 'UPI', 'MOBILITY', 'OTHER',
] as const;

type WalletCategory = (typeof WALLET_CATEGORIES)[number];

/** Coerce any client-supplied category into a value the Transaction schema accepts. */
function normalizeCategory(category: unknown): WalletCategory {
  const upper = String(category ?? '').toUpperCase();
  const alias: Record<string, WalletCategory> = {
    BILLS: 'BILL_PAY',
    BILL: 'BILL_PAY',
    FASTAG: 'MOBILITY',
    LOAN_DISBURSAL: 'LOAN',
    LOAN_REPAY: 'LOAN',
  };
  const mapped = alias[upper] ?? (upper as WalletCategory);
  return WALLET_CATEGORIES.includes(mapped) ? mapped : 'OTHER';
}

export class WalletService {

  /**
   * Debit a wallet and write the matching DEBIT transaction inside a single
   * session so the two can never diverge. The caller is expected to have loaded
   * `user` within the same `session` and to perform any domain writes (ticket,
   * cart, receipt) in that same transaction. Balance/blocked checks must be done
   * by the caller before invoking this.
   */
  private async debitInSession(
    session: ClientSession | null,
    user: IUser,
    amount: number,
    category: 'METRO' | 'PARKING' | 'SHOPPING' | 'BILL_PAY' | 'EVENT',
    paymentMethod: 'NFC' | 'WALLET' | 'POINTS' | 'BANK_TRANSFER',
    description: string,
    metadata: Record<string, any>,
  ): Promise<{ transactionId: string; balanceBefore: number; balanceAfter: number; rewardPoints: number }> {
    const balanceBefore = user.wallet.balance;
    user.wallet.balance -= amount;
    user.transactionCount += 1;

    const rewardPoints = Math.floor(amount / env.LOYALTY_POINTS_RATIO);
    user.loyaltyPoints += rewardPoints;
    user.memberTier = recalcTier(user.loyaltyPoints);

    await user.save({ session: session ?? undefined });

    const transactionId = `txn_${Date.now()}_${uuidv4().substring(0, 8)}`;
    await Transaction.create([{
      transactionId,
      userId: user.userId,
      cardUid: user.cardUid,
      type: 'DEBIT',
      category,
      amount,
      balanceBefore,
      balanceAfter: user.wallet.balance,
      description,
      paymentMethod,
      rewardPoints,
      metadata,
      status: 'COMPLETED',
    }], { session: session ?? undefined });

    return { transactionId, balanceBefore, balanceAfter: user.wallet.balance, rewardPoints };
  }

  /** Expose the atomic debit primitive to sibling services that own their own transaction. */
  async debitWithinSession(
    session: ClientSession | null,
    user: IUser,
    amount: number,
    category: 'METRO' | 'PARKING' | 'SHOPPING' | 'BILL_PAY' | 'EVENT',
    paymentMethod: 'NFC' | 'WALLET' | 'POINTS' | 'BANK_TRANSFER',
    description: string,
    metadata: Record<string, any> = {},
  ) {
    return this.debitInSession(session, user, amount, category, paymentMethod, description, metadata);
  }

  /**
   * Get user wallet dashboard with banks, cards, transactions
   */
  async getWallet(userId: string) {
    const user = await User.findOne({ userId });
    if (!user) throw new Error('User not found');

    const transactions = await Transaction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const analytics = await Transaction.aggregate([
      { $match: { userId, type: 'DEBIT' } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
    ]);

    const cards = [{
      cardId: `CRD_${user.userId}`,
      bankName: user.card.cardType,
      cardType: 'NFC',
      network: 'ONELINK',
      cardNumberLast4: user.card.cardNumber.slice(-4),
      expiryMonth: parseInt(user.card.expiry.split('/')[0], 10),
      expiryYear: parseInt(user.card.expiry.split('/')[1], 10),
      cardholderName: user.name,
      colorHex: '#3B82F6',
      isBlocked: user.card.isBlocked,
      internationalPayments: user.card.internationalUsage,
      onlineTransactions: user.card.domesticUsage,
      contactlessPayments: true,
      atmWithdrawals: false,
      posTransactions: true,
      tapToPay: user.isCardPaired,
      smsAlerts: true,
      autoPayEnabled: false,
      rewardRedemption: true,
      dailyLimit: user.card.dailyLimit,
    }];

    const banks = user.linkedBanks.map((b, i) => ({
      accountId: `ACC_${user.userId}_${i}`,
      bankName: b.bankName,
      accountType: 'SAVINGS',
      accountNumberLast4: b.accountNumber.slice(-4),
      balance: b.balance,
    }));

    return {
      wallet: {
        balance: user.wallet.balance,
        currency: user.wallet.currency,
        loyaltyPoints: user.loyaltyPoints,
        memberTier: user.memberTier,
        dailyLimit: user.wallet.dailyLimit,
        lastTopUp: user.wallet.lastTopUp,
      },
      nfc: {
        isCardPaired: user.isCardPaired,
        cardUid: user.isCardPaired ? user.cardUid : null,
        hasPairingCode: !user.isCardPaired && !!user.pairingToken,
        isBlocked: user.card.isBlocked,
      },
      cards,
      banks,
      transactions: transactions.map((t) => ({
        transactionId: t.transactionId,
        type: t.type,
        amount: t.amount,
        category: t.category,
        description: t.description,
        date: (t as any).createdAt?.toISOString?.() || new Date().toISOString(),
        paymentMode: t.paymentMethod,
      })),
      analytics,
    };
  }

  /**
   * Top up wallet balance (from linked bank or external source)
   */
  async topUp(
    userId: string,
    amount: number,
    opts: { accountId?: string; bankName?: string } = {},
  ): Promise<{
    success: boolean;
    newBalance: number;
    bankBalance?: number;
    accountId?: string;
    bankName?: string;
    transactionId?: string;
    message: string;
  }> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Invalid top-up amount');
    }

    return runInTransaction(async (session) => {
      const query = User.findOne({ userId });
      if (session) query.session(session);
      const user = await query;
      if (!user) throw new Error('User not found');

      const banks = user.linkedBanks || [];
      if (!banks.length) {
        return {
          success: false,
          newBalance: user.wallet.balance,
          message: 'No linked bank account to transfer from.',
        };
      }

      // Resolve which linked account to debit. Prefer the accountId sent by the
      // app (ACC_<userId>_<index>), then a bank name, then the primary/first.
      let idx = -1;
      if (opts.accountId) {
        const m = /_(\d+)$/.exec(opts.accountId);
        if (m) idx = parseInt(m[1], 10);
      }
      if ((idx < 0 || idx >= banks.length) && opts.bankName) {
        idx = banks.findIndex((b) => b.bankName === opts.bankName);
      }
      if (idx < 0 || idx >= banks.length) {
        idx = banks.findIndex((b) => b.isPrimary);
      }
      if (idx < 0) idx = 0;

      const bank = banks[idx];
      if (!bank) {
        return { success: false, newBalance: user.wallet.balance, message: 'Bank account not found.' };
      }

      // Re-read balance inside the transaction so concurrent top-ups can't
      // overdraw the account.
      if (bank.balance < amount) {
        return {
          success: false,
          newBalance: user.wallet.balance,
          bankBalance: bank.balance,
          accountId: `ACC_${user.userId}_${idx}`,
          bankName: bank.bankName,
          message: `Insufficient balance in ${bank.bankName}. Available: ₹${bank.balance}`,
        };
      }

      const balanceBefore = user.wallet.balance;
      // Move the money: debit the bank, credit the wallet — atomically.
      user.linkedBanks[idx].balance -= amount;
      user.markModified('linkedBanks'); // ensure the nested array change persists
      user.wallet.balance += amount;
      user.wallet.lastTopUp = new Date();
      user.transactionCount += 1;
      await user.save({ session: session ?? undefined });

      const transactionId = `txn_${Date.now()}_${uuidv4().substring(0, 8)}`;
      await Transaction.create([{
        transactionId,
        userId: user.userId,
        cardUid: user.cardUid,
        type: 'CREDIT',
        category: 'TOP_UP',
        amount,
        balanceBefore,
        balanceAfter: user.wallet.balance,
        description: `Top-up from ${bank.bankName} ••${bank.accountNumber.slice(-4)}`,
        paymentMethod: 'BANK_TRANSFER',
        rewardPoints: 0,
        status: 'COMPLETED',
      }], { session: session ?? undefined });

      logger.info(
        `💰 Top-up: ${user.name} +₹${amount} from ${bank.bankName} ` +
          `(wallet: ₹${user.wallet.balance}, ${bank.bankName}: ₹${user.linkedBanks[idx].balance})`,
      );

      return {
        success: true,
        newBalance: user.wallet.balance,
        bankBalance: user.linkedBanks[idx].balance,
        accountId: `ACC_${user.userId}_${idx}`,
        bankName: bank.bankName,
        transactionId,
        message: `₹${amount} added to wallet from ${bank.bankName}`,
      };
    });
  }

  /**
   * Process a payment (debit from wallet)
   * Used by: Metro fare, Parking charges, Shopping, Bill payment, Event booking
   */
  async processPayment(
    cardUidOrUserId: string,
    amount: number,
    category: 'METRO' | 'PARKING' | 'SHOPPING' | 'BILL_PAY' | 'EVENT',
    paymentMethod: 'NFC' | 'WALLET' | 'POINTS' | 'BANK_TRANSFER' = 'WALLET',
    description: string = '',
    metadata: Record<string, any> = {}
  ): Promise<{
    success: boolean;
    userId: string;
    transactionId: string;
    newBalance: number;
    rewardPoints: number;
    message: string;
  }> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Invalid payment amount');
    }

    return runInTransaction(async (session) => {
      // Find user by either cardUid (plaintext/hashed) or userId, inside the txn
      const query = User.findOne({
        $or: [cardUidQuery(cardUidOrUserId), { userId: cardUidOrUserId }],
      });
      if (session) query.session(session);
      const user = await query;
      if (!user) throw new Error('User not found');

      // Check card status
      if (user.card.isBlocked) {
        return {
          success: false,
          userId: user.userId,
          transactionId: '',
          newBalance: user.wallet.balance,
          rewardPoints: 0,
          message: 'Card is blocked. Contact support.',
        };
      }

      // Check sufficient balance (re-read inside the transaction avoids races)
      if (user.wallet.balance < amount) {
        return {
          success: false,
          userId: user.userId,
          transactionId: '',
          newBalance: user.wallet.balance,
          rewardPoints: 0,
          message: `Insufficient balance. Required: ₹${amount}, Available: ₹${user.wallet.balance}`,
        };
      }

      const debit = await this.debitInSession(
        session, user, amount, category, paymentMethod, description, metadata,
      );

      logger.info(`💳 Payment: ${user.name} -₹${amount} [${category}] (+${debit.rewardPoints} pts) — Balance: ₹${debit.balanceAfter}`);

      return {
        success: true,
        userId: user.userId,
        transactionId: debit.transactionId,
        newBalance: debit.balanceAfter,
        rewardPoints: debit.rewardPoints,
        message: `Payment of ₹${amount} successful`,
      };
    });
  }

  /**
   * Generic wallet debit for in-app financial actions (bills, investing,
   * insurance premiums, loan EMIs, recharges, UPI, etc). Persists the balance
   * change to MongoDB so it is the single source of truth shared by the mobile
   * webapp and the physical kiosk. Runs inside a transaction and records a
   * matching Transaction document.
   */
  async debit(
    userId: string,
    amount: number,
    category: unknown,
    description: string = '',
  ): Promise<{ success: boolean; newBalance: number; transactionId?: string; rewardPoints?: number; message: string }> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Invalid debit amount');
    }
    const cat = normalizeCategory(category);

    return runInTransaction(async (session) => {
      const query = User.findOne({ userId });
      if (session) query.session(session);
      const user = await query;
      if (!user) throw new Error('User not found');

      if (user.wallet.balance < amount) {
        return {
          success: false,
          newBalance: user.wallet.balance,
          message: `Insufficient balance. Required: ₹${amount}, Available: ₹${user.wallet.balance}`,
        };
      }

      const balanceBefore = user.wallet.balance;
      user.wallet.balance -= amount;
      user.transactionCount += 1;

      const rewardPoints = Math.floor(amount / env.LOYALTY_POINTS_RATIO);
      user.loyaltyPoints += rewardPoints;
      user.memberTier = recalcTier(user.loyaltyPoints);
      await user.save({ session: session ?? undefined });

      const transactionId = `txn_${Date.now()}_${uuidv4().substring(0, 8)}`;
      await Transaction.create([{
        transactionId,
        userId: user.userId,
        cardUid: user.cardUid,
        type: 'DEBIT',
        category: cat,
        amount,
        balanceBefore,
        balanceAfter: user.wallet.balance,
        description,
        paymentMethod: 'WALLET',
        rewardPoints,
        status: 'COMPLETED',
      }], { session: session ?? undefined });

      logger.info(`💸 Debit: ${user.name} -₹${amount} [${cat}] — Balance: ₹${user.wallet.balance}`);

      return {
        success: true,
        newBalance: user.wallet.balance,
        transactionId,
        rewardPoints,
        message: `₹${amount} debited`,
      };
    });
  }

  /**
   * Generic wallet credit for in-app financial actions (loan disbursal,
   * investment withdrawals, refunds). Persists to MongoDB inside a transaction.
   */
  async credit(
    userId: string,
    amount: number,
    category: unknown,
    description: string = '',
  ): Promise<{ success: boolean; newBalance: number; transactionId?: string; message: string }> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Invalid credit amount');
    }
    const cat = normalizeCategory(category);

    return runInTransaction(async (session) => {
      const query = User.findOne({ userId });
      if (session) query.session(session);
      const user = await query;
      if (!user) throw new Error('User not found');

      const balanceBefore = user.wallet.balance;
      user.wallet.balance += amount;
      user.transactionCount += 1;
      await user.save({ session: session ?? undefined });

      const transactionId = `txn_${Date.now()}_${uuidv4().substring(0, 8)}`;
      await Transaction.create([{
        transactionId,
        userId: user.userId,
        cardUid: user.cardUid,
        type: 'CREDIT',
        category: cat,
        amount,
        balanceBefore,
        balanceAfter: user.wallet.balance,
        description,
        paymentMethod: 'WALLET',
        rewardPoints: 0,
        status: 'COMPLETED',
      }], { session: session ?? undefined });

      logger.info(`💰 Credit: ${user.name} +₹${amount} [${cat}] — Balance: ₹${user.wallet.balance}`);

      return {
        success: true,
        newBalance: user.wallet.balance,
        transactionId,
        message: `₹${amount} credited`,
      };
    });
  }

  /**
   * Redeem loyalty points as payment (10 points = ₹1)
   */
  async redeemPoints(userId: string, pointsToRedeem: number, description: string = 'Points Redemption'): Promise<{
    success: boolean;
    pointsRedeemed: number;
    amountCredited: number;
    remainingPoints: number;
    message: string;
  }> {
    if (!Number.isInteger(pointsToRedeem) || pointsToRedeem <= 0) {
      throw new Error('Invalid points amount');
    }

    return runInTransaction(async (session) => {
      const query = User.findOne({ userId });
      if (session) query.session(session);
      const user = await query;
      if (!user) throw new Error('User not found');

      if (user.loyaltyPoints < pointsToRedeem) {
        return {
          success: false,
          pointsRedeemed: 0,
          amountCredited: 0,
          remainingPoints: user.loyaltyPoints,
          message: `Insufficient points. Available: ${user.loyaltyPoints}`,
        };
      }

      const amountCredited = pointsToRedeem / 10; // 10 points = ₹1
      const balanceBefore = user.wallet.balance;

      user.loyaltyPoints -= pointsToRedeem;
      user.wallet.balance += amountCredited;
      await user.save({ session: session ?? undefined });

      const transactionId = `txn_${Date.now()}_${uuidv4().substring(0, 8)}`;
      await Transaction.create([{
        transactionId,
        userId: user.userId,
        cardUid: user.cardUid,
        type: 'CREDIT',
        category: 'REWARD_REDEEM',
        amount: amountCredited,
        balanceBefore,
        balanceAfter: user.wallet.balance,
        description,
        paymentMethod: 'POINTS',
        rewardPoints: -pointsToRedeem,
        status: 'COMPLETED',
      }], { session: session ?? undefined });

      return {
        success: true,
        pointsRedeemed: pointsToRedeem,
        amountCredited,
        remainingPoints: user.loyaltyPoints,
        message: `Redeemed ${pointsToRedeem} points for ₹${amountCredited}`,
      };
    });
  }

  /**
   * Get transaction history for a user
   */
  async getTransactions(userId: string, limit: number = 20, offset: number = 0) {
    return Transaction.find({ userId })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();
  }

  /**
   * Update NFC card settings from the mobile app
   */
  async updateCardSetting(userId: string, setting: string, value: boolean | number) {
    const user = await User.findOne({ userId });
    if (!user) throw new Error('User not found');
    if (!user.isCardPaired) throw new Error('No RFID card linked yet');

    const settingMap: Record<string, keyof typeof user.card> = {
      isBlocked: 'isBlocked',
      internationalPayments: 'internationalUsage',
      onlineTransactions: 'domesticUsage',
      domesticUsage: 'domesticUsage',
      internationalUsage: 'internationalUsage',
      dailyLimit: 'dailyLimit',
      contactlessLimit: 'contactlessLimit',
    };

    const field = settingMap[setting];
    if (!field) throw new Error('Invalid card setting');

    if (typeof value === 'boolean') {
      (user.card as any)[field] = value;
    } else if (typeof value === 'number' && value > 0) {
      (user.card as any)[field] = value;
    } else {
      throw new Error('Invalid setting value');
    }

    await user.save();
    logger.info(`💳 Card setting updated for ${user.name}: ${setting}=${value}`);

    return {
      cardUid: user.cardUid,
      isBlocked: user.card.isBlocked,
      domesticUsage: user.card.domesticUsage,
      internationalUsage: user.card.internationalUsage,
      dailyLimit: user.card.dailyLimit,
      contactlessLimit: user.card.contactlessLimit,
    };
  }

  /**
   * Find user by card UID (for RFID lookups)
   */
  async findByCardUid(cardUid: string): Promise<IUser | null> {
    return User.findOne({ ...cardUidQuery(cardUid), isCardPaired: true });
  }
}
