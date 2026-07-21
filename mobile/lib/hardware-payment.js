const { randomBytes } = require('crypto');
const { getMongoClient, getDb } = require('./mongodb');
const { TERMINAL_CONFIG, normalizeCardUid } = require('./kiosk-shared');
const { notifyBackend } = require('./notify-backend');

const ALLOWED_TERMINALS = Object.keys(TERMINAL_CONFIG);
const TERMINAL_ID_PATTERN = /^[a-z][a-z0-9_]{2,31}$/;

function normalizeTerminalId(raw) {
  if (typeof raw !== 'string') return null;
  const id = raw.trim().toLowerCase();
  if (!TERMINAL_ID_PATTERN.test(id) || !ALLOWED_TERMINALS.includes(id)) return null;
  return id;
}

function buildTransactionId() {
  return `TXN_${Date.now()}_${randomBytes(4).toString('hex').toUpperCase()}`;
}

async function findUserByCardUid(users, cardUid) {
  return users.findOne({
    $or: [{ cardUid }, { rfidUid: cardUid }],
  });
}

async function processHardwareTap(rawCardUid, rawTerminalId) {
  const cardUid = normalizeCardUid(rawCardUid);
  const terminalId = normalizeTerminalId(rawTerminalId);

  if (!cardUid) {
    return { ok: false, status: 400, body: { success: false, error: 'Invalid or missing cardUid' } };
  }
  if (!terminalId) {
    return {
      ok: false,
      status: 400,
      body: {
        success: false,
        error: `Invalid terminalId. Allowed: ${ALLOWED_TERMINALS.join(', ')}`,
      },
    };
  }

  const terminal = TERMINAL_CONFIG[terminalId];
  const chargeAmount = terminal.amount;

  const client = await getMongoClient();
  const session = client.startSession();

  try {
    const db = await getDb();
    const users = db.collection('users');
    const transactions = db.collection('transactions');

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
          source: 'kiosk',
        },
        status: 'COMPLETED',
        createdAt: now,
        updatedAt: now,
      };

      await transactions.insertOne(transactionDoc, { session });
      outcome = { user: updatedUser, transaction: transactionDoc };
    });

    if (!outcome) {
      return { ok: false, status: 500, body: { success: false, error: 'Payment could not be completed' } };
    }

    const { user, transaction } = outcome;

    await notifyBackend({
      userId: user.userId,
      event: 'payment:receipt',
      data: {
        transactionId: transaction.transactionId,
        amount: chargeAmount,
        newBalance: transaction.balanceAfter,
        category: terminal.category,
        status: 'COMPLETED',
      },
    });

    return {
      ok: true,
      status: 200,
      body: {
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
      },
    };
  } catch (err) {
    const code = err?.code || err?.message;

    if (code === 'CARD_NOT_FOUND') {
      return {
        ok: false,
        status: 404,
        body: { success: false, status: 'DENIED', error: 'Card UID not registered', cardUid },
      };
    }
    if (code === 'CARD_BLOCKED') {
      return {
        ok: false,
        status: 403,
        body: { success: false, status: 'DENIED', error: 'Card is blocked', cardUid },
      };
    }
    if (code === 'CARD_NOT_PAIRED') {
      return {
        ok: false,
        status: 403,
        body: { success: false, status: 'DENIED', error: 'Card is not paired', cardUid },
      };
    }
    if (code === 'INSUFFICIENT_BALANCE') {
      return {
        ok: false,
        status: 402,
        body: {
          success: false,
          status: 'DENIED',
          error: 'Insufficient wallet balance',
          cardUid,
          balance: err.balance ?? 0,
          required: chargeAmount,
        },
      };
    }

    console.error('[hardware-payment] Unexpected error:', err);
    return { ok: false, status: 500, body: { success: false, error: 'Internal server error' } };
  } finally {
    await session.endSession();
  }
}

module.exports = { processHardwareTap, normalizeTerminalId };
