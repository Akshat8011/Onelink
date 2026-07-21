import mongoose, { ClientSession } from 'mongoose';
import { logger } from './logger.js';

/**
 * Run `fn` inside a MongoDB multi-document transaction.
 *
 * Production (MongoDB Atlas) always runs as a replica set, so real ACID
 * transactions are used — either the whole money-moving operation commits or
 * none of it does. This prevents "balance debited but domain record missing"
 * style partial writes.
 *
 * A standalone `mongod` (common on a dev laptop) does NOT support transactions
 * and throws an "IllegalOperation"/"Transaction numbers are only allowed on a
 * replica set" error. To keep local development runnable we detect that single
 * case and fall back to executing `fn` WITHOUT a session. The fallback is NOT
 * atomic and is only ever hit off-Atlas; it is logged loudly so it can never be
 * mistaken for the production path.
 */
export async function runInTransaction<T>(
  fn: (session: ClientSession | null) => Promise<T>,
): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result!;
  } catch (err) {
    if (isTransactionsUnsupported(err)) {
      logger.warn(
        '⚠️ MongoDB transactions unsupported (standalone server). ' +
          'Running NON-ATOMIC fallback — dev only, never on Atlas.',
      );
      return fn(null);
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

function isTransactionsUnsupported(err: unknown): boolean {
  const message = (err as Error)?.message ?? '';
  const code = (err as { code?: number })?.code;
  return (
    code === 20 || // IllegalOperation
    /Transaction numbers are only allowed/i.test(message) ||
    /transactions are not supported/i.test(message) ||
    /replica set/i.test(message)
  );
}
