import { getDb } from '../../../../lib/mongodb';
import {
  TERMINAL_CONFIG,
  normalizeCardUid,
  upsertPendingLink,
  findRegisteredUser,
} from '../../../../lib/kiosk-shared';

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

  const cardUid = normalizeCardUid(body?.cardUid ?? body?.uid ?? '');
  const terminalId = body?.terminalId ?? body?.node ?? 'main_kiosk';

  if (!cardUid) {
    return jsonResponse({ success: false, error: 'Invalid or missing cardUid' }, 400);
  }

  try {
    const db = await getDb();
    const users = db.collection('users');
    const user = await findRegisteredUser(users, cardUid);

    if (!user) {
      await upsertPendingLink(db, cardUid, terminalId);
      return jsonResponse({
        success: true,
        registered: false,
        pairingRequired: true,
        cardUid,
        message: 'Card not registered. Enter your 10-digit pairing code.',
      });
    }

    if (user.card?.isBlocked) {
      return jsonResponse({
        success: true,
        registered: true,
        blocked: true,
        cardUid,
        error: 'Card is blocked',
      });
    }

    return jsonResponse({
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
    return jsonResponse({ success: false, error: 'Could not verify card' }, 500);
  }
}

export async function GET() {
  return jsonResponse({ success: false, error: 'Method not allowed. Use POST.' }, 405);
}
