import crypto from 'crypto';
import { env } from '../config/env.js';

/**
 * Card-UID privacy helpers (Phase 3).
 *
 * RFID UIDs used to be stored only in plaintext. We now also store an HMAC of
 * the UID (`cardUidHash`) so lookups can move off the raw value. During the
 * migration window we do a DUAL READ: match either the hash (new/migrated
 * rows) or the legacy plaintext (rows not yet backfilled). Once every row has a
 * hash (see scripts/migrate_card_uid_hash.mjs), plaintext storage can be
 * dropped in a follow-up change.
 */

export function normalizeCardUid(cardUid: string): string {
  return (cardUid ?? '').toString().trim().toUpperCase();
}

/** Keyed HMAC-SHA256 of the normalized UID. Keyed so a leaked DB is not brute-forceable. */
export function hashCardUid(cardUid: string): string {
  const secret = env.CARD_UID_HMAC_SECRET || env.JWT_SECRET;
  return crypto
    .createHmac('sha256', secret)
    .update(normalizeCardUid(cardUid))
    .digest('hex');
}

/**
 * Mongo query fragment that matches a card by hash OR legacy plaintext UID.
 * Spread into a larger filter, e.g. `{ ...cardUidQuery(uid), isCardPaired: true }`.
 */
export function cardUidQuery(cardUid: string): Record<string, unknown> {
  const normalized = normalizeCardUid(cardUid);
  return {
    $or: [
      { cardUidHash: hashCardUid(normalized) },
      { cardUid: normalized },
    ],
  };
}
