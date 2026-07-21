# Phase 2 — Transactional Integrity (Proof)

Goal: a money-moving request produces **exactly one** balance change and never a
partial write (debit without the matching ticket/cart/receipt, or vice versa).

## What changed (repo)

| Concern | Before | After |
| --- | --- | --- |
| Debit + record | `user.save()` then a separate `Transaction.create()` — a crash between them could debit with no record (or an orphan record) | `WalletService.debitInSession()` writes both inside one Mongo transaction (`runInTransaction`) — all-or-nothing |
| Composite payments (shop pay, transit book) | debit, then domain doc written separately | debit **and** cart/ticket write in the **same** transaction |
| Double-tap / retry | each tap = another charge | `Idempotency-Key` per attempt; replay returns the stored result, never re-charges |
| Balance check | read outside any transaction (TOCTOU) | re-read **inside** the transaction before debiting |
| Stuck `PENDING` carts / txns | lingered forever | `reversal.service` sweeps stale `PENDING` → `CANCELLED`/`FAILED` |

Key files: `backend/src/utils/db-transaction.ts`, `backend/src/utils/idempotency.ts`,
`backend/src/models/IdempotencyKey.ts`, `backend/src/services/wallet.service.ts`,
`backend/src/services/kiosk.service.ts`, `backend/src/services/reversal.service.ts`,
`mobile/public/kiosk/app.js` (per-attempt `Idempotency-Key`).

> Note: real ACID transactions require a replica set. **MongoDB Atlas is always a
> replica set, so production is fully atomic.** A standalone local `mongod` is not;
> `runInTransaction` detects that one case and runs a clearly-logged NON-ATOMIC
> fallback for dev only. To prove atomicity locally, use a single-node replica set
> (`mongod --replSet rs0` + `rs.initiate()`) or point at an Atlas dev cluster.

## Build check (already run)

```
cd backend && npm run build      # tsc, exit 0
node --check mobile/public/kiosk/app.js
```

## Test 1 — Idempotent double-tap (no double charge)

Pick a paired card with a known balance and a PENDING cart (`CART_ID`).

```bash
BASE=https://onelink-fkqd.onrender.com/api/v1
KEY=$(uuidgen)

# Same key twice (simulates a physical double-tap / retry)
curl -s -X POST $BASE/kiosk/shop/pay -H "Content-Type: application/json" \
  -H "Idempotency-Key: $KEY" -d '{"cardUid":"<UID>","cartId":"<CART_ID>"}'
curl -s -X POST $BASE/kiosk/shop/pay -H "Content-Type: application/json" \
  -H "Idempotency-Key: $KEY" -d '{"cardUid":"<UID>","cartId":"<CART_ID>"}'
```

Expected: first call `success:true` with a `transactionId`; second call returns the
**same** payload (served from the idempotency store). Wallet balance drops **once**.

Record here after running:
- Balance before: `____`
- Balance after both calls: `____`  (must equal before − cart total, once)
- transactionId call 1: `____`  / call 2: `____`  (identical)

## Test 2 — Atomicity (crash mid-payment leaves no partial state)

On a replica-set/Atlas dev DB, add a temporary `throw` after the debit but before
the cart write inside `_payShopCart`, then attempt a payment. Expected: transaction
aborts, balance **unchanged**, cart still `PENDING`, no `Transaction` row created.
Remove the temporary throw afterwards.

Record: balance unchanged? `____`  cart still PENDING? `____`  txn rows added? `____`

## Test 3 — Stale-pending reversal sweep

```bash
# From backend/ with a DB configured:
node -e "import('./dist/services/reversal.service.js').then(m=>m.sweepStalePending().then(r=>{console.log(r);process.exit(0)}))"
```

Create a PENDING cart with `createdAt` older than `STALE_CART_MINUTES` (default 30),
run the sweep, confirm it becomes `CANCELLED` and is logged.

Record: cartsCancelled `____`  transactionsFailed `____`

## Test 4 — Insufficient balance (regression guard from prior fix)

Tap a card whose balance < amount. Expected: `success:false`, message contains
"Insufficient balance", **no** debit, **no** ticket/cart/receipt created.

---

## Measured Results (automated, in-memory replica set)

Executed via `npm run verify:db` (harness: `backend/scripts/verify_phase2_db.cjs`).
The harness boots an ephemeral **MongoDB replica set** (`mongodb-memory-server-core`,
dev-only; the `-core` variant has no install-time binary download, so it never
affects production/CI builds) so real multi-document transactions run — the same
code path as Atlas — and drives the **actual compiled services** in `backend/dist`.

**Date:** 2026-07-12 · **Result: 6/6 PASS**

| # | Test | Measured result | Pass |
|---|------|-----------------|------|
| 1 | Insufficient balance (₹13,300 on ₹4,935) | `success=false`, balance 4935→**4935** (unchanged), **0** transaction rows, msg "Insufficient balance. Required: ₹13300, Available: ₹4935" | ✅ |
| 2 | Atomic debit (₹250 metro on ₹1000) | `success=true`, balance→**750**, **1** transaction row, amount=250 | ✅ |
| 3 | Rollback on mid-flight crash | threw=true, balance stayed **2000** (no debit applied), **0** orphan transaction rows | ✅ |
| 4 | Idempotent double-tap shop pay (same key) | 2nd call replayed from store, **same** transactionId, balance→**700** (charged once), **1** debit row | ✅ |
| 5 | Concurrent double-tap (parallel, same key) | **1** success, balance→**600** (charged once), **1** debit row; loser blocked ("Duplicate in-flight request blocked") | ✅ |
| 6 | Reversal sweep | 60-min-old cart → **CANCELLED**, fresh cart → **PENDING** (untouched), cartsCancelled=1 | ✅ |

**Interpretation:** The original ₹13,300 incident is now impossible (Test 1), a
crash cannot leave a partial debit (Test 3), and neither sequential nor concurrent
double-taps can double-charge (Tests 4–5).

> Reproduce: `cd backend && npm run verify:db`
