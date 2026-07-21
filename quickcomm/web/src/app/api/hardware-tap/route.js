/**
 * POST /api/hardware-tap
 *
 * Edge gateway (Raspberry Pi) relay endpoint for ESP32 RFID taps.
 * Body: { "cardUid": "A1B2C3D4", "terminalId": "metro_entry" }
 *
 * Security: set HARDWARE_TAP_API_KEY in Vercel and send
 *   Authorization: Bearer <HARDWARE_TAP_API_KEY>
 * from the Pi relay script.
 */

import { randomBytes } from 'crypto';
import { getDb, getMongoClient } from '../../../lib/mongodb';

/** @type {Record<string, { amount: number; category: string; description: string }>} */
const TERMINAL_CONFIG = {
  main_kiosk: {
    amount: 50,
    category: 'SHOPPING',
    description: 'Main kiosk payment',
  },
  metro_entry: {
    amount: 20,
    category: 'METRO',
    description: 'Metro entry fare',
  },
};

const ALLOWED_TERMINALS = Object.keys(TERMINAL_CONFIG);

/** RFID UID: 4–16 hex chars (with or without separators). */
const CARD_UID_PATTERN = /^[0-9A-F]{4,16}$/;

const TERMINAL_ID_PATTERN = /^[a-z][a-z0-9_]{2,31}$/;

function jsonResponse(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
    },
  });
}

/**
 * @param {Request} request
 */
function authorizeGateway(request) {
  const expected = process.env.HARDWARE_TAP_API_KEY;
  if (!expected) {
    console.error('[hardware-tap] HARDWARE_TAP_API_KEY is not configured');
    return { ok: false, status: 503, message: 'Hardware tap endpoint is not configured' };
  }

  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : request.headers.get('x-hardware-api-key');

  if (!token || token !== expected) {
    return { ok: false, status: 401, message: 'Unauthorized gateway request' };
  }

  return { ok: true };
}

/**
 * Normalize RFID UID from ESP32 (uppercase hex, strip separators).
 * @param {unknown} raw
 */
function normalizeCardUid(raw) {
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim().toUpperCase().replace(/[^0-9A-F]/g, '');
  if (!CARD_UID_PATTERN.test(normalized)) return null;
  return normalized;
}

/**
 * @param {unknown} raw
 */
function normalizeTerminalId(raw) {
  if (typeof raw !== 'string') return null;
  const id = raw.trim().toLowerCase();
  if (!TERMINAL_ID_PATTERN.test(id) || !ALLOWED_TERMINALS.includes(id)) return null;
  return id;
}

/**
 * @param {unknown} body
 */
function parseBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object' };
  }

  const cardUid = normalizeCardUid(body.cardUid ?? body.uid);
  const terminalId = normalizeTerminalId(body.terminalId ?? body.node);

  if (!cardUid) {
    return { error: 'Invalid or missing cardUid (expected 4–16 hex RFID UID)' };
  }
  if (!terminalId) {
    return {
      error: `Invalid or missing terminalId. Allowed values: ${ALLOWED_TERMINALS.join(', ')}`,
    };
  }

  return { cardUid, terminalId };
}

function buildTransactionId() {
  return `TXN_${Date.now()}_${randomBytes(4).toString('hex').toUpperCase()}`;
}

/**
 * @param {import('mongodb').Collection} users
 * @param {string} cardUid
 */
async function findUserByCardUid(users, cardUid) {
  return users.findOne({
    $or: [{ cardUid }, { rfidUid: cardUid }],
  });
}

/**
 * @param {Request} request
 */
export async function POST(request) {
  const auth = authorizeGateway(request);
  if (!auth.ok) {
    return jsonResponse({ success: false, error: auth.message }, auth.status);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400);
  }

  const parsed = parseBody(body);
  if (parsed.error) {
    return jsonResponse({ success: false, error: parsed.error }, 400);
  }

  const { cardUid, terminalId } = parsed;
  const terminal = TERMINAL_CONFIG[terminalId];
  const chargeAmount = terminal.amount;

  const client = await getMongoClient();
  const session = client.startSession();

  try {
    const db = await getDb();
    const users = db.collection('users');
    const transactions = db.collection('transactions');

    /** @type {{ user: import('mongodb').Document; transaction: import('mongodb').Document } | null} */
    let outcome = null;

    await session.withTransaction(async () => {
      const updatedUser = await users.findOneAndUpdate(
        {
          $or: [{ cardUid }, { rfidUid: cardUid }],
          isCardPaired: { $ne: false },
          'card.isBlocked': { $ne: true },
          'wallet.balance': { $gte: chargeAmount },
        },
        {
          $inc: {
            'wallet.balance': -chargeAmount,
            transactionCount: 1,
          },
          $set: { updatedAt: new Date() },
        },
        { session, returnDocument: 'after' },
      );

      if (!updatedUser) {
        const existing = await findUserByCardUid(users, cardUid);
        if (!existing) {
          throw Object.assign(new Error('CARD_NOT_FOUND'), { code: 'CARD_NOT_FOUND' });
        }
        if (existing.card?.isBlocked) {
          throw Object.assign(new Error('CARD_BLOCKED'), { code: 'CARD_BLOCKED' });
        }
        if (existing.isCardPaired === false) {
          throw Object.assign(new Error('CARD_NOT_PAIRED'), { code: 'CARD_NOT_PAIRED' });
        }
        const balance = existing.wallet?.balance ?? 0;
        if (balance < chargeAmount) {
          throw Object.assign(new Error('INSUFFICIENT_BALANCE'), {
            code: 'INSUFFICIENT_BALANCE',
            balance,
          });
        }
        throw Object.assign(new Error('PAYMENT_FAILED'), { code: 'PAYMENT_FAILED' });
      }

      const balanceAfter = updatedUser.wallet?.balance ?? 0;
      const balanceBefore = balanceAfter + chargeAmount;
      const transactionId = buildTransactionId();
      const now = new Date();

      const transactionDoc = {
        transactionId,
        userId: updatedUser.userId,
        cardUid,
        type: 'DEBIT',
        category: terminal.category,
        amount: chargeAmount,
        currency: updatedUser.wallet?.currency || 'INR',
        balanceBefore,
        balanceAfter,
        description: terminal.description,
        merchantId: terminalId,
        paymentMethod: 'NFC',
        rewardPoints: 0,
        metadata: {
          terminalId,
          station: terminalId === 'metro_entry' ? 'Metro entry gate' : undefined,
        },
        status: 'COMPLETED',
        createdAt: now,
        updatedAt: now,
      };

      await transactions.insertOne(transactionDoc, { session });

      outcome = { user: updatedUser, transaction: transactionDoc };
    });

    if (!outcome) {
      return jsonResponse({ success: false, error: 'Payment could not be completed' }, 500);
    }

    const { user, transaction } = outcome;

    return jsonResponse({
      success: true,
      status: 'PAID',
      userId: user.userId,
      cardUid,
      terminalId,
      amount: chargeAmount,
      currency: transaction.currency,
      balanceBefore: transaction.balanceBefore,
      balanceAfter: transaction.balanceAfter,
      transactionId: transaction.transactionId,
      timestamp: transaction.createdAt.toISOString(),
    });
  } catch (err) {
    const code = err?.code || err?.message;

    if (code === 'CARD_NOT_FOUND') {
      return jsonResponse(
        { success: false, status: 'DENIED', error: 'Card UID not registered', cardUid },
        404,
      );
    }
    if (code === 'CARD_BLOCKED') {
      return jsonResponse(
        { success: false, status: 'DENIED', error: 'Card is blocked', cardUid },
        403,
      );
    }
    if (code === 'CARD_NOT_PAIRED') {
      return jsonResponse(
        { success: false, status: 'DENIED', error: 'Card is not paired to a user account', cardUid },
        403,
      );
    }
    if (code === 'INSUFFICIENT_BALANCE') {
      return jsonResponse(
        {
          success: false,
          status: 'DENIED',
          error: 'Insufficient wallet balance',
          cardUid,
          balance: err.balance ?? 0,
          required: chargeAmount,
        },
        402,
      );
    }

    console.error('[hardware-tap] Unexpected error:', err);
    return jsonResponse({ success: false, error: 'Internal server error' }, 500);
  } finally {
    await session.endSession();
  }
}

export async function GET() {
  return jsonResponse({ success: false, error: 'Method not allowed. Use POST.' }, 405);
}

export async function PUT() {
  return jsonResponse({ success: false, error: 'Method not allowed. Use POST.' }, 405);
}

export async function PATCH() {
  return jsonResponse({ success: false, error: 'Method not allowed. Use POST.' }, 405);
}

export async function DELETE() {
  return jsonResponse({ success: false, error: 'Method not allowed. Use POST.' }, 405);
}
