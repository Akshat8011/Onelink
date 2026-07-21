import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export const connectDatabase = async (): Promise<void> => {
  try {
    const options: mongoose.ConnectOptions = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(env.MONGODB_URI, options);
    logger.info('✅ MongoDB Atlas connected successfully');

    await ensurePartialUniqueIndexes();
    await ensureUsersHaveTwoBanks();

    mongoose.connection.on('error', (err) => {
      logger.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('⚠️ MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('✅ MongoDB reconnected successfully');
    });

  } catch (error) {
    logger.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};

/**
 * Reconcile the unique indexes on nullable fields (`pairingToken`, `cardUidHash`).
 *
 * These were historically created as `unique + sparse`. That is a trap: a
 * `sparse` index still indexes documents whose field is explicitly `null` — it
 * only skips documents where the field is entirely ABSENT. Because the schema
 * defaults both fields to `null`, every new/unpaired user stores an explicit
 * null, so the SECOND such insert violated the unique index (E11000) and made
 * registration fail with a 500 (and broke card pairing/relinking).
 *
 * The fix is a PARTIAL index that only enforces uniqueness on real string
 * values (`{ $type: 'string' }`), so any number of nulls coexist. We drop the
 * old index if it isn't already partial and recreate it in the correct shape.
 */
const ensurePartialUniqueIndexes = async (): Promise<void> => {
  const targets: Array<{ field: string; name: string }> = [
    { field: 'pairingToken', name: 'pairingToken_1' },
    { field: 'cardUidHash', name: 'cardUidHash_1' },
  ];

  const users = mongoose.connection.collection('users');
  for (const { field, name } of targets) {
    try {
      const indexes = await users.indexes();
      const existing = indexes.find((i) => i.name === name);
      const isPartial = !!(existing && (existing as { partialFilterExpression?: unknown }).partialFilterExpression);
      if (existing && !isPartial) {
        await users.dropIndex(name);
        logger.info(`🔧 Dropped legacy ${name} index (was not partial)`);
      }
      await users.createIndex(
        { [field]: 1 },
        { unique: true, partialFilterExpression: { [field]: { $type: 'string' } }, name },
      );
      logger.info(`✅ ${name} index ensured (unique + partial on string values)`);
    } catch (err) {
      logger.warn(`⚠️ Could not reconcile ${name} index:`, err);
    }
  }
};

/**
 * Every user must hold two working bank accounts. Legacy accounts were seeded
 * with a single HDFC account, so back-fill anyone with fewer than two using
 * distinct banks from the catalog. Idempotent: users already holding two are
 * skipped, so this is safe to run on every startup.
 */
const ensureUsersHaveTwoBanks = async (): Promise<void> => {
  try {
    const { User } = await import('../models/User.js');
    const { BANK_CATALOG, buildLinkedBank } = await import('../utils/banks.js');

    const users = await User.find({
      $expr: { $lt: [{ $size: { $ifNull: ['$linkedBanks', []] } }, 2] },
    });
    if (!users.length) return;

    let patched = 0;
    for (const user of users) {
      if (!Array.isArray(user.linkedBanks)) user.linkedBanks = [];
      const have = new Set(user.linkedBanks.map((b) => b.bankName));
      const candidates = BANK_CATALOG.filter((b) => !have.has(b.bankName));

      while (user.linkedBanks.length < 2 && candidates.length) {
        const i = Math.floor(Math.random() * candidates.length);
        const pick = candidates.splice(i, 1)[0];
        user.linkedBanks.push(
          buildLinkedBank(pick.bankName, pick.ifsc, user.linkedBanks.length === 0),
        );
      }
      user.markModified('linkedBanks');
      await user.save();
      patched += 1;
    }
    logger.info(`🏦 Back-filled a second bank account for ${patched} user(s)`);
  } catch (err) {
    logger.warn('⚠️ Could not back-fill user bank accounts:', err);
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
};
