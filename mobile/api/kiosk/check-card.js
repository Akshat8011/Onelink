/**
 * POST /api/kiosk/check-card
 * Check if a tapped RFID card is registered. Stores unpaired taps in pending_links.
 * Body: { "cardUid": "72706D05", "terminalId": "main_kiosk" }
 */

const { getDb } = require('../../lib/mongodb');
const {
  TERMINAL_CONFIG,
  normalizeCardUid,
  upsertPendingLink,
  findRegisteredUser,
} = require('../../lib/kiosk-shared');

function jsonResponse(res, body, status = 200) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  res.status(status).json(body);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return jsonResponse(res, { success: false, error: 'Method not allowed. Use POST.' }, 405);
  }

  const cardUid = normalizeCardUid(req.body?.cardUid ?? req.body?.uid ?? '');
  const terminalId = req.body?.terminalId ?? req.body?.node ?? 'main_kiosk';

  if (!cardUid) {
    return jsonResponse(res, { success: false, error: 'Invalid or missing cardUid' }, 400);
  }

  try {
    const db = await getDb();
    const users = db.collection('users');
    const user = await findRegisteredUser(users, cardUid);

    if (!user) {
      await upsertPendingLink(db, cardUid, terminalId);
      return jsonResponse(res, {
        success: true,
        registered: false,
        pairingRequired: true,
        cardUid,
        message: 'Card not registered. Enter your 10-digit pairing code.',
      });
    }

    if (user.card?.isBlocked) {
      return jsonResponse(res, {
        success: true,
        registered: true,
        blocked: true,
        cardUid,
        error: 'Card is blocked',
      });
    }

    return jsonResponse(res, {
      success: true,
      registered: true,
      pairingRequired: false,
      cardUid,
      userId: user.userId,
      name: user.name,
      balance: user.wallet?.balance ?? 0,
      currency: user.wallet?.currency || 'INR',
      services: Object.entries(TERMINAL_CONFIG).map(([id, cfg]) => ({
        id,
        label: cfg.label,
        amount: cfg.amount,
        category: cfg.category,
      })),
    });
  } catch (err) {
    console.error('[check-card] Unexpected error:', err);
    return jsonResponse(res, { success: false, error: 'Could not verify card' }, 500);
  }
};
