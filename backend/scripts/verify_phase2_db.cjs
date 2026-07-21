/**
 * Phase 2 DB-backed verification harness.
 *
 * Spins up an EPHEMERAL in-memory MongoDB REPLICA SET (via mongodb-memory-server)
 * so real multi-document transactions run — the same code path as MongoDB Atlas.
 * Drives the actual compiled services in backend/dist. Nothing is mocked except
 * the absence of Socket.IO (emits are no-ops).
 *
 * Run:  node scripts/verify_phase2_db.cjs   (from backend/)
 * Exit 0 = all assertions passed.
 */
'use strict';

const assert = require('assert');
const mongoose = require('mongoose');
// Use the -core package so `npm install` never auto-downloads the mongod binary
// (no postinstall). The binary is fetched lazily on first .create() below, so
// production/CI builds that never run this harness are unaffected.
const { MongoMemoryReplSet } = require('mongodb-memory-server-core');

const { WalletService } = require('../dist/services/wallet.service.js');
const { kioskService } = require('../dist/services/kiosk.service.js');
const { sweepStalePending } = require('../dist/services/reversal.service.js');
const { runInTransaction } = require('../dist/utils/db-transaction.js');
const { hashCardUid } = require('../dist/utils/cardUid.js');
const { User } = require('../dist/models/User.js');
const { Transaction } = require('../dist/models/Transaction.js');
const { KioskCart } = require('../dist/models/KioskCart.js');

const results = [];
function record(name, detail, pass) {
  results.push({ name, detail, pass });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name} — ${detail}`);
}

async function seedUser(over = {}) {
  const uid = over.cardUid || 'A1B2C3D4';
  const doc = {
    userId: over.userId || 'U_TEST_1',
    username: over.username || 'tester1',
    cardUid: uid,
    cardUidHash: hashCardUid(uid),
    isCardPaired: true,
    name: 'Test User',
    email: over.email || 'test1@example.com',
    passwordHash: 'x',
    card: {
      cardNumber: '****-****-****-1234',
      expiry: '12/30',
      cvvHash: 'x',
    },
    wallet: { balance: over.balance != null ? over.balance : 5000, currency: 'INR' },
    ...over,
  };
  return User.create(doc);
}

async function main() {
  console.log('Starting in-memory MongoDB replica set (first run downloads mongod)…');
  const replset = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replset.getUri();
  await mongoose.connect(uri, { dbName: 'onelink_test' });
  console.log('Connected to', uri, '\n');

  const wallet = new WalletService();

  // ── Test 1: Insufficient balance guard (the ₹13,300 / ₹4,935 incident) ──
  {
    await seedUser({ userId: 'U1', username: 'u1', email: 'u1@x.com', cardUid: 'CARD1', balance: 4935 });
    const before = (await User.findOne({ userId: 'U1' })).wallet.balance;
    const res = await wallet.processPayment('CARD1', 13300, 'SHOPPING', 'WALLET', 'incident repro');
    const after = (await User.findOne({ userId: 'U1' })).wallet.balance;
    const txns = await Transaction.countDocuments({ userId: 'U1' });
    record(
      'Insufficient balance blocked (₹13,300 on ₹4,935)',
      `success=${res.success}, balance ${before}→${after}, txnRows=${txns}, msg="${res.message}"`,
      res.success === false && after === 4935 && before === 4935 && txns === 0,
    );
  }

  // ── Test 2: Successful debit is atomic — exactly one balance change + one row ──
  {
    await seedUser({ userId: 'U2', username: 'u2', email: 'u2@x.com', cardUid: 'CARD2', balance: 1000 });
    const res = await wallet.processPayment('CARD2', 250, 'METRO', 'WALLET', 'fare');
    const after = (await User.findOne({ userId: 'U2' })).wallet.balance;
    const txns = await Transaction.find({ userId: 'U2' });
    record(
      'Atomic debit writes balance + Transaction together',
      `success=${res.success}, balance→${after}, txnRows=${txns.length}, debitAmt=${txns[0] && txns[0].amount}`,
      res.success === true && after === 750 && txns.length === 1 && txns[0].amount === 250,
    );
  }

  // ── Test 3: Transaction rollback — throw mid-transaction leaves NO partial write ──
  {
    await seedUser({ userId: 'U3', username: 'u3', email: 'u3@x.com', cardUid: 'CARD3', balance: 2000 });
    let threw = false;
    try {
      await runInTransaction(async (session) => {
        const u = await User.findOne({ userId: 'U3' }).session(session);
        u.wallet.balance -= 500;
        await u.save({ session });
        await Transaction.create([{
          transactionId: 'txn_rollback_test', userId: 'U3', cardUid: 'CARD3', type: 'DEBIT',
          category: 'SHOPPING', amount: 500, balanceBefore: 2000, balanceAfter: 1500, status: 'COMPLETED',
        }], { session });
        throw new Error('simulated crash after debit, before commit');
      });
    } catch (e) { threw = true; }
    const after = (await User.findOne({ userId: 'U3' })).wallet.balance;
    const orphan = await Transaction.countDocuments({ transactionId: 'txn_rollback_test' });
    record(
      'Transaction rollback on mid-flight crash',
      `threw=${threw}, balance stayed ${after} (expected 2000), orphanTxn=${orphan}`,
      threw && after === 2000 && orphan === 0,
    );
  }

  // ── Test 4: Idempotency — double shop-pay with same key charges ONCE ──
  {
    await seedUser({ userId: 'U4', username: 'u4', email: 'u4@x.com', cardUid: 'CARD4', balance: 1000 });
    await KioskCart.create({
      cartId: 'CART_X', userId: 'U4', items: [{ productId: 'p1', name: 'Milk', quantity: 1, price: 300 }],
      subtotal: 300, total: 300, status: 'PENDING',
    });
    const KEY = 'idem-key-abc-123';
    const r1 = await kioskService.payShopCart('CARD4', 'CART_X', KEY);
    const r2 = await kioskService.payShopCart('CARD4', 'CART_X', KEY);
    const after = (await User.findOne({ userId: 'U4' })).wallet.balance;
    const debits = await Transaction.countDocuments({ userId: 'U4', type: 'DEBIT' });
    record(
      'Idempotent double-tap shop pay',
      `r1.success=${r1.success}, r2 replay txnId==r1=${r2.transactionId === r1.transactionId}, balance→${after}, debitRows=${debits}`,
      r1.success === true && after === 700 && debits === 1 && r2.transactionId === r1.transactionId,
    );
  }

  // ── Test 5: Concurrent double-tap (parallel, same key) still charges ONCE ──
  {
    await seedUser({ userId: 'U5', username: 'u5', email: 'u5@x.com', cardUid: 'CARD5', balance: 1000 });
    await KioskCart.create({
      cartId: 'CART_Y', userId: 'U5', items: [{ productId: 'p2', name: 'Eggs', quantity: 1, price: 400 }],
      subtotal: 400, total: 400, status: 'PENDING',
    });
    const KEY = 'idem-key-parallel-9';
    const [a, b] = await Promise.all([
      kioskService.payShopCart('CARD5', 'CART_Y', KEY),
      kioskService.payShopCart('CARD5', 'CART_Y', KEY),
    ]);
    const after = (await User.findOne({ userId: 'U5' })).wallet.balance;
    const debits = await Transaction.countDocuments({ userId: 'U5', type: 'DEBIT' });
    const successes = [a, b].filter((r) => r.success).length;
    record(
      'Concurrent double-tap charges once',
      `successes=${successes}, balance→${after} (expected 600), debitRows=${debits}`,
      after === 600 && debits === 1,
    );
  }

  // ── Test 6: Reversal sweep cancels stale PENDING cart ──
  {
    await KioskCart.create({
      cartId: 'CART_STALE', userId: 'U6', items: [{ productId: 'p3', name: 'Old', quantity: 1, price: 50 }],
      subtotal: 50, total: 50, status: 'PENDING',
      createdAt: new Date(Date.now() - 60 * 60 * 1000), // 60 min old
    });
    await KioskCart.create({
      cartId: 'CART_FRESH', userId: 'U6', items: [{ productId: 'p4', name: 'New', quantity: 1, price: 60 }],
      subtotal: 60, total: 60, status: 'PENDING',
    });
    const res = await sweepStalePending();
    const stale = await KioskCart.findOne({ cartId: 'CART_STALE' });
    const fresh = await KioskCart.findOne({ cartId: 'CART_FRESH' });
    record(
      'Reversal sweep cancels stale PENDING cart only',
      `stale→${stale.status}, fresh→${fresh.status}, cartsCancelled=${res.cartsCancelled}`,
      stale.status === 'CANCELLED' && fresh.status === 'PENDING' && res.cartsCancelled >= 1,
    );
  }

  // ── Cleanup ──
  await mongoose.disconnect();
  await replset.stop();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} DB checks passed.`);
  if (failed.length) {
    console.error('FAILURES:', failed.map((f) => f.name).join(', '));
    process.exit(1);
  }
  console.log('ALL DB-BACKED CHECKS PASSED');
}

main().catch((err) => { console.error('Harness error:', err); process.exit(1); });
