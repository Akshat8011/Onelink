import { getDb } from '../../../lib/mongodb';
import {
  normalizeCardUid,
  normalizePairingToken,
  clearPendingLink,
} from '../../../lib/kiosk-shared';

function jsonResponse(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
  });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400);
  }

  const pairingToken = normalizePairingToken(body?.pairingToken ?? body?.dashboardCode);
  const cardUid = normalizeCardUid(body?.cardUid ?? '');

  if (!pairingToken) {
    return jsonResponse({ success: false, error: 'Invalid pairing code (expected 10 digits)' }, 400);
  }
  if (!cardUid) {
    return jsonResponse({ success: false, error: 'Invalid or missing cardUid' }, 400);
  }

  try {
    const db = await getDb();
    const users = db.collection('users');

    const user = await users.findOne({ pairingToken });
    if (!user) {
      return jsonResponse({ success: false, error: 'Invalid pairing code' }, 404);
    }

    if (user.isCardPaired && !String(user.cardUid).startsWith('UNPAIRED_')) {
      return jsonResponse({ success: false, error: 'This account already has a linked card' }, 409);
    }

    if (user.pairingTokenExpiresAt && new Date(user.pairingTokenExpiresAt) < new Date()) {
      return jsonResponse(
        { success: false, error: 'Pairing code expired. Generate a new one in the app.' },
        410,
      );
    }

    const existingCard = await users.findOne({
      cardUid,
      isCardPaired: true,
      userId: { $ne: user.userId },
    });
    if (existingCard) {
      return jsonResponse({ success: false, error: 'This card is already linked to another account' }, 409);
    }

    const last4 = cardUid.slice(-4);
    await users.updateOne(
      { userId: user.userId },
      {
        $set: {
          cardUid,
          isCardPaired: true,
          pairingToken: null,
          pairingTokenExpiresAt: null,
          'card.cardNumber': `****-****-****-${last4}`,
          updatedAt: new Date(),
        },
      },
    );

    await clearPendingLink(db, cardUid);

    return jsonResponse({
      success: true,
      userId: user.userId,
      name: user.name,
      cardUid,
      balance: user.wallet?.balance ?? 0,
      message: `Card linked to ${user.name}`,
    });
  } catch (err) {
    console.error('[pair-card] Unexpected error:', err);
    return jsonResponse({ success: false, error: 'Card pairing failed' }, 500);
  }
}

export async function GET() {
  return jsonResponse({ success: false, error: 'Method not allowed. Use POST.' }, 405);
}
