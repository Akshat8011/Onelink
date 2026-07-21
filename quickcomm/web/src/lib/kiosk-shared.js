const CARD_UID_PATTERN = /^[0-9A-F]{4,16}$/;

export const TERMINAL_CONFIG = {
  metro_entry: {
    amount: 20,
    category: 'METRO',
    label: 'Metro',
    description: 'Metro entry fare',
    color: 'blue',
  },
  main_kiosk: {
    amount: 50,
    category: 'SHOPPING',
    label: 'Shopping',
    description: 'Main kiosk payment',
    color: 'green',
  },
};

export function normalizeCardUid(raw) {
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim().toUpperCase().replace(/[^0-9A-F]/g, '');
  if (!CARD_UID_PATTERN.test(normalized)) return null;
  return normalized;
}

export function normalizePairingToken(raw) {
  if (raw == null) return null;
  const token = String(raw).trim().replace(/\D/g, '');
  if (token.length !== 10) return null;
  return token;
}

export async function upsertPendingLink(db, cardUid, terminalId) {
  const pendingLinks = db.collection('pending_links');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

  await pendingLinks.updateOne(
    { cardUid },
    {
      $set: { cardUid, terminalId: terminalId || 'main_kiosk', updatedAt: now, expiresAt },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
}

export async function clearPendingLink(db, cardUid) {
  await db.collection('pending_links').deleteOne({ cardUid });
}

export async function findRegisteredUser(users, cardUid) {
  const user = await users.findOne({
    $or: [{ cardUid }, { rfidUid: cardUid }],
  });

  if (!user) return null;
  if (user.isCardPaired === false) return null;
  if (String(user.cardUid).startsWith('UNPAIRED_')) return null;
  return user;
}
