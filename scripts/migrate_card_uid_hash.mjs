#!/usr/bin/env node
/**
 * Phase 3 migration: backfill `cardUidHash` for existing paired users.
 *
 * The backend now looks users up by an HMAC of the card UID (with a fallback to
 * the legacy plaintext during this migration window). This script computes that
 * HMAC for every already-paired user that does not yet have one, so lookups can
 * eventually stop relying on the plaintext value.
 *
 * SAFETY:
 *   - Dry-run by default. It only reports what it WOULD change.
 *   - Pass --commit to actually write.
 *   - It never deletes or overwrites the plaintext `cardUid`.
 *   - Re-runnable (idempotent): rows that already have a matching hash are skipped.
 *
 * USAGE (run from the repo root, with backend deps installed):
 *   MONGODB_URI="<atlas uri>" \
 *   CARD_UID_HMAC_SECRET="<same secret as backend>" \
 *   node scripts/migrate_card_uid_hash.mjs            # dry run
 *   node scripts/migrate_card_uid_hash.mjs --commit   # apply
 *
 * The secret MUST match the backend's (CARD_UID_HMAC_SECRET, or JWT_SECRET if
 * that is unset) or lookups will not match after migration.
 */

import crypto from 'node:crypto';
import mongoose from 'mongoose';

const COMMIT = process.argv.includes('--commit');
const MONGODB_URI = process.env.MONGODB_URI;
const SECRET = process.env.CARD_UID_HMAC_SECRET || process.env.JWT_SECRET;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is required.');
  process.exit(1);
}
if (!SECRET) {
  console.error('❌ CARD_UID_HMAC_SECRET (or JWT_SECRET) is required and must match the backend.');
  process.exit(1);
}

const normalize = (uid) => (uid ?? '').toString().trim().toUpperCase();
const hashCardUid = (uid) =>
  crypto.createHmac('sha256', SECRET).update(normalize(uid)).digest('hex');

function isPairableUid(uid) {
  return typeof uid === 'string' && uid.length > 0 && !uid.startsWith('UNPAIRED_');
}

async function main() {
  console.log(`\n🔐 Card UID hash migration — mode: ${COMMIT ? 'COMMIT' : 'DRY RUN'}`);
  await mongoose.connect(MONGODB_URI);
  const users = mongoose.connection.collection('users');

  const cursor = users.find({ isCardPaired: true });
  let scanned = 0;
  let toUpdate = 0;
  let updated = 0;
  let skipped = 0;

  for await (const user of cursor) {
    scanned += 1;
    if (!isPairableUid(user.cardUid)) {
      skipped += 1;
      continue;
    }
    const expected = hashCardUid(user.cardUid);
    if (user.cardUidHash === expected) {
      skipped += 1;
      continue;
    }
    toUpdate += 1;
    console.log(`  • ${user.userId ?? user._id} (${user.name ?? 'unknown'}) → set cardUidHash`);
    if (COMMIT) {
      await users.updateOne({ _id: user._id }, { $set: { cardUidHash: expected } });
      updated += 1;
    }
  }

  console.log('\n── Summary ─────────────────────────────');
  console.log(`  scanned paired users : ${scanned}`);
  console.log(`  needing hash         : ${toUpdate}`);
  console.log(`  updated              : ${COMMIT ? updated : 0}`);
  console.log(`  skipped (ok/unpaired): ${skipped}`);
  if (!COMMIT && toUpdate > 0) {
    console.log('\n  Dry run only. Re-run with --commit to apply.');
  }
  console.log('────────────────────────────────────────\n');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
