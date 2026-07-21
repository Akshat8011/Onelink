/**
 * POST /api/pair-card
 * Link an RFID card to a user account via 10-digit pairing token (dashboard code).
 * Body: { "pairingToken": "1234567890", "cardUid": "72706D05" }
 */

const { getDb } = require('../lib/mongodb');
const {
  normalizeCardUid,
  normalizePairingToken,
  clearPendingLink,
} = require('../lib/kiosk-shared');
const { notifyBackend } = require('../lib/notify-backend');

function jsonResponse(res, body, status = 200) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  res.status(status).json(body);
}


module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return jsonResponse(res, { success: false, error: 'Method not allowed. Use POST.' }, 405);
  }

  const pairingToken = normalizePairingToken(req.body?.pairingToken ?? req.body?.dashboardCode);
  const cardUid = normalizeCardUid(req.body?.cardUid ?? '');

  if (!pairingToken) {
    return jsonResponse(res, { success: false, error: 'Invalid pairing code (expected 10 digits)' }, 400);
  }
  if (!cardUid) {
    return jsonResponse(res, { success: false, error: 'Invalid or missing cardUid' }, 400);
  }

  try {
    const db = await getDb();
    const users = db.collection('users');

    const user = await users.findOne({ pairingToken });
    if (!user) {
      return jsonResponse(res, { success: false, error: 'Invalid pairing code' }, 404);
    }

    if (user.isCardPaired && !String(user.cardUid).startsWith('UNPAIRED_')) {
      return jsonResponse(res, { success: false, error: 'This account already has a linked card' }, 409);
    }

    if (user.pairingTokenExpiresAt && new Date(user.pairingTokenExpiresAt) < new Date()) {
      return jsonResponse(res, { success: false, error: 'Pairing code expired. Generate a new one in the app.' }, 410);
    }

    // Reclaim this card UID from any other account before linking. The cardUid
    // field has a UNIQUE index, so a stale/orphan record still holding this UID
    // (e.g. isCardPaired:false, which the old pre-check missed) would make the
    // link write throw a duplicate-key error (surfacing as a 500 "Card pairing
    // failed"). Releasing it first self-heals that state — possessing the valid
    // pairing code authorises claiming the card.
    const conflicts = await users
      .find({ cardUid, userId: { $ne: user.userId } })
      .project({ userId: 1 })
      .toArray();
    for (const c of conflicts) {
      await users.updateOne(
        { userId: c.userId },
        { $set: { cardUid: `UNPAIRED_${c.userId}`, isCardPaired: false, updatedAt: new Date() } },
      );
    }

    const last4 = cardUid.slice(-4);
    // ROOT CAUSE: the pairingToken unique index in Atlas is NOT sparse, so
    // setting the token to null on pairing collides with other already-paired
    // users whose token is also null (E11000). We can't drop/rebuild the index
    // from here (no DDL privilege), so instead of null we store a unique,
    // per-user "consumed" marker — it never matches a 10-digit code lookup and
    // can never collide, so pairing works regardless of the index definition.
    const consumedToken = `used_${user.userId}`;
    const linkUpdate = {
      $set: {
        cardUid,
        isCardPaired: true,
        pairingToken: consumedToken,
        pairingTokenExpiresAt: null,
        'card.cardNumber': `****-****-****-${last4}`,
        updatedAt: new Date(),
      },
    };
    try {
      await users.updateOne({ userId: user.userId }, linkUpdate);
    } catch (writeErr) {
      if (writeErr && writeErr.code === 11000 && writeErr.keyPattern && writeErr.keyPattern.cardUid) {
        // A race left a duplicate cardUid — release every other holder and retry.
        const stillConflicting = await users
          .find({ cardUid, userId: { $ne: user.userId } })
          .project({ userId: 1 })
          .toArray();
        for (const c of stillConflicting) {
          await users.updateOne(
            { userId: c.userId },
            { $set: { cardUid: `UNPAIRED_${c.userId}`, isCardPaired: false, updatedAt: new Date() } },
          );
        }
        await users.updateOne({ userId: user.userId }, linkUpdate);
      } else {
        throw writeErr;
      }
    }

    await clearPendingLink(db, cardUid);

    await notifyBackend({
      userId: user.userId,
      event: 'card:paired',
      data: { cardUid, message: `Card linked to ${user.name}` },
    });

    return jsonResponse(res, {
      success: true,
      userId: user.userId,
      name: user.name,
      cardUid,
      balance: user.wallet?.balance ?? 0,
      message: `Card linked to ${user.name}`,
    });
  } catch (err) {
    console.error('[pair-card] Unexpected error:', err);
    return jsonResponse(res, { success: false, error: 'Card pairing failed' }, 500);
  }
};
