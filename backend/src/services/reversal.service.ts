import { KioskCart } from '../models/KioskCart.js';
import { Transaction } from '../models/Transaction.js';
import { logger } from '../utils/logger.js';

/**
 * Reversal / cleanup sweeper (Phase 2).
 *
 * Money-moving operations are now atomic, so a debit can no longer be left
 * half-applied. What CAN linger is intent state that was never resolved:
 *  - a KioskCart pushed from the app that the user never paid (walked away);
 *  - a Transaction stuck in PENDING (defensive — the atomic path writes
 *    COMPLETED, but an older/interrupted write could leave one behind).
 *
 * This sweep cancels stale carts and fails stale pending transactions so the
 * system converges to a clean state instead of showing phantom "pending"
 * items forever. It never touches COMPLETED/PAID records, so it cannot reverse
 * a real payment.
 */

const STALE_CART_MINUTES = Number(process.env.STALE_CART_MINUTES ?? 30);
const STALE_TXN_MINUTES = Number(process.env.STALE_TXN_MINUTES ?? 15);
const SWEEP_INTERVAL_MS = Number(process.env.REVERSAL_SWEEP_INTERVAL_MS ?? 5 * 60 * 1000);

export interface SweepResult {
  cartsCancelled: number;
  transactionsFailed: number;
}

export async function sweepStalePending(now: Date = new Date()): Promise<SweepResult> {
  const cartCutoff = new Date(now.getTime() - STALE_CART_MINUTES * 60 * 1000);
  const txnCutoff = new Date(now.getTime() - STALE_TXN_MINUTES * 60 * 1000);

  const staleCarts = await KioskCart.find({
    status: 'PENDING',
    createdAt: { $lt: cartCutoff },
  }).select('cartId userId total createdAt');

  for (const cart of staleCarts) {
    logger.warn(
      `🧹 Cancelling stale PENDING cart ${cart.cartId} (user ${cart.userId}, ₹${cart.total}, created ${cart.createdAt.toISOString()})`,
    );
  }

  const cartResult = await KioskCart.updateMany(
    { status: 'PENDING', createdAt: { $lt: cartCutoff } },
    { $set: { status: 'CANCELLED' } },
  );

  const staleTxns = await Transaction.find({
    status: 'PENDING',
    createdAt: { $lt: txnCutoff },
  }).select('transactionId userId amount');

  for (const txn of staleTxns) {
    logger.warn(
      `🧹 Failing stale PENDING transaction ${txn.transactionId} (user ${txn.userId}, ₹${txn.amount})`,
    );
  }

  const txnResult = await Transaction.updateMany(
    { status: 'PENDING', createdAt: { $lt: txnCutoff } },
    { $set: { status: 'FAILED' } },
  );

  const result: SweepResult = {
    cartsCancelled: cartResult.modifiedCount ?? 0,
    transactionsFailed: txnResult.modifiedCount ?? 0,
  };

  if (result.cartsCancelled || result.transactionsFailed) {
    logger.info(
      `🧹 Reversal sweep: cancelled ${result.cartsCancelled} cart(s), failed ${result.transactionsFailed} transaction(s)`,
    );
  }

  return result;
}

let timer: NodeJS.Timeout | null = null;

/** Start the periodic sweeper. Safe to call once at startup. */
export function startReversalSweeper(): void {
  if (timer) return;
  // Run shortly after boot, then on a fixed interval.
  setTimeout(() => {
    sweepStalePending().catch((err) => logger.error('Reversal sweep failed:', err));
  }, 30 * 1000);
  timer = setInterval(() => {
    sweepStalePending().catch((err) => logger.error('Reversal sweep failed:', err));
  }, SWEEP_INTERVAL_MS);
  logger.info(`🧹 Reversal sweeper started (every ${Math.round(SWEEP_INTERVAL_MS / 1000)}s)`);
}

export function stopReversalSweeper(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
