import { IdempotencyKey } from '../models/IdempotencyKey.js';
import { logger } from './logger.js';

/** An IN_PROGRESS record older than this is treated as abandoned (crashed mid-flight). */
const STALE_IN_PROGRESS_MS = 90 * 1000;

const DUPLICATE_KEY_CODE = 11000;

/**
 * Guarantees a money-moving operation runs at most once per `rawKey`.
 *
 * - First call with a key: records IN_PROGRESS, runs `fn`, stores the result.
 * - Replay after completion: returns the stored result (no second charge).
 * - Replay while the first is still running: returns a safe "already processing"
 *   response instead of double-charging.
 * - If `rawKey` is empty, dedup is skipped and `fn` runs normally.
 *
 * `fn` must return a JSON-serializable object (it is persisted and replayed).
 */
export async function withIdempotency<
  T extends Record<string, unknown>,
  D extends Record<string, unknown>,
>(
  rawKey: string | undefined | null,
  scope: string,
  fn: () => Promise<T>,
  duplicateResponse: D,
): Promise<T | D> {
  const trimmed = (rawKey ?? '').toString().trim();
  if (!trimmed) {
    return fn();
  }

  const key = `${scope}:${trimmed}`;

  try {
    await IdempotencyKey.create({ key, scope, status: 'IN_PROGRESS', response: null });
  } catch (err) {
    if ((err as { code?: number })?.code === DUPLICATE_KEY_CODE) {
      return handleReplay(key, fn, duplicateResponse);
    }
    throw err;
  }

  // We own the key — execute the real operation.
  try {
    const result = await fn();
    await IdempotencyKey.updateOne({ key }, { status: 'COMPLETED', response: result });
    return result;
  } catch (err) {
    // Failed before completing — release the key so a genuine retry can proceed.
    await IdempotencyKey.deleteOne({ key }).catch(() => undefined);
    throw err;
  }
}

async function handleReplay<
  T extends Record<string, unknown>,
  D extends Record<string, unknown>,
>(
  key: string,
  fn: () => Promise<T>,
  duplicateResponse: D,
): Promise<T | D> {
  const existing = await IdempotencyKey.findOne({ key });

  if (existing?.status === 'COMPLETED' && existing.response) {
    logger.info(`♻️ Idempotent replay served from store: ${key}`);
    return existing.response as T;
  }

  if (existing) {
    const age = Date.now() - new Date(existing.createdAt).getTime();
    if (age > STALE_IN_PROGRESS_MS) {
      // Prior attempt crashed mid-flight — reclaim and re-run.
      logger.warn(`⏳ Reclaiming stale in-progress idempotency key: ${key}`);
      await IdempotencyKey.updateOne(
        { key },
        { status: 'IN_PROGRESS', response: null, createdAt: new Date() },
      );
      try {
        const result = await fn();
        await IdempotencyKey.updateOne({ key }, { status: 'COMPLETED', response: result });
        return result;
      } catch (err) {
        await IdempotencyKey.deleteOne({ key }).catch(() => undefined);
        throw err;
      }
    }
  }

  logger.warn(`🛑 Duplicate in-flight request blocked: ${key}`);
  return duplicateResponse;
}
