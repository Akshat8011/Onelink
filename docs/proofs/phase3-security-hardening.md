# Phase 3 — Minimal Security Hardening (Proof)

Scope: make the existing system safer without new user-facing features.
Three items: rate limiting, card-UID hashing at rest, tightened CORS.
(Input validation was added alongside Phase 2 — see `middleware/validate.ts`.)

## 1. Rate limiting

`backend/src/middleware/rateLimit.ts` — in-memory fixed-window limiter, applied to
unauthenticated abuse-prone endpoints:

| Endpoint | Limit |
| --- | --- |
| `POST /api/v1/kiosk/check-card` | 30 / min / IP |
| `POST /api/v1/auth/pair-card` | 10 / min / IP (10-digit token — deters guessing) |
| `POST /api/v1/auth/login` | 20 / min / IP |

`app.set('trust proxy', 1)` was added so the real client IP is used behind
Render's proxy. Responses include `X-RateLimit-*` and, when throttled, `429` +
`Retry-After`.

> Scope limit: state is per-process. Fine for the current single-instance Render
> deploy; a shared store (Redis) is the follow-up if the backend is scaled out.

### Test

```bash
BASE=https://onelink-fkqd.onrender.com/api/v1
for i in $(seq 1 35); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST $BASE/kiosk/check-card \
    -H "Content-Type: application/json" -d '{"cardUid":"TESTUID"}'
done
```

Expected: first 30 → `200`, remainder → `429`. Record first-429 index: `____`

## 2. Card UID hashing at rest (dual-read migration)

`backend/src/utils/cardUid.ts` — keyed **HMAC-SHA256** of the normalized UID,
stored as `User.cardUidHash` (sparse+unique). All lookups now match
`{ $or: [{ cardUidHash }, { cardUid: plaintext }] }` (dual-read), and pairing
writes the hash. Config: `CARD_UID_HMAC_SECRET` (falls back to `JWT_SECRET`).

Rollout (safe, no downtime):
1. Deploy this branch. New/re-paired cards get a hash automatically; lookups keep
   working via the plaintext fallback.
2. Backfill existing rows (run against Atlas — **you** run it, not the agent):
   ```bash
   MONGODB_URI="<atlas>" CARD_UID_HMAC_SECRET="<secret>" \
     node scripts/migrate_card_uid_hash.mjs          # dry run
   node scripts/migrate_card_uid_hash.mjs --commit    # apply
   ```
3. Verify every paired user has `cardUidHash`. Only then plan the follow-up that
   stops storing plaintext `cardUid` (out of scope for this branch).

### Test
- Tap an existing paired card → still resolves (plaintext fallback). ✔ `____`
- Re-pair a card, inspect the user doc → `cardUidHash` populated. ✔ `____`
- After migration, tap works with `cardUidHash` present. ✔ `____`

## 3. CORS tightening

`backend/src/config/cors.ts` + `env.ts`.

Before: `SOCKET_CORS_ORIGIN` unset ⇒ **allow every origin** (with credentials).
After: allow-all requires an **explicit** `SOCKET_CORS_ORIGIN=*`. When unset, only
an allowlist is permitted:
- `*.digitalzen.app`, `onelink-wine-psi.vercel.app` + `onelink*.vercel.app`
  (project preview deploys), `localhost`/`127.0.0.1`, and private-LAN hosts (so a
  Pi-served kiosk on the local network still works).
Socket.IO now uses the same allowlist via a validator instead of a static array.

> Behaviour change — verify before merging to prod: confirm the origin the kiosk
> is actually served from is covered (LAN IP / vercel / digitalzen). If prod
> intentionally relied on allow-all, set `SOCKET_CORS_ORIGIN=*` explicitly.

### Test

```bash
BASE=https://onelink-fkqd.onrender.com
# Allowed
curl -s -o /dev/null -w "%{http_code}\n" -H "Origin: https://onelink-wine-psi.vercel.app" $BASE/health
# Disallowed origin — CORS headers should NOT reflect it
curl -s -D - -o /dev/null -H "Origin: https://evil.example.com" $BASE/health | grep -i access-control-allow-origin
```

Record: allowed origin reflected? `____`  evil origin blocked (no ACAO)? `____`

## 4. Input validation (added with Phase 2)

`backend/src/middleware/validate.ts` rejects malformed bodies with `400` and,
by enforcing `type:'string'` on identifiers, blocks NoSQL-operator injection
(e.g. `{"cardUid":{"$ne":null}}`).

### Test
```bash
curl -s -X POST $BASE/api/v1/kiosk/check-card -H "Content-Type: application/json" \
  -d '{"cardUid":{"$ne":null}}'
```
Expected: `400` with `cardUid must be a string`. Record: `____`

---

## Measured Results (automated, against compiled code)

Executed via `npm run verify:logic` (harness: `backend/scripts/verify_phase23_logic.cjs`).
Drives the **actual compiled middleware/utils** in `backend/dist` — no mocks of the
units under test. These are deterministic and need no database.

**Date:** 2026-07-12 · **Result: 8/8 PASS**

| # | Check | Measured result | Pass |
|---|-------|-----------------|------|
| 1 | Rate limit `check-card` (max 30/min) | 30 requests allowed; **first 429 at request #31** | ✅ |
| 2 | Rate limit per-IP isolation (max 10) | IP-A blocked 2, IP-B blocked 2 (independent buckets) | ✅ |
| 3 | 429 response shape | `status=429`, `retryAfter=60s`, `Retry-After` header=60, body "Too many requests" | ✅ |
| 4 | CORS allowlist | **9/9** origins classified correctly (vercel/digitalzen/localhost/LAN allowed; evil + lookalikes blocked) | ✅ |
| 5 | Validation blocks `{$ne:null}` injection | `status=400`, error "cardUid must be a string", `next()` NOT called | ✅ |
| 6 | Validation valid/missing/negative | valid→next; missing cardUid→400; negative subtotal→400 | ✅ |
| 7 | Card UID HMAC-SHA256 | deterministic + case/space-normalized; distinct inputs differ; 64-hex output | ✅ |
| 8 | Dual-read `cardUidQuery` | `$or` matches both hashed UID and legacy plaintext | ✅ |

**CORS cases proven** (Test 4): `onelink-wine-psi.vercel.app` ✓, `onelink-abc123.vercel.app` ✓,
`my.digitalzen.app` ✓, `localhost:8080` ✓, `192.168.1.50` ✓, `10.0.0.9` ✓ —
`evil.example.com` ✗, `onelink.attacker.com` ✗, `vercel.app.evil.com` ✗.

> Reproduce: `cd backend && npm run verify:logic`

### Card-UID migration & Pi hardware — still operator-run

- **Card-UID backfill** (`scripts/migrate_card_uid_hash.mjs`) needs the live Atlas
  URI + `CARD_UID_HMAC_SECRET`; run it during rollout (§2). Hashing/dual-read
  *logic* is proven above (Tests 7–8).
- **Phase 1 Pi recovery times** require the physical Raspberry Pi and are not
  measurable in this environment. Code-level checks done: `brain.py` compiles
  (`python -m py_compile`), kiosk client passes `node --check`. Runtime recovery
  seconds remain to be filled from a hardware run per `phase1-self-healing.md`.
