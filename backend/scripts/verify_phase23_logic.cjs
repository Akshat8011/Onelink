/**
 * Phase 2/3 pure-logic verification harness.
 *
 * Drives the ACTUAL COMPILED code in backend/dist (no mocks of the units under
 * test) to produce real, reproducible results for the pieces that do not need a
 * database: rate limiting, CORS allowlist, input validation, card-UID hashing.
 *
 * Run:  node scripts/verify_phase23_logic.cjs   (from backend/)
 * Exit code 0 = all assertions passed.
 */
'use strict';

const assert = require('assert');

const { rateLimit } = require('../dist/middleware/rateLimit.js');
const { validateBody } = require('../dist/middleware/validate.js');
const { isOriginAllowed } = require('../dist/config/cors.js');
const { hashCardUid, cardUidQuery, normalizeCardUid } = require('../dist/utils/cardUid.js');

const results = [];
function record(name, detail, pass) {
  results.push({ name, detail, pass });
  const tag = pass ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${name} — ${detail}`);
}

function mockReq(body, ip = '203.0.113.7') {
  return { body, headers: {}, ip, socket: { remoteAddress: ip } };
}
function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
  };
}

// ─── Test 1: Rate limiter — find the exact request index that first 429s ───
(function testRateLimit() {
  const limiter = rateLimit({ windowMs: 60_000, max: 30, name: 'test/check-card' });
  let first429 = null;
  let allowed = 0;
  for (let i = 1; i <= 35; i++) {
    const req = mockReq({}, '198.51.100.42');
    const res = mockRes();
    let nextCalled = false;
    limiter(req, res, () => { nextCalled = true; });
    if (nextCalled) allowed++;
    else if (first429 === null && res.statusCode === 429) first429 = i;
  }
  record(
    'RateLimit check-card (max 30/min)',
    `allowed=${allowed}, first 429 at request #${first429}`,
    allowed === 30 && first429 === 31,
  );
})();

// ─── Test 2: Rate limiter isolates different IPs ───
(function testRateLimitPerIp() {
  const limiter = rateLimit({ windowMs: 60_000, max: 10, name: 'test/login' });
  const fire = (ip) => {
    let blocked = 0;
    for (let i = 1; i <= 12; i++) {
      const res = mockRes();
      let ok = false;
      limiter(mockReq({}, ip), res, () => { ok = true; });
      if (!ok) blocked++;
    }
    return blocked;
  };
  const a = fire('10.0.0.1');
  const b = fire('10.0.0.2');
  record('RateLimit per-IP isolation (max 10)', `IP-A blocked=${a}, IP-B blocked=${b}`, a === 2 && b === 2);
})();

// ─── Test 3: Rate limiter emits 429 + Retry-After ───
(function testRateLimitHeaders() {
  const limiter = rateLimit({ windowMs: 60_000, max: 1, name: 'test/pair' });
  limiter(mockReq({}, '172.16.5.5'), mockRes(), () => {});
  const res = mockRes();
  limiter(mockReq({}, '172.16.5.5'), res, () => {});
  record(
    'RateLimit 429 response shape',
    `status=${res.statusCode}, retryAfter=${res.body && res.body.retryAfter}s, header=${res.headers['retry-after']}`,
    res.statusCode === 429 && !!res.headers['retry-after'] && res.body.error.includes('Too many'),
  );
})();

// ─── Test 4: CORS allowlist ───
(function testCors() {
  const cases = [
    ['https://onelink-wine-psi.vercel.app', true],
    ['https://onelink-abc123.vercel.app', true],
    ['https://my.digitalzen.app', true],
    ['http://localhost:8080', true],
    ['http://192.168.1.50:8080', true],
    ['http://10.0.0.9:8080', true],
    ['https://evil.example.com', false],
    ['https://onelink.attacker.com', false],
    ['https://vercel.app.evil.com', false],
  ];
  let ok = 0;
  const details = [];
  for (const [origin, expected] of cases) {
    const got = isOriginAllowed(origin);
    if (got === expected) ok++;
    else details.push(`${origin} expected ${expected} got ${got}`);
  }
  record('CORS allowlist', `${ok}/${cases.length} correct${details.length ? ' — ' + details.join('; ') : ''}`, ok === cases.length);
})();

// ─── Test 5: Input validation blocks NoSQL operator injection ───
(function testValidationInjection() {
  const mw = validateBody({ cardUid: { type: 'string', required: true, maxLen: 64 } });
  const res = mockRes();
  let nextCalled = false;
  mw(mockReq({ cardUid: { $ne: null } }), res, () => { nextCalled = true; });
  record(
    'Validation blocks {$ne:null} injection',
    `status=${res.statusCode}, error="${res.body && res.body.error}", nextCalled=${nextCalled}`,
    !nextCalled && res.statusCode === 400 && /must be a string/.test(res.body.error),
  );
})();

// ─── Test 6: Input validation passes valid, rejects missing/negative ───
(function testValidationRules() {
  const mw = validateBody({
    cardUid: { type: 'string', required: true, maxLen: 64 },
    subtotal: { type: 'number', min: 0 },
  });
  // valid
  let okNext = false;
  mw(mockReq({ cardUid: 'A1B2C3D4', subtotal: 100 }), mockRes(), () => { okNext = true; });
  // missing cardUid
  const r2 = mockRes(); let n2 = false;
  mw(mockReq({ subtotal: 100 }), r2, () => { n2 = true; });
  // negative subtotal
  const r3 = mockRes(); let n3 = false;
  mw(mockReq({ cardUid: 'X', subtotal: -5 }), r3, () => { n3 = true; });
  record(
    'Validation valid/missing/negative',
    `valid→next=${okNext}; missing→${r2.statusCode}; negative→${r3.statusCode}`,
    okNext && !n2 && r2.statusCode === 400 && !n3 && r3.statusCode === 400,
  );
})();

// ─── Test 7: Card UID HMAC — deterministic, keyed, normalized ───
(function testCardHash() {
  const h1 = hashCardUid('a1b2c3d4');
  const h2 = hashCardUid('A1B2C3D4');
  const h3 = hashCardUid('  A1B2C3D4  ');
  const hDiff = hashCardUid('FFFFFFFF');
  const isHex64 = /^[0-9a-f]{64}$/.test(h1);
  record(
    'Card UID HMAC-SHA256',
    `deterministic+normalized=${h1 === h2 && h2 === h3}, distinct=${h1 !== hDiff}, 64-hex=${isHex64}`,
    h1 === h2 && h2 === h3 && h1 !== hDiff && isHex64,
  );
})();

// ─── Test 8: Dual-read query shape ───
(function testDualRead() {
  const q = cardUidQuery('a1b2c3d4');
  const hasHash = q.$or && q.$or.some((c) => c.cardUidHash === hashCardUid('A1B2C3D4'));
  const hasPlain = q.$or && q.$or.some((c) => c.cardUid === 'A1B2C3D4');
  record(
    'Dual-read cardUidQuery',
    `matches hash=${hasHash} AND legacy plaintext=${hasPlain}`,
    hasHash && hasPlain && normalizeCardUid(' a1 ') === 'A1',
  );
})();

// ─── Summary ───
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) {
  console.error('FAILURES:', failed.map((f) => f.name).join(', '));
  process.exit(1);
}
console.log('ALL PURE-LOGIC CHECKS PASSED');
