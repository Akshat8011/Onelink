/**
 * OneLink Kiosk — Professional UI
 * Services: Shop · Transit · Parking
 * Optimized for Samsung 10.1" Display (1280x800)
 */

const BACKEND = 'https://onelink-fkqd.onrender.com/api/v1';
const VERCEL = 'https://onelink-wine-psi.vercel.app';
const WS_PORT = 8765;

// Default Pi reader hosts, tried in order when no explicit override connects.
// IMPORTANT: hostnames (mDNS/.local) survive the Pi's DHCP IP changing, so the
// kiosk keeps working without reconfiguration. Set the Pi's hostname to
// `onelink` (raspi-config → Hostname) so `onelink.local` always resolves.
// The raw IP is only a last-resort fallback for when mDNS is unavailable.
const DEFAULT_READER_HOSTS = ['onelink.local', 'raspberrypi.local', '10.20.253.171'];

// Weather API (free tier)
const WEATHER_API_KEY = ''; // Add your API key if you have one
const WEATHER_CITY = 'Lucknow';

function normalizeToWsUrl(reader) {
  if (/^wss?:\/\//i.test(reader)) return reader;
  return `ws://${reader.includes(':') ? reader : reader + ':' + WS_PORT}`;
}

// Ordered list of WebSocket URLs to try. Auto-failover cycles through these on
// each failed connect, so a stale/changed IP self-heals via the hostname entry.
function getReaderCandidates() {
  const list = [];
  const push = (url) => { if (url && list.indexOf(url) === -1) list.push(url); };

  // 1. Explicit override (?reader=<ip|host> or a saved value) — highest priority.
  const params = new URLSearchParams(location.search);
  let override = params.get('reader');
  if (override) { try { localStorage.setItem('onelink_reader', override); } catch {} }
  else { try { override = localStorage.getItem('onelink_reader'); } catch {} }
  if (override) push(normalizeToWsUrl(override));

  // 2. Last host that successfully connected (fast reconnect after a blip).
  try { const lg = localStorage.getItem('onelink_reader_lastgood'); if (lg) push(normalizeToWsUrl(lg)); } catch {}

  // 3. Same-origin Pi: when the kiosk is served over http from the Pi itself,
  //    reuse its hostname/IP so nothing needs configuring (also avoids the
  //    https→ws:// mixed-content block).
  if (location.protocol === 'http:' && location.hostname && location.hostname !== 'localhost') {
    push(`ws://${location.hostname}:${WS_PORT}`);
  }

  // 4. Built-in defaults (mDNS hostnames first, IP last).
  DEFAULT_READER_HOSTS.forEach((h) => push(normalizeToWsUrl(h)));

  // 5. Pi's own screen.
  push(`ws://127.0.0.1:${WS_PORT}`);
  return list;
}

let wsCandidates = getReaderCandidates();
let wsCandidateIdx = 0;
let mixedContentWarned = false;
function currentWsUrl() { return wsCandidates[wsCandidateIdx % wsCandidates.length]; }

// A kiosk page loaded over HTTPS cannot open an insecure ws:// socket (browser
// mixed-content policy) — this is the usual cause of "reader offline" no matter
// what IP is entered. Surface it clearly instead of silently failing forever.
function warnIfMixedContent() {
  if (mixedContentWarned) return;
  if (location.protocol === 'https:' && /^ws:\/\//i.test(currentWsUrl())) {
    mixedContentWarned = true;
    console.error(
      '[kiosk] Reader offline: this page is HTTPS but the Pi reader uses ws:// ' +
      '(insecure). Browsers block that. Open the kiosk over http from the Pi, e.g. ' +
      'http://onelink.local:8080/kiosk — then the reader connects automatically.'
    );
  }
}

// WebSocket reconnect backoff (cap 30s, reset on successful open)
let wsReconnectAttempt = 0;
let wsReconnectTimer = null;
const WS_RECONNECT_MIN_MS = 1000;
const WS_RECONNECT_MAX_MS = 30000;
let activeWs = null;
// After long idle, pause reader WS so we are not reconnecting forever while
// nobody is at the kiosk. Reconnect on the next touch / card event.
let wsIdlePaused = false;
let lastUserActivityAt = Date.now();
const WS_IDLE_DISCONNECT_MS = 12 * 60 * 1000;
let lastPredictiveWarmAt = 0;
const PREDICTIVE_WARM_THROTTLE_MS = 30000;

function noteUserActivity() {
  lastUserActivityAt = Date.now();
  if (wsIdlePaused) {
    wsIdlePaused = false;
    warmNow();
    connectWs();
  }
}

function disconnectWsForIdle() {
  wsIdlePaused = true;
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer);
    wsReconnectTimer = null;
  }
  if (activeWs) {
    try {
      activeWs.onclose = null; // prevent scheduleWsReconnect
      activeWs.close();
    } catch (_) { /* ignore */ }
    activeWs = null;
  }
  setState({ wsOk: false });
  console.info('[kiosk] Reader WS paused after idle (will reconnect on next touch)');
}

function configureReader() {
  const current = (() => { try { return localStorage.getItem('onelink_reader') || ''; } catch { return ''; } })();
  const val = window.prompt(
    'Enter the Pi reader address.\n' +
    'Tip: use a hostname so it survives IP changes, e.g. "onelink.local" ' +
    '(recommended). You can also use an IP like "10.20.253.171" or add a ' +
    'port "onelink.local:8765". Leave blank to auto-detect.',
    current,
  );
  if (val === null) return;
  const trimmed = val.trim();
  try {
    if (trimmed) localStorage.setItem('onelink_reader', trimmed);
    else localStorage.removeItem('onelink_reader');
    // Drop the cached last-good so the new value is honored immediately.
    localStorage.removeItem('onelink_reader_lastgood');
  } catch {}
  location.reload();
}

const state = {
  step: 'idle',
  wsOk: false,
  cardUid: null,
  userId: null,
  userName: null,
  balance: 0,
  loyaltyPoints: 0,
  memberTier: 'BRONZE',
  dailyLimit: 0,
  lastTopUp: null,
  cardBlocked: false,
  insufficientBalance: false,
  digits: '',
  error: null,
  resultMsg: null,
  service: null,
  stations: [],
  tickets: [],
  carts: [],
  spots: [],
  transitFrom: null,
  transitTo: null,
  transitFare: 0,
  selectedTicket: null,
  selectedCart: null,
  selectedSpot: null,
  activeParkingSpot: null,
  activeParking: null,
  parkingMode: 'view',
  awaitingTap: false,
  paymentKey: null,
  qrPayload: null,
  guideReturnStep: 'idle',
  weather: { temp: '--', desc: 'Loading...', icon: '☁️' },
  currentTime: new Date(),
  canteenMenu: [],
  canteenCategories: ['All', 'Meals', 'Snacks', 'Beverages', 'Desserts'],
  canteenCategory: 'Meals',
  canteenLocalCart: [],
  canteenCarts: [],
  selectedCanteenCart: null,
  canteenQueue: { nowServing: 0, orders: [] },
  lastCanteenOrder: null,
  canteenCollectOrderNumber: null,
};

// Update time every second
setInterval(() => {
  state.currentTime = new Date();
  updateTimeDisplay();
}, 1000);

function updateTimeDisplay() {
  const timeEl = document.getElementById('live-time');
  const dateEl = document.getElementById('live-date');
  if (timeEl) {
    timeEl.textContent = state.currentTime.toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  }
  if (dateEl) {
    dateEl.textContent = state.currentTime.toLocaleDateString('en-IN', { 
      weekday: 'long',
      day: 'numeric', 
      month: 'short',
      year: 'numeric'
    });
  }
}

// Fetch weather data
async function fetchWeather() {
  try {
    // Using a simple approximation based on time for demo (replace with real API)
    const hour = new Date().getHours();
    let icon = '☀️', desc = 'Sunny';
    if (hour < 6 || hour > 19) { icon = '🌙'; desc = 'Clear Night'; }
    else if (hour < 9) { icon = '🌅'; desc = 'Morning'; }
    else if (hour > 17) { icon = '🌆'; desc = 'Evening'; }
    
    // Simulated temperature (replace with real API)
    const baseTemp = 28 + Math.floor(Math.random() * 8);
    state.weather = { temp: `${baseTemp}°C`, desc, icon };
    updateWeatherDisplay();
  } catch (e) {
    state.weather = { temp: '32°C', desc: 'Partly Cloudy', icon: '⛅' };
  }
}

function updateWeatherDisplay() {
  const iconEl = document.getElementById('weather-icon');
  const tempEl = document.getElementById('weather-temp');
  const descEl = document.getElementById('weather-desc');
  if (iconEl) iconEl.textContent = state.weather.icon;
  if (tempEl) tempEl.textContent = state.weather.temp;
  if (descEl) descEl.textContent = state.weather.desc;
}

// Per-attempt abort budget. The backend runs on Render's free tier, which puts
// the service to sleep after idle and takes ~30-60s to cold-start. A single 25s
// timeout aborted those legitimate wake-ups and surfaced a false "network timed
// out". We now allow a generous per-attempt window and retry once.
const API_TIMEOUT_WARM_MS = 10000;
const API_TIMEOUT_COLD_MS = 22000;

// Timestamp (ms) of the last time the backend answered us. Used to skip the
// pre-payment wake-up ping when the server is demonstrably warm, so payments
// don't pay for an extra round trip on the happy path.
let lastServerOkAt = 0;
let renderScheduled = false;
let pendingRender = false;

async function api(method, path, body, idempotencyKey) {
  const baseOpts = { method, headers: { 'Content-Type': 'application/json' } };
  if (idempotencyKey) baseOpts.headers['Idempotency-Key'] = idempotencyKey;
  if (body) baseOpts.body = JSON.stringify(body);

  const warm = serverIsWarm();
  const timeoutMs = warm ? API_TIMEOUT_WARM_MS : API_TIMEOUT_COLD_MS;
  const maxAttempts = warm ? 1 : 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const r = await fetch(BACKEND + path, { ...baseOpts, signal: controller.signal });
      const data = await r.json().catch(() => ({}));
      lastServerOkAt = Date.now();
      if (r.status >= 500 && attempt < maxAttempts) {
        clearTimeout(timer);
        await new Promise((resolve) => setTimeout(resolve, 400));
        continue;
      }
      return { ok: r.ok, status: r.status, data };
    } catch (err) {
      console.warn(`[kiosk] API attempt ${attempt}/${maxAttempts} failed:`, method, path, err && err.name);
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    ok: false,
    status: 0,
    data: {
      success: false,
      message: 'Could not reach the server. Please try again.',
    },
  };
}

// ── Cold-start handling ────────────────────────────────────────────────────
// The backend runs on Render's free tier and sleeps after idle, taking ~30-60s
// to wake. A single lightweight ping; returns true if the server answered.
async function pingBackend(timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(BACKEND + '/kiosk/stations', { cache: 'no-store', signal: controller.signal });
    if (r.ok) lastServerOkAt = Date.now();
    return r.ok;
  } catch (_) {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// True when the backend answered us very recently, so we can skip a redundant
// wake-up ping and go straight to the request.
function serverIsWarm(withinMs = 45000) {
  return Date.now() - lastServerOkAt < withinMs;
}

// Poll until the backend actually answers (it may be cold-starting) or we give
// up. Used to guarantee a warm server BEFORE firing a payment, so the money
// request itself never becomes the cold-start victim.
async function ensureBackendAwake(maxWaitMs = 90000) {
  const start = Date.now();
  let delay = 500;
  while (Date.now() - start < maxWaitMs) {
    if (await pingBackend(5000)) return true;
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay + 500, 3000);
  }
  return false;
}

// Fire-and-forget warm-up used when the user is about to pay, so the server is
// hot by the time they tap their card.
function warmNow() {
  // Fire-and-forget wake for free-tier cold starts — call on user intent only,
  // never on a continuous timer (that burns Render's monthly free hours).
  pingBackend(3500).catch(() => {});
}

/** Throttled warm-up for first touch/key before the user taps a card. */
function predictiveWarm() {
  const now = Date.now();
  if (now - lastPredictiveWarmAt < PREDICTIVE_WARM_THROTTLE_MS) return;
  lastPredictiveWarmAt = now;
  warmNow();
}

async function submitMutation(path, body, payKey) {
  // Fast path when server answered recently — never pre-ping on the hot path.
  if (!serverIsWarm(60000)) {
    const awake = await pingBackend(4000);
    if (!awake) {
      setState({ step: 'processing', processingMsg: 'Waking up secure server…' });
      await ensureBackendAwake(45000);
      setState({ step: 'processing', processingMsg: 'Processing…' });
    }
  }

  let res = await api('POST', path, body, payKey);

  if (!res.ok && res.status === 0) {
    setState({ step: 'processing', processingMsg: 'Reconnecting…' });
    const awake = await ensureBackendAwake(30000);
    setState({ step: 'processing', processingMsg: 'Processing…' });
    if (awake) res = await api('POST', path, body, payKey);
  }
  return res;
}

async function vercelPost(path, body) {
  const r = await fetch(VERCEL + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { ok: r.ok, data: await r.json().catch(() => ({})) };
}

// Screens that play the soothing looping background pad (homepage + services,
// plus the brief entry screens so the music doesn't cut out between them).
const AMBIENT_STEPS = new Set(['idle', 'checking', 'pairing', 'home', 'guide']);

function setState(p, opts = {}) {
  const prevStep = state.step;
  Object.assign(state, p);

  // Instant cart qty updates — patch DOM instead of rebuilding 100+ item HTML.
  if (opts.patchCanteen && state.step === 'canteen_home') {
    patchCanteenHome();
    return;
  }

  if (opts.skipRender) return;

  // Defer heavy paints so button-tap sounds aren't delayed by string building.
  if (opts.defer || (state.step === 'canteen_home' && prevStep === 'canteen_home')) {
    scheduleRender(prevStep);
    return;
  }

  render();
  playStepSound(prevStep);
  updateAmbient();
}

function scheduleRender(prevStep) {
  pendingRender = true;
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    if (!pendingRender) return;
    pendingRender = false;
    const prev = prevStep;
    render();
    playStepSound(prev);
    updateAmbient();
  });
}

// Play the chime that matches a screen transition. On-screen button taps are
// handled separately in the click delegator; this covers events that arrive
// without a user gesture (card taps over WebSocket, async payment results).
function playStepSound(prevStep) {
  const S = window.Sound;
  if (!S || state.step === prevStep) return;
  switch (state.step) {
    case 'home':      // services page opened
      S.welcome();
      break;
    case 'checking':  // a card was just tapped on the reader
      S.cardTap();
      break;
    case 'result':    // payment/action finished
      if (state.error) S.error();
      else S.success();
      break;
    default:
      break;
  }
}

// Start/stop the background pad based on the current screen.
function updateAmbient() {
  if (window.Sound) window.Sound.ambient(AMBIENT_STEPS.has(state.step));
}

function reset() {
  closeCanteenDetail();
  setState({
    step: 'idle', cardUid: null, userId: null, userName: null, balance: 0,
    loyaltyPoints: 0, memberTier: 'BRONZE', dailyLimit: 0, lastTopUp: null,
    cardBlocked: false, insufficientBalance: false,
    digits: '', error: null, resultMsg: null, service: null,
    transitFrom: null, transitTo: null, transitFare: 0,
    selectedTicket: null, selectedCart: null, selectedSpot: null,
    parkingMode: 'view', awaitingTap: false, paymentKey: null, qrPayload: null,
    activeParkingSpot: null, activeParking: null, processingMsg: 'Processing…',
    tickets: [], carts: [], spots: [],
    canteenLocalCart: [], canteenCarts: [], selectedCanteenCart: null,
    lastCanteenOrder: null, canteenCollectOrderNumber: null, canteenCategory: 'Meals',
  });
}

// A unique key per payment attempt. Sent as Idempotency-Key so a double-tap or
// network retry reuses the same key and the backend charges the wallet once.
function newPaymentKey() {
  try {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  } catch (_) { /* fall through */ }
  return `pk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// Show a failure result screen, flagging insufficient-balance specially so the
// UI can prompt the user to recharge their OneLink wallet via the app.
function showFailure(data, fallbackMsg, resetMs = 6000) {
  const msg = (data && (data.message || data.error)) || fallbackMsg;
  const insufficient = !!(data && data.insufficientBalance) || /insufficient/i.test(msg || '');
  setState({
    step: 'result',
    error: msg,
    resultMsg: insufficient ? 'Insufficient Balance' : fallbackMsg,
    insufficientBalance: insufficient,
    balance: data && typeof data.newBalance === 'number' ? data.newBalance : state.balance,
  });
  setTimeout(reset, resetMs);
}

async function loadStations() {
  const { data } = await api('GET', '/kiosk/stations');
  if (data.stations) {
    // Update cache without forcing a re-render if nothing is showing them yet.
    state.stations = data.stations;
    if (['transit_from', 'transit_to'].includes(state.step)) render();
  }
}

// Fetch parking spots and cache them. Optionally re-render if the grid is open.
async function refreshParkingSpots() {
  const { data } = await api('GET', '/kiosk/parking/spots');
  if (data.spots) {
    state.spots = data.spots;
    if (state.step === 'parking_grid') render();
  }
}

// Warm up the (possibly cold-started) backend and prefetch data the user is
// likely to need next, so taps feel instant.
function prefetchForHome() {
  refreshParkingSpots().catch(() => {});
  if (!state.stations.length) loadStations().catch(() => {});
}

async function onCardTap(cardUid) {
  noteUserActivity();
  const pendingService = state.awaitingTap ? state.service : null;
  const pendingState = state.awaitingTap ? {
    service: state.service,
    transitFrom: state.transitFrom,
    transitTo: state.transitTo,
    selectedTicket: state.selectedTicket,
    selectedCart: state.selectedCart,
    selectedSpot: state.selectedSpot,
    parkingMode: state.parkingMode,
    selectedCanteenCart: state.selectedCanteenCart,
    canteenLocalCart: state.canteenLocalCart,
    canteenCollectOrderNumber: state.canteenCollectOrderNumber,
  } : null;

  // Instant UI before any network wait (cardTap sound plays via playStepSound)
  setState({ cardUid, step: 'checking', error: null });

  let res = await api('POST', '/kiosk/check-card', { cardUid });

  // Cold start only: wake and retry once
  if (!res.ok && res.status === 0) {
    setState({ step: 'checking', error: null, processingMsg: 'Waking server…' });
    const awake = await ensureBackendAwake(45000);
    if (awake) res = await api('POST', '/kiosk/check-card', { cardUid });
  }

  const { ok, data } = res;

  // A failed request (timeout / 5xx) must NOT be misread as an unregistered
  // card — show a clear connection error and reset instead of the pairing flow.
  if (!ok && !data.registered && !data.blocked) {
    setState({
      step: 'result',
      error: (data && data.message) || 'Could not reach the server. Please try again.',
      resultMsg: 'Connection Error',
      insufficientBalance: false,
    });
    return setTimeout(reset, 5000);
  }

  if (data.blocked) {
    setState({
      step: 'result',
      error: data.error || 'This card is locked in the OneLink app. Unlock it from Profile → NFC card.',
      resultMsg: 'Card Locked',
      insufficientBalance: false,
    });
    return setTimeout(reset, 7000);
  }
  if (!data.registered) {
    return setState({ step: 'pairing', digits: '' });
  }

  setState({
    userId: data.userId,
    userName: data.name,
    balance: data.balance || 0,
    loyaltyPoints: data.loyaltyPoints || 0,
    memberTier: data.memberTier || 'BRONZE',
    dailyLimit: data.dailyLimit || 0,
    lastTopUp: data.lastTopUp || null,
    cardBlocked: data.cardBlocked || false,
    tickets: data.activeTickets || [],
    carts: data.pendingCarts || [],
    canteenCarts: data.pendingCanteenCarts || [],
    activeParkingSpot: data.activeParkingSpot || null,
    activeParking: data.activeParking || null,
  });

  if (pendingService && pendingState) {
    Object.assign(state, pendingState, { awaitingTap: true, cardUid });
    return handleAwaitingTap();
  }

  setState({ step: 'home' });
  // Warm the backend + prefetch parking spots so the next tap is instant.
  prefetchForHome();
}

async function handleAwaitingTap() {
  const uid = state.cardUid;
  // One key per attempt; reused across double-taps so the wallet is charged once.
  if (!state.paymentKey) state.paymentKey = newPaymentKey();
  const payKey = state.paymentKey;
  if (state.service === 'transit' && state.transitFrom && state.transitTo) {
    setState({ step: 'processing', processingMsg: 'Processing…' });
    const { ok, data } = await submitMutation('/kiosk/transit/book', {
      cardUid: uid, from: state.transitFrom, to: state.transitTo,
    }, payKey);
    if (ok && data.success) {
      setState({
        step: 'result', resultMsg: `Ticket booked · ₹${data.fare}`,
        balance: data.newBalance, qrPayload: data.qrPayload, error: null,
        insufficientBalance: false,
      });
      setTimeout(reset, 5000);
    } else {
      showFailure(data, 'Booking failed');
    }
    return;
  }

  if (state.service === 'transit' && state.selectedTicket) {
    setState({ step: 'processing', processingMsg: 'Processing…' });
    const { ok, data } = await submitMutation('/kiosk/transit/use-ticket', {
      cardUid: uid, ticketId: state.selectedTicket.ticketId,
    }, payKey);
    if (ok && data.success) {
      const msg = data.phase === 'ENTRY'
        ? `Entry: ${data.station} → ${data.destination}`
        : `Exit: ${data.station} · Journey complete`;
      setState({ step: 'result', resultMsg: msg, qrPayload: data.qrPayload || null, error: null, insufficientBalance: false });
      setTimeout(reset, 5000);
    } else {
      showFailure(data, 'Entry/Exit failed');
    }
    return;
  }

  if (state.service === 'shop' && state.selectedCart) {
    setState({ step: 'processing', processingMsg: 'Processing…' });
    const { ok, data } = await submitMutation('/kiosk/shop/pay', {
      cardUid: uid, cartId: state.selectedCart.cartId,
    }, payKey);
    if (ok && data.success) {
      setState({ step: 'result', resultMsg: `Paid ₹${data.amount}`, balance: data.newBalance, error: null, insufficientBalance: false });
      setTimeout(reset, 4000);
    } else {
      showFailure(data, 'Payment failed');
    }
    return;
  }

  if (state.service === 'canteen' && (state.selectedCanteenCart || state.canteenLocalCart.length)) {
    setState({ step: 'processing', processingMsg: 'Paying for canteen…' });
    const body = { cardUid: uid };
    if (state.selectedCanteenCart) {
      body.cartId = state.selectedCanteenCart.cartId;
    } else {
      body.items = state.canteenLocalCart.map((i) => ({
        productId: i.productId,
        name: i.name,
        quantity: i.quantity,
        price: i.price,
        imageUrl: i.imageUrl,
        category: i.category,
      }));
    }
    const { ok, data } = await submitMutation('/kiosk/canteen/pay', body, payKey);
    if (ok && data.success) {
      setState({
        step: 'canteen_paid',
        lastCanteenOrder: data,
        canteenCollectOrderNumber: data.orderNumber,
        balance: data.newBalance,
        canteenLocalCart: [],
        selectedCanteenCart: null,
        error: null,
        insufficientBalance: false,
        awaitingTap: false,
        paymentKey: null,
      });
      try {
        localStorage.setItem('onelink_canteen_pending_collect', JSON.stringify({
          orderNumber: data.orderNumber,
          orderId: data.orderId,
          receiptId: data.receiptId,
          total: data.amount || data.total,
          items: data.items,
          readyAt: data.readyAt,
          paidAt: data.paidAt,
          status: data.status || 'PREPARING',
        }));
      } catch (_) {}
      refreshCanteenQueue();
      setTimeout(() => {
        if (state.step === 'canteen_paid') openCanteenService();
      }, 4500);
    } else {
      showFailure(data, 'Canteen payment failed');
    }
    return;
  }

  if (state.service === 'canteen_collect' && state.canteenCollectOrderNumber != null) {
    const pendingOrderNumber = state.canteenCollectOrderNumber;
    const pendingOrder = state.lastCanteenOrder;
    setState({ step: 'processing', processingMsg: 'Collecting order…' });
    const { ok, data } = await submitMutation('/kiosk/canteen/collect', {
      cardUid: uid,
      orderNumber: pendingOrderNumber,
    }, payKey);
    if (ok && data.success) {
      try { localStorage.removeItem('onelink_canteen_pending_collect'); } catch (_) {}
      setState({
        step: 'canteen_collected',
        lastCanteenOrder: data,
        canteenCollectOrderNumber: null,
        error: null,
        awaitingTap: false,
        paymentKey: null,
      });
      setTimeout(reset, 6000);
    } else {
      // Wrong card / not ready — return to service board and KEEP collect CTA
      setState({
        step: 'canteen_service',
        service: 'canteen',
        lastCanteenOrder: pendingOrder,
        canteenCollectOrderNumber: pendingOrderNumber,
        awaitingTap: false,
        paymentKey: null,
        error: (data && (data.message || data.error)) || 'Wrong card. Tap the card used to place this order.',
      });
      refreshCanteenQueue();
    }
    return;
  }

  if (state.service === 'parking' && state.parkingMode === 'allocate') {
    setState({ step: 'processing', processingMsg: 'Processing…' });
    const { ok, data } = await submitMutation('/kiosk/parking/allocate', {
      cardUid: uid, spotId: state.selectedSpot || undefined,
    }, payKey);
    if (ok && data.success) {
      setState({ step: 'result', resultMsg: `Parked at ${data.spotId}`, error: null, insufficientBalance: false });
      setTimeout(reset, 4000);
    } else {
      showFailure(data, 'Allocation failed');
    }
    return;
  }

  if (state.service === 'parking' && state.parkingMode === 'exit') {
    setState({ step: 'processing', processingMsg: 'Processing…' });
    const { ok, data } = await submitMutation('/kiosk/parking/exit', { cardUid: uid }, payKey);
    if (ok && data.success) {
      setState({
        step: 'result',
        resultMsg: `Vacated ${data.spotId} · ${data.duration}min · ₹${data.charges}`,
        balance: data.newBalance,
        activeParkingSpot: null,
        activeParking: null,
        error: null,
        insufficientBalance: false,
      });
      setTimeout(reset, 5000);
    } else {
      showFailure(data, 'Exit failed');
    }
    return;
  }

  onCardTap(uid);
}

async function submitPair() {
  if (state.digits.length !== 10) return;
  const { ok, data } = await vercelPost('/api/pair-card', {
    pairingToken: state.digits, cardUid: state.cardUid,
  });
  if (ok && data.success) {
    setState({ step: 'home', userName: data.name, balance: data.balance, userId: data.userId, digits: '', error: null });
  } else {
    setState({ error: data.error || 'Invalid code' });
  }
}

function openTransit() {
  // Render immediately using tickets already fetched at card-tap; refresh in bg.
  setState({
    service: 'transit',
    step: 'transit_menu',
    tickets: state.tickets || [],
    transitFrom: null, transitTo: null, transitFare: 0,
  });
  if (!state.stations.length) loadStations().catch(() => {});
  api('GET', `/kiosk/transit/tickets/${state.cardUid}`).then(({ data }) => {
    if (data && data.tickets && state.step === 'transit_menu') {
      state.tickets = data.tickets;
      render();
    }
  }).catch(() => {});
}

function openShop() {
  // Render immediately using carts already fetched at card-tap; refresh in bg.
  setState({ service: 'shop', step: 'shop_carts', carts: state.carts || [] });
  api('GET', `/kiosk/shop/carts/${state.cardUid}`).then(({ data }) => {
    if (data && data.carts && state.step === 'shop_carts') {
      state.carts = data.carts;
      render();
    }
  }).catch(() => {});
}

/**
 * Always resolve canteen image URLs to root-absolute /kiosk/canteen-images/...
 * Relative "canteen-images/x.jpg" breaks when the page URL is /kiosk (no trailing slash)
 * because the browser resolves it to /canteen-images/x.jpg (404).
 */
function resolveCanteenImageUrl(url) {
  if (!url) return '/kiosk/canteen-images/_pending.jpg';
  const s = String(url).trim();
  const file = s.split('?')[0].split('/').pop();
  if (file && /\.(jpe?g|png|webp|gif)$/i.test(file)) {
    return '/kiosk/canteen-images/' + file;
  }
  if (s.startsWith('/kiosk/canteen-images/')) return s.split('?')[0];
  if (s.startsWith('canteen-images/')) return '/kiosk/' + s.split('?')[0];
  return s;
}

function canteenMenuFallback() {
  const raw = (window.CANTEEN_MENU_FULL && window.CANTEEN_MENU_FULL.length)
    ? window.CANTEEN_MENU_FULL
    : [];
  return raw.map((i) => ({ ...i, imageUrl: resolveCanteenImageUrl(i.imageUrl) }));
}

/** Prefer local hosted images so a stale API never reintroduces broken remote photos. */
function mergeCanteenMenu(apiItems) {
  const local = canteenMenuFallback();
  if (!local.length) {
    return (apiItems || []).map((i) => ({ ...i, imageUrl: resolveCanteenImageUrl(i.imageUrl) }));
  }
  if (!apiItems || !apiItems.length) return local;
  const localById = new Map(local.map((i) => [i.productId, i]));
  const merged = apiItems.map((apiItem) => {
    const loc = localById.get(apiItem.productId);
    if (!loc) return { ...apiItem, imageUrl: resolveCanteenImageUrl(apiItem.imageUrl) };
    return {
      ...apiItem,
      imageUrl: loc.imageUrl,
      name: loc.name,
      description: loc.description || apiItem.description,
    };
  });
  const seen = new Set(merged.map((i) => i.productId));
  for (const loc of local) {
    if (!seen.has(loc.productId)) merged.push(loc);
  }
  return merged;
}

async function loadCanteenMenu() {
  // Instant local menu (images always available from this origin)
  if (!state.canteenMenu.length) {
    state.canteenMenu = canteenMenuFallback();
    if (window.CANTEEN_CATEGORIES_FULL) state.canteenCategories = window.CANTEEN_CATEGORIES_FULL;
  }
  try {
    const { data } = await api('GET', '/kiosk/canteen/menu');
    if (data && data.items && data.items.length) {
      state.canteenMenu = mergeCanteenMenu(data.items);
      if (data.categories && data.categories.length) state.canteenCategories = data.categories;
      return;
    }
  } catch (_) { /* fallback already set */ }
  state.canteenMenu = canteenMenuFallback();
  if (window.CANTEEN_CATEGORIES_FULL) state.canteenCategories = window.CANTEEN_CATEGORIES_FULL;
}

async function refreshCanteenQueue() {
  try {
    const { data } = await api('GET', '/kiosk/canteen/queue');
    if (data && data.success) {
      state.canteenQueue = {
        nowServing: data.nowServing || 0,
        orders: data.orders || [],
      };
      if (['canteen_service', 'canteen_home'].includes(state.step)) render();
    }
  } catch (_) { /* ignore */ }
}

function openCanteen(fromIdle = false) {
  closeCanteenDetail();
  const keepUser = !fromIdle && state.userName;
  setState({
    service: 'canteen',
    step: 'canteen_home',
    canteenCategory: 'Meals',
    selectedCanteenCart: null,
    awaitingTap: false,
    ...(fromIdle && !keepUser ? { cardUid: null } : {}),
  });
  // Prefetch menu from local fallback instantly, then refresh from API.
  if (!state.canteenMenu.length && window.CANTEEN_MENU_FULL) {
    state.canteenMenu = window.CANTEEN_MENU_FULL;
    state.canteenCategories = window.CANTEEN_CATEGORIES_FULL || state.canteenCategories;
    render();
  }
  loadCanteenMenu().then(() => { if (state.step === 'canteen_home') render(); });
  refreshCanteenQueue();
  warmNow();
  if (state.cardUid) {
    api('GET', `/kiosk/canteen/carts/${state.cardUid}`).then(({ data }) => {
      if (data && data.carts && state.step === 'canteen_home') {
        state.canteenCarts = data.carts;
        render();
      }
    }).catch(() => {});
  }
}

function openCanteenService() {
  // Restore pending collect from this session or localStorage so wrong-card
  // taps never wipe the "Tap card to collect" CTA.
  let pending = state.lastCanteenOrder;
  if (!pending || pending.status === 'COLLECTED') {
    try {
      const raw = localStorage.getItem('onelink_canteen_pending_collect');
      if (raw) pending = JSON.parse(raw);
    } catch (_) {}
  }
  setState({
    service: 'canteen',
    step: 'canteen_service',
    awaitingTap: false,
    paymentKey: null,
    lastCanteenOrder: pending || state.lastCanteenOrder,
    canteenCollectOrderNumber: pending?.orderNumber ?? state.canteenCollectOrderNumber,
    error: null,
  });
  refreshCanteenQueue();
  if (window._canteenQueuePoll) clearInterval(window._canteenQueuePoll);
  window._canteenQueuePoll = setInterval(() => {
    if (state.step !== 'canteen_service') {
      clearInterval(window._canteenQueuePoll);
      window._canteenQueuePoll = null;
      return;
    }
    refreshCanteenQueue();
  }, 15000);
}

function canteenLocalCartTotal() {
  return (state.canteenLocalCart || []).reduce((s, i) => s + i.price * i.quantity, 0);
}

function canteenAddItem(productId) {
  const item = (state.canteenMenu || []).find((x) => x.productId === productId);
  if (!item) return;
  const cart = [...(state.canteenLocalCart || [])];
  const existing = cart.find((c) => c.productId === productId);
  if (existing) existing.quantity += 1;
  else cart.push({ ...item, quantity: 1 });
  setState({ canteenLocalCart: cart, selectedCanteenCart: null }, { patchCanteen: true });
  refreshCanteenDetailOverlay();
}

function canteenDecItem(productId) {
  const cart = (state.canteenLocalCart || [])
    .map((c) => (c.productId === productId ? { ...c, quantity: c.quantity - 1 } : c))
    .filter((c) => c.quantity > 0);
  setState({ canteenLocalCart: cart }, { patchCanteen: true });
  refreshCanteenDetailOverlay();
}

function closeCanteenDetail() {
  const el = document.getElementById('canteen-detail-overlay');
  if (el) el.remove();
  state.canteenDetailId = null;
}

function openCanteenDetail(productId, fromEl) {
  const id = String(productId || '').trim();
  let item = (state.canteenMenu || []).find((x) => x.productId === id);
  if (!item && window.CANTEEN_MENU_FULL) {
    item = window.CANTEEN_MENU_FULL.find((x) => x.productId === id);
  }
  // Build from card data attributes if menu lookup fails (still open the preview)
  if (!item && fromEl) {
    item = {
      productId: id,
      name: fromEl.getAttribute('data-cn-name') || id,
      price: Number(fromEl.getAttribute('data-cn-price') || 0),
      category: fromEl.getAttribute('data-cn-cat') || 'Meals',
      description: fromEl.getAttribute('data-cn-desc') || '',
      imageUrl: fromEl.getAttribute('data-cn-img') || '',
    };
  }
  if (!item) {
    console.warn('[kiosk] canteen detail: item not found', id);
    return;
  }
  const existing = document.getElementById('canteen-detail-overlay');
  if (existing) existing.remove();
  state.canteenDetailId = id;
  const qty = (state.canteenLocalCart || []).find((c) => c.productId === id)?.quantity || 0;
  const img = resolveCanteenImageUrl(item.imageUrl);
  const overlay = document.createElement('div');
  overlay.id = 'canteen-detail-overlay';
  overlay.className = 'canteen-detail-overlay';
  overlay.innerHTML = `
    <div class="canteen-detail-backdrop" data-cndetail-close="1"></div>
    <div class="canteen-detail-card" role="dialog" aria-label="${esc(item.name)}">
      <button type="button" class="canteen-detail-close" data-cndetail-close="1" aria-label="Close">×</button>
      <img class="canteen-detail-img" src="${esc(img)}" alt="${esc(item.name)}"
        onerror="this.onerror=null;this.src='/kiosk/canteen-images/_pending.jpg'" />
      <div class="canteen-detail-body">
        <div class="canteen-detail-cat">${esc(item.category || '')}</div>
        <h2 class="canteen-detail-name">${esc(item.name)}</h2>
        ${item.description ? `<p class="canteen-detail-desc">${esc(item.description)}</p>` : ''}
        <div class="canteen-detail-row">
          <span class="canteen-detail-price">₹${item.price}</span>
          <div class="canteen-detail-actions" data-cndetail-actions="${esc(id)}">
            ${qty > 0 ? `
              <div class="canteen-qty canteen-qty-lg">
                <button type="button" data-cndec="${esc(id)}" aria-label="Decrease">−</button>
                <span>${qty}</span>
                <button type="button" data-cnadd="${esc(id)}" aria-label="Increase">+</button>
              </div>
            ` : `
              <button type="button" class="canteen-add canteen-add-lg" data-cnadd="${esc(id)}">Add to cart</button>
            `}
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', handleAppClick);
}

function refreshCanteenDetailOverlay() {
  const id = state.canteenDetailId;
  if (!id || !document.getElementById('canteen-detail-overlay')) return;
  const actions = document.querySelector('[data-cndetail-actions]');
  if (!actions) return;
  const qty = (state.canteenLocalCart || []).find((c) => c.productId === id)?.quantity || 0;
  actions.innerHTML = qty > 0
    ? `<div class="canteen-qty canteen-qty-lg">
        <button type="button" data-cndec="${esc(id)}" aria-label="Decrease">−</button>
        <span>${qty}</span>
        <button type="button" data-cnadd="${esc(id)}" aria-label="Increase">+</button>
      </div>`
    : `<button type="button" class="canteen-add canteen-add-lg" data-cnadd="${esc(id)}">Add to cart</button>`;
}

/** Instant qty/cart update without rebuilding the full ~100-item menu HTML. */
function patchCanteenHome() {
  const localCart = state.canteenLocalCart || [];
  const total = canteenLocalCartTotal();

  document.querySelectorAll('[data-cn-item]').forEach((card) => {
    const id = card.getAttribute('data-cn-item');
    const qty = localCart.find((c) => c.productId === id)?.quantity || 0;
    const actions = card.querySelector('.canteen-actions');
    if (!actions) return;
    actions.innerHTML = qty > 0
      ? `<div class="canteen-qty">
          <button type="button" data-cndec="${esc(id)}" aria-label="Decrease">−</button>
          <span>${qty}</span>
          <button type="button" data-cnadd="${esc(id)}" aria-label="Increase">+</button>
        </div>`
      : `<button type="button" class="canteen-add" data-cnadd="${esc(id)}">Add</button>`;
  });

  const panel = document.querySelector('.canteen-cart-panel');
  if (!panel) return;
  const scroll = panel.querySelector('.canteen-cart-scroll');
  const footerBtns = panel.querySelectorAll('#canteen-checkout, #canteen-clear-local, #canteen-clear-pending');
  footerBtns.forEach((b) => b.remove());

  if (state.selectedCanteenCart) {
    if (scroll) {
      scroll.innerHTML = `
        <p class="muted">Paying app cart · ${state.selectedCanteenCart.items?.length || 0} items</p>
        ${(state.selectedCanteenCart.items || []).map((i) => `
          <div class="canteen-cart-line"><span>${i.quantity}× ${esc(i.name)}</span><span>₹${i.price * i.quantity}</span></div>
        `).join('')}
        <div class="canteen-cart-total">₹${state.selectedCanteenCart.total}</div>`;
    }
    panel.insertAdjacentHTML('beforeend', `
      <button class="canteen-checkout-btn" id="canteen-checkout">Tap card to pay</button>
      <button class="canteen-clear-btn" id="canteen-clear-pending">Clear selection</button>`);
  } else if (localCart.length) {
    if (scroll) {
      scroll.innerHTML = `
        ${localCart.map((i) => `
          <div class="canteen-cart-line">
            <span>${i.quantity}× ${esc(i.name)}</span>
            <span>₹${i.price * i.quantity}</span>
          </div>
        `).join('')}
        <div class="canteen-cart-total">₹${total}</div>`;
    }
    panel.insertAdjacentHTML('beforeend', `
      <button class="canteen-checkout-btn" id="canteen-checkout">Checkout · Tap card</button>
      <button class="canteen-clear-btn" id="canteen-clear-local">Clear cart</button>`);
  } else if (scroll) {
    scroll.innerHTML = `<p class="muted">Scroll the menu and tap Add on any item</p>`;
  }
}

function startCanteenCheckout() {
  if (!state.selectedCanteenCart && !state.canteenLocalCart.length) return;
  warmNow();
  setState({
    step: 'canteen_checkout',
    service: 'canteen',
    awaitingTap: true,
    paymentKey: newPaymentKey(),
  });
}

function startCanteenCollect(orderNumber) {
  warmNow();
  setState({
    step: 'canteen_collect',
    service: 'canteen_collect',
    canteenCollectOrderNumber: Number(orderNumber),
    awaitingTap: true,
    paymentKey: newPaymentKey(),
    error: null,
  });
}

function openGuide() {
  setState({ guideReturnStep: state.step, step: 'guide' });
}

function closeGuide() {
  const back = state.guideReturnStep || (state.userName ? 'home' : 'idle');
  setState({ step: back, service: null });
}

function openParking() {
  // Render immediately with prefetched/cached spots (parking data is prefetched
  // as soon as the home screen loads), then refresh in the background.
  setState({
    service: 'parking',
    step: 'parking_grid',
    spots: state.spots || [],
    parkingMode: 'view',
    selectedSpot: null,
  });
  refreshParkingSpots().catch(() => {});
}

function isMyParkingSpot(p) {
  return p.occupiedBy === state.userId || p.spotId === state.activeParkingSpot;
}

function spotElapsedMinutes(p) {
  if (!p?.entryTime) return state.activeParking?.elapsedMinutes || 0;
  return Math.max(1, Math.ceil((Date.now() - new Date(p.entryTime).getTime()) / 60000));
}

// Metro fare is deterministic, so compute it locally for an instant response.
// (The backend re-validates the fare and balance when the ticket is booked.)
const METRO_STATIONS_FALLBACK = [
  'CCS Airport', 'Amausi', 'Krishna Nagar', 'Transport Nagar', 'Alambagh',
  'Charbagh', 'Hazratganj', 'Sachivalaya', 'IT College', 'Munshipulia',
];
const METRO_BASE_FARE = 10;

function localSlabFare(from, to) {
  const list = state.stations.length ? state.stations : METRO_STATIONS_FALLBACK;
  const a = list.findIndex((s) => s.toLowerCase() === String(from).toLowerCase());
  const b = list.findIndex((s) => s.toLowerCase() === String(to).toLowerCase());
  if (a === -1 || b === -1) return METRO_BASE_FARE;
  const travel = Math.abs(b - a);
  if (travel === 0) return METRO_BASE_FARE;
  if (travel === 1) return 10;
  if (travel === 2) return 15;
  if (travel <= 6) return 20;
  if (travel <= 9) return 30;
  if (travel <= 13) return 40;
  if (travel <= 17) return 50;
  return 60;
}

function scheduleWsReconnect(reason) {
  if (wsIdlePaused) return;
  if (wsReconnectTimer) return;
  // Failover: advance to the next candidate host so a stale/changed IP is
  // bypassed and the mDNS hostname (or last-good) gets a turn.
  wsCandidateIdx += 1;
  // When we've cycled through every candidate, back off and refresh the list
  // (picks up a newly-entered override or a fresh last-good value).
  if (wsCandidateIdx % wsCandidates.length === 0) {
    wsCandidates = getReaderCandidates();
    wsReconnectAttempt += 1;
  }
  const delay = Math.min(
    WS_RECONNECT_MAX_MS,
    WS_RECONNECT_MIN_MS * Math.pow(2, Math.min(wsReconnectAttempt, 5)),
  );
  console.warn(
    `[kiosk] WebSocket reconnect in ${delay}ms → ${currentWsUrl()} (${reason})`,
  );
  wsReconnectTimer = setTimeout(() => {
    wsReconnectTimer = null;
    connectWs();
  }, delay);
}

function connectWs() {
  if (wsIdlePaused) return;
  if (activeWs && (activeWs.readyState === WebSocket.OPEN || activeWs.readyState === WebSocket.CONNECTING)) {
    return;
  }
  warnIfMixedContent();
  const url = currentWsUrl();
  try {
    const ws = new WebSocket(url);
    activeWs = ws;

    ws.onopen = () => {
      wsReconnectAttempt = 0;
      if (wsReconnectTimer) {
        clearTimeout(wsReconnectTimer);
        wsReconnectTimer = null;
      }
      // Remember the host that worked so the next boot/reconnect tries it first.
      try {
        const host = url.replace(/^wss?:\/\//i, '');
        localStorage.setItem('onelink_reader_lastgood', host);
      } catch {}
      console.info('[kiosk] WebSocket connected:', url);
      setState({ wsOk: true });
    };

    ws.onclose = (ev) => {
      activeWs = null;
      setState({ wsOk: false });
      console.warn('[kiosk] WebSocket closed code=%s reason=%s', ev.code, ev.reason || '(none)');
      scheduleWsReconnect('close');
    };

    ws.onerror = () => {
      console.warn('[kiosk] WebSocket error — will reconnect');
      // onclose usually follows; reconnect is scheduled there
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.event === 'card_tap' && msg.cardUid) onCardTap(msg.cardUid);
      } catch (err) {
        console.warn('[kiosk] Bad WebSocket message:', err);
      }
    };
  } catch (err) {
    activeWs = null;
    setState({ wsOk: false });
    console.warn('[kiosk] WebSocket connect threw:', err);
    scheduleWsReconnect('throw');
  }
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

// Build an elegant per-letter waving text effect
function waveText(text) {
  const chars = String(text).split('');
  const spans = chars.map((ch, i) => {
    const delay = (i * 0.08).toFixed(2);
    const safe = ch === ' ' ? '&nbsp;' : esc(ch);
    return `<span style="--wave-delay:${delay}s">${safe}</span>`;
  }).join('');
  return `<span class="wave-text">${spans}</span>`;
}

// ── Screen orientation (landscape ↔ portrait) ──────────────────────────────
// Samsung Tab A 10.1" ships landscape by default; operators can flip to vertical
// via the header icon. Preference is persisted and applied before first paint.
const ORIENT_KEY = 'onelink_kiosk_orientation';

function getKioskOrientation() {
  try {
    const saved = localStorage.getItem(ORIENT_KEY);
    if (saved === 'portrait' || saved === 'landscape') return saved;
  } catch (_) { /* ignore */ }
  // Prefer physical device orientation when no preference is stored.
  try {
    if (window.matchMedia('(orientation: portrait)').matches) return 'portrait';
  } catch (_) { /* ignore */ }
  return 'landscape';
}

function applyKioskOrientation(mode, { persist = true } = {}) {
  const next = mode === 'portrait' ? 'portrait' : 'landscape';
  document.documentElement.classList.toggle('kiosk-portrait', next === 'portrait');
  document.documentElement.classList.toggle('kiosk-landscape', next === 'landscape');
  if (persist) {
    try { localStorage.setItem(ORIENT_KEY, next); } catch (_) { /* ignore */ }
  }
  return next;
}

async function lockKioskOrientation(mode) {
  try {
    if (screen.orientation && typeof screen.orientation.lock === 'function') {
      await screen.orientation.lock(mode === 'portrait' ? 'portrait' : 'landscape');
    }
  } catch (_) {
    // Browsers often deny lock outside fullscreen — CSS layout still switches.
  }
}

function toggleKioskOrientation() {
  const next = getKioskOrientation() === 'portrait' ? 'landscape' : 'portrait';
  applyKioskOrientation(next);
  lockKioskOrientation(next);
  if (window.Sound) window.Sound.tap();
  render();
}

// Apply saved/detected orientation immediately (before first render call sites).
applyKioskOrientation(getKioskOrientation(), { persist: false });

// Get time-based greeting
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

// Render header component
function renderHeader() {
  const s = state;
  const orient = getKioskOrientation();
  const orientLabel = orient === 'portrait' ? 'Switch to horizontal' : 'Switch to vertical';
  const orientGlyph = orient === 'portrait'
    ? '<span class="orient-glyph landscape" aria-hidden="true"></span>'
    : '<span class="orient-glyph portrait" aria-hidden="true"></span>';
  return `
    <header class="kiosk-header">
      <div class="header-brand">
        <div class="brand-logo">⚡</div>
        <div class="brand-text">
          <div class="brand-name">${waveText('OneLink')}</div>
          <div class="brand-tagline">Smart City Kiosk</div>
        </div>
      </div>
      
      <div class="header-datetime">
        <div class="datetime-block">
          <div class="time-display" id="live-time">${s.currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
          <div class="date-display" id="live-date">${s.currentTime.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}</div>
        </div>
        
        <div class="weather-widget">
          <span class="weather-icon" id="weather-icon">${s.weather.icon}</span>
          <div class="weather-info">
            <span class="weather-temp" id="weather-temp">${s.weather.temp}</span>
            <span class="weather-desc" id="weather-desc">${s.weather.desc}</span>
          </div>
        </div>

        <button id="orient-toggle" class="header-orient" aria-label="${orientLabel}" title="${orientLabel}">
          ${orientGlyph}
        </button>
        
        <button id="sound-toggle" class="header-sound" aria-label="Toggle sound">
          <span class="sound-icon">${soundOn() ? '🔊' : '🔇'}</span>
        </button>

        <button id="reader-status" class="header-status">
          <span class="status-dot ${s.wsOk ? 'online' : 'offline'}"></span>
          <span>${s.wsOk ? 'Reader Online' : 'Reader Offline'}</span>
        </button>
      </div>
    </header>
  `;
}

// Whether kiosk sound is currently enabled (used to pick the header icon).
function soundOn() {
  return window.Sound ? window.Sound.isEnabled() : true;
}

// Flip the sound on/off, persist it, refresh the header icon, and — when
// turning it back on — play a short chime so the change is audible.
function toggleSound() {
  if (!window.Sound) return;
  const next = !window.Sound.isEnabled();
  window.Sound.setEnabled(next);
  updateAmbient();
  if (next) window.Sound.tap();
  render();
}

// Render footer component
function renderFooter() {
  return `
    <footer class="kiosk-footer">
      <div class="footer-info">
        <div class="footer-item">
          <span class="icon">📍</span>
          <span>Lucknow Smart City</span>
        </div>
        <div class="footer-item">
          <span class="icon">🔒</span>
          <span>Secure Transaction</span>
        </div>
        <div class="footer-item">
          <span class="icon">📞</span>
          <span>Support: 1800-XXX-XXXX</span>
        </div>
      </div>
      <div class="footer-actions">
        <button class="footer-btn" id="help-btn">Need Help?</button>
      </div>
    </footer>
  `;
}

// Compact, unobtrusive help button shown in the bottom-right corner on every
// in-session screen (the full info banner is reserved for the idle/home screen).
function renderHelpButton() {
  return `
    <button class="help-fab" id="help-btn" aria-label="Need Help">
      <span class="help-fab-icon">🛟</span>
      <span class="help-fab-text">Need Help?</span>
    </button>
  `;
}

// Render idle screen
function renderIdleScreen() {
  return `
    <main class="kiosk-main">
      <div class="idle-screen">
        <div class="idle-animation">
          <div class="idle-ring"></div>
          <div class="idle-ring"></div>
          <div class="idle-ring"></div>
          <div class="idle-icon">💳</div>
        </div>
        
        <div>
          <h1 class="idle-title">${waveText('Tap Your Card to Begin')}</h1>
          <p class="idle-subtitle">Hold your OneLink card near the reader</p>
        </div>
        
        <div class="idle-services">
          <div class="idle-service-chip">
            <span class="icon">🛒</span>
            <span>Shopping</span>
          </div>
          <div class="idle-service-chip">
            <span class="icon">🚇</span>
            <span>Metro Transit</span>
          </div>
          <div class="idle-service-chip">
            <span class="icon">🅿️</span>
            <span>Parking</span>
          </div>
          <div class="idle-service-chip">
            <span class="icon">🍽️</span>
            <span>Canteen</span>
          </div>
        </div>
      </div>
      <button class="idle-canteen-fab" id="idle-canteen" title="Open Canteen">
        <span class="fab-icon">🍽️</span>
        <span class="fab-label">Canteen</span>
      </button>
    </main>
  `;
}

// Render loading screen
function renderLoadingScreen(message) {
  return `
    <main class="kiosk-main">
      <div class="loading-screen">
        <div class="loader"></div>
        <p class="loading-text">${esc(message)}</p>
      </div>
    </main>
  `;
}

// Member tier visual data
function tierMeta(tier) {
  const t = String(tier || 'BRONZE').toUpperCase();
  const map = {
    BRONZE: { icon: '🥉', cls: 'bronze', label: 'Bronze' },
    SILVER: { icon: '🥈', cls: 'silver', label: 'Silver' },
    GOLD: { icon: '🥇', cls: 'gold', label: 'Gold' },
    PLATINUM: { icon: '💎', cls: 'platinum', label: 'Platinum' },
  };
  return map[t] || map.BRONZE;
}

function formatLastTopUp(iso) {
  if (!iso) return 'No top-ups yet';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'No top-ups yet';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Render home screen
function renderHomeScreen() {
  const s = state;
  const cartCount = s.carts.length;
  const canteenCartCount = (s.canteenCarts || []).length;
  const ticketCount = s.tickets.length;
  const parkingStatus = s.activeParkingSpot ? esc(s.activeParkingSpot) : 'None';
  const firstName = (s.userName || 'User').split(' ')[0];
  const tier = tierMeta(s.memberTier);
  const lowBalance = Number(s.balance) < 100;
  const activeParkingCharge = s.activeParking?.estimatedCharge;

  return `
    <main class="kiosk-main">
      <div class="user-banner">
        <div class="user-info">
          <div class="user-avatar">👤</div>
          <div class="user-details">
            <h2>${getGreeting()}, ${esc(firstName)}!</h2>
            <p class="user-greeting">Welcome back · ${esc(s.userName)}</p>
            <span class="tier-badge ${tier.cls}">${tier.icon} ${tier.label} Member</span>
          </div>
        </div>
        <div class="balance-section">
          <div class="balance-label">Wallet Balance</div>
          <div class="balance-amount">
            <span class="balance-currency">₹</span>${Number(s.balance).toLocaleString('en-IN')}
          </div>
          <div class="balance-label" style="margin-top:6px;">⭐ ${Number(s.loyaltyPoints).toLocaleString('en-IN')} points</div>
        </div>
      </div>

      ${lowBalance ? `
        <div class="low-balance-banner">
          <span class="icon">⚠️</span>
          <span>Your balance is low (<strong>₹${Number(s.balance).toLocaleString('en-IN')}</strong>). Please recharge your OneLink wallet via the app to avoid failed payments.</span>
        </div>
      ` : ''}

      <div class="home-stats">
        <div class="stat-card">
          <div class="stat-icon wallet">⭐</div>
          <div class="stat-info">
            <span class="stat-value">${Number(s.loyaltyPoints).toLocaleString('en-IN')}</span>
            <span class="stat-label">Loyalty Points</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon shop">🛒</div>
          <div class="stat-info">
            <span class="stat-value">${cartCount}</span>
            <span class="stat-label">Pending Carts</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon transit">🎫</div>
          <div class="stat-info">
            <span class="stat-value">${ticketCount}</span>
            <span class="stat-label">Active Tickets</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon parking">🅿️</div>
          <div class="stat-info">
            <span class="stat-value">${parkingStatus}</span>
            <span class="stat-label">Parking Spot</span>
          </div>
        </div>
      </div>

      <div class="services-section">
        <div class="section-header">
          <span class="section-title">Select a Service</span>
        </div>
        
        <div class="services-grid">
          <button class="service-card shop" data-svc="shop">
            <div class="service-icon-wrapper">
              <span class="service-icon">🛒</span>
            </div>
            <h3 class="service-title">Shop</h3>
            <p class="service-subtitle">Pay for your shopping cart with OneLink</p>
            ${cartCount ? `<span class="service-badge">${cartCount} cart${cartCount > 1 ? 's' : ''}</span>` : ''}
          </button>
          
          <button class="service-card transit" data-svc="transit">
            <div class="service-icon-wrapper">
              <span class="service-icon">🚇</span>
            </div>
            <h3 class="service-title">Transit</h3>
            <p class="service-subtitle">Book metro tickets or use existing ones</p>
            ${ticketCount ? `<span class="service-badge">${ticketCount} ticket${ticketCount > 1 ? 's' : ''}</span>` : ''}
          </button>
          
          <button class="service-card parking" data-svc="parking">
            <div class="service-icon-wrapper">
              <span class="service-icon">🅿️</span>
            </div>
            <h3 class="service-title">Parking</h3>
            <p class="service-subtitle">Allocate spots or pay parking fees</p>
            ${s.activeParkingSpot ? `<span class="service-badge">📍 ${esc(s.activeParkingSpot)}</span>` : ''}
          </button>

          <button class="service-card canteen" data-svc="canteen">
            <div class="service-icon-wrapper">
              <span class="service-icon">🍽️</span>
            </div>
            <h3 class="service-title">Canteen</h3>
            <p class="service-subtitle">Order food, pay & collect at the counter</p>
            ${canteenCartCount ? `<span class="service-badge">${canteenCartCount} cart${canteenCartCount > 1 ? 's' : ''}</span>` : ''}
          </button>
        </div>
      </div>

      <div class="info-strip">
        <span class="info-icon">💡</span>
        <span class="info-text">
          <strong>Last top-up:</strong> ${formatLastTopUp(s.lastTopUp)} ·
          <strong>Daily limit:</strong> ₹${Number(s.dailyLimit || 0).toLocaleString('en-IN')}${activeParkingCharge ? ` · <strong>Parking running:</strong> ₹${Number(activeParkingCharge).toLocaleString('en-IN')} so far` : ''}.
          Tap <strong>Need Help?</strong> below for a full guide.
        </span>
      </div>

      <div class="quick-actions">
        ${s.activeParkingSpot ? `
          <button class="quick-action-btn danger" id="quick-vacate">
            <span class="icon">🚗</span>
            <span>Vacate Parking ${esc(s.activeParkingSpot)} - Tap to Pay & Leave</span>
          </button>
        ` : ''}
        <button class="quick-action-btn" id="help-home">
          <span class="icon">❓</span>
          <span>Need Help?</span>
        </button>
        <button class="quick-action-btn" id="done">
          <span class="icon">✓</span>
          <span>Done - Ready for Next User</span>
        </button>
      </div>
    </main>
  `;
}

// Render the user guide / help screen
function renderGuideScreen() {
  return `
    <main class="kiosk-main guide-screen">
      <div class="screen-header">
        <button class="back-btn" id="back">←</button>
        <div>
          <h2 class="screen-title">User Guide & Help</h2>
          <p class="screen-subtitle">Everything you need to know about using the OneLink kiosk</p>
        </div>
      </div>

      <div class="guide-body">
        <div class="guide-column">
          <div class="guide-card">
            <div class="guide-card-title"><span class="icon">🚀</span> Getting Started</div>
            <div class="guide-step">
              <div class="step-number">1</div>
              <div class="step-content">
                <h4>Tap Your Card</h4>
                <p>Hold your OneLink NFC card near the reader. First-time cards will be asked to link with a 10-digit code from the app.</p>
              </div>
            </div>
            <div class="guide-step">
              <div class="step-number">2</div>
              <div class="step-content">
                <h4>Choose a Service</h4>
                <p>Select Shop, Transit, or Parking from the home screen. Your balance and pending items are shown at the top.</p>
              </div>
            </div>
            <div class="guide-step">
              <div class="step-number">3</div>
              <div class="step-content">
                <h4>Confirm & Tap to Pay</h4>
                <p>Review the amount, then tap your card on the reader again to complete the payment. You'll see a confirmation instantly.</p>
              </div>
            </div>
          </div>

          <div class="guide-card">
            <div class="guide-card-title"><span class="icon">🛒</span> Shopping</div>
            <div class="guide-step">
              <div class="step-number">A</div>
              <div class="step-content">
                <h4>Create a cart in the app</h4>
                <p>In the OneLink Shop, add items and choose "Pay via Card" to send the cart to the kiosk.</p>
              </div>
            </div>
            <div class="guide-step">
              <div class="step-number">B</div>
              <div class="step-content">
                <h4>Select & pay at kiosk</h4>
                <p>Open Shop here, pick your cart, review items, and tap your card to pay.</p>
              </div>
            </div>
          </div>

          <div class="guide-card">
            <div class="guide-card-title"><span class="icon">🚇</span> Metro Transit</div>
            <div class="guide-step">
              <div class="step-number">A</div>
              <div class="step-content">
                <h4>Book a new trip</h4>
                <p>Choose Transit → Book New Trip, pick origin and destination, then tap your card to buy the ticket.</p>
              </div>
            </div>
            <div class="guide-step">
              <div class="step-number">B</div>
              <div class="step-content">
                <h4>Enter & exit gates</h4>
                <p>Select an existing ticket and tap your card to enter. Tap again at the destination to exit.</p>
              </div>
            </div>
          </div>

          <div class="guide-card">
            <div class="guide-card-title"><span class="icon">🅿️</span> Parking</div>
            <div class="guide-step">
              <div class="step-number">A</div>
              <div class="step-content">
                <h4>Allocate a spot</h4>
                <p>Open Parking, tap any green (available) spot, then tap your card to reserve it.</p>
              </div>
            </div>
            <div class="guide-step">
              <div class="step-number">B</div>
              <div class="step-content">
                <h4>Vacate & pay</h4>
                <p>Return, tap your highlighted spot (or "Vacate & Pay"), and tap your card. Charges are calculated by time parked.</p>
              </div>
            </div>
          </div>
        </div>

        <div class="guide-column">
          <div class="webapp-callout">
            <div class="webapp-qr">📱</div>
            <div class="webapp-info">
              <h4>Get the OneLink App</h4>
              <p>Manage your wallet, top up balance, view history and link cards.</p>
              <p class="webapp-url">onelink-wine-psi.vercel.app</p>
            </div>
          </div>

          <div class="guide-card">
            <div class="guide-card-title"><span class="icon">❓</span> Frequently Asked</div>
            <div class="faq-item">
              <div class="faq-q"><span class="q-mark">Q.</span> How do I add money to my card?</div>
              <div class="faq-a">Open the OneLink app → Wallet → Top Up. The balance updates instantly and reflects here at the kiosk.</div>
            </div>
            <div class="faq-item">
              <div class="faq-q"><span class="q-mark">Q.</span> My card isn't recognised. What now?</div>
              <div class="faq-a">If it's a new card, enter the 10-digit linking code from the app. If it still fails, the card may be blocked — contact support.</div>
            </div>
            <div class="faq-item">
              <div class="faq-q"><span class="q-mark">Q.</span> Payment failed but balance is enough?</div>
              <div class="faq-a">Check the reader status at the top-right is "Online". Wait a moment and tap again. If it persists, use support below.</div>
            </div>
            <div class="faq-item">
              <div class="faq-q"><span class="q-mark">Q.</span> Can I get a refund?</div>
              <div class="faq-a">Refunds for cancelled tickets or parking are processed back to your wallet automatically within a few minutes.</div>
            </div>
            <div class="faq-item">
              <div class="faq-q"><span class="q-mark">Q.</span> Is my transaction secure?</div>
              <div class="faq-a">Yes. Every payment is encrypted and requires a physical card tap. No card details are stored on the kiosk.</div>
            </div>
          </div>

          <div class="guide-card">
            <div class="guide-card-title"><span class="icon">📞</span> Need More Help?</div>
            <div class="faq-a" style="padding-left:0;">
              Call our 24×7 support line at <strong style="color:var(--text-primary);">1800-XXX-XXXX</strong>
              or email <strong style="color:var(--primary);">support@onelink.city</strong>.
              Kiosk located at Lucknow Smart City.
            </div>
          </div>
        </div>
      </div>
    </main>
  `;
}

// Render pairing screen
function renderPairingScreen() {
  const s = state;
  const digitBoxes = Array.from({length: 10}, (_, i) => 
    `<div class="digit-box ${i < s.digits.length ? 'filled' : ''}">${i < s.digits.length ? '•' : ''}</div>`
  ).join('');
  
  const keys = ['1','2','3','4','5','6','7','8','9','C','0','⌫'];
  const keypad = keys.map(k => 
    `<button class="key-btn ${k === 'C' || k === '⌫' ? 'action' : ''}" data-key="${k}">${k}</button>`
  ).join('');
  
  return `
    <main class="kiosk-main">
      <div class="pairing-screen">
        <div class="pairing-header">
          <h2 class="pairing-title">Link Your Card</h2>
          <p class="pairing-subtitle">Enter the 10-digit code from your OneLink app</p>
          <div class="pairing-card-id">Card ID: ${esc(s.cardUid)}</div>
        </div>
        
        <div class="digit-display">${digitBoxes}</div>
        
        ${s.error ? `<div class="pairing-error">${esc(s.error)}</div>` : ''}
        
        <div class="keypad">${keypad}</div>
        
        <button class="pairing-cancel" id="cancel">Cancel</button>
      </div>
    </main>
  `;
}

// Render result screen
function renderResultScreen() {
  const s = state;
  const success = !s.error;
  const icon = success ? '✓' : (s.insufficientBalance ? '💳' : '✕');

  return `
    <main class="kiosk-main">
      <div class="result-screen">
        <div class="result-icon ${success ? 'success' : 'error'}">
          ${icon}
        </div>
        <h2 class="result-title ${success ? 'success' : 'error'}">${esc(s.resultMsg)}</h2>
        ${!success && s.error ? `<p class="result-message">${esc(s.error)}</p>` : ''}
        ${s.qrPayload ? `<p class="result-message">Ticket generated successfully</p>` : ''}
        ${success && s.balance ? `
          <div class="result-balance">
            <div class="result-balance-label">New Balance</div>
            <div class="result-balance-amount">₹${Number(s.balance).toLocaleString('en-IN')}</div>
          </div>
        ` : ''}
        ${s.insufficientBalance ? `
          <div class="recharge-callout">
            <div class="recharge-head">
              <span class="recharge-icon">📱</span>
              <span>Recharge your OneLink wallet</span>
            </div>
            <p class="recharge-text">
              Your current balance is <strong>₹${Number(s.balance).toLocaleString('en-IN')}</strong>.
              Open the <strong>OneLink app → Wallet → Top Up</strong> to add money,
              then tap your card again to complete this payment.
            </p>
            <p class="recharge-url">onelink-wine-psi.vercel.app</p>
          </div>
        ` : ''}
        <button class="result-btn" id="continue">Continue</button>
      </div>
    </main>
  `;
}

// Render the full Lucknow Metro (UPMRC Red Line) map — mirrors the mobile app.
// Stations are laid out on a single horizontal line, numbered, with alternating
// labels above/below. Tapping a station starts a trip from there.
function renderMetroMap(highlightFrom, highlightTo) {
  const stations = state.stations.length ? state.stations : METRO_STATIONS_FALLBACK;
  const fromIdx = highlightFrom ? stations.indexOf(highlightFrom) : -1;
  const toIdx = highlightTo ? stations.indexOf(highlightTo) : -1;
  const lo = fromIdx >= 0 && toIdx >= 0 ? Math.min(fromIdx, toIdx) : -1;
  const hi = fromIdx >= 0 && toIdx >= 0 ? Math.max(fromIdx, toIdx) : -1;

  const nodes = stations.map((st, i) => {
    const above = i % 2 === 0;
    const isTerminal = i === 0 || i === stations.length - 1;
    let cls = '';
    if (st === highlightFrom) cls = 'from';
    else if (st === highlightTo) cls = 'to';
    else if (lo >= 0 && i > lo && i < hi) cls = 'between';
    const inner = i === 0 ? '✈' : (i + 1);
    return `
      <button class="metro-station ${above ? 'above' : 'below'}" data-map-station="${esc(st)}">
        <span class="ms-label ${cls ? 'active' : ''}">${esc(st)}</span>
        <span class="ms-node ${cls} ${isTerminal ? 'terminal' : ''}">${inner}</span>
      </button>
    `;
  }).join('');

  return `
    <div class="metro-map">
      <div class="metro-map-header">
        <div class="mmh-left">
          <span class="mmh-badge">R</span>
          <div>
            <div class="mmh-title">UPMRC Red Line · Lucknow Metro</div>
            <div class="mmh-sub">${stations.length} stations · North–South Corridor · tap a station to start a trip</div>
          </div>
        </div>
        <div class="mmh-hint">↔ scroll to see all stations</div>
      </div>
      <div class="metro-track-scroll">
        <div class="metro-line-wrap">
          <div class="metro-line"></div>
          <div class="metro-stations">${nodes}</div>
        </div>
      </div>
      <div class="metro-fare-legend">
        <span class="mfl-label">Fares:</span>
        <span class="mfl-item">1 stop ₹10</span>
        <span class="mfl-item">2 stops ₹15</span>
        <span class="mfl-item">3–6 ₹20</span>
        <span class="mfl-item">7–9 ₹30</span>
        <span class="mfl-item">10–13 ₹40</span>
        <span class="mfl-item">14+ ₹50–60</span>
      </div>
    </div>
  `;
}

// Render transit menu
function renderTransitMenu() {
  const s = state;
  return `
    <main class="kiosk-main transit-screen">
      <div class="screen-header">
        <button class="back-btn" id="back">←</button>
        <div>
          <h2 class="screen-title">Metro Transit</h2>
          <p class="screen-subtitle">View the metro map, book a new trip, or use existing tickets</p>
        </div>
      </div>

      <div class="transit-scroll">
        ${renderMetroMap(s.transitFrom, s.transitTo)}

        <div class="transit-options">
          <button class="transit-option-btn" id="new-trip">
            <span class="icon">🎫</span>
            <span>Book New Trip</span>
          </button>
        </div>

        ${s.tickets.length ? `
          <div class="section-header" style="margin-top: 16px;">
            <span class="section-title">Your Active Tickets</span>
          </div>
          <div class="tickets-list">
            ${s.tickets.map(t => `
              <div class="ticket-card" data-ticket="${t.ticketId}">
                <div class="ticket-route">
                  <span>${esc(t.from)}</span>
                  <span style="color: var(--text-muted);">→</span>
                  <span>${esc(t.to)}</span>
                </div>
                <div class="ticket-meta">
                  <div class="ticket-status">${t.status === 'ENTRY_USED' ? 'Tap to Exit' : 'Tap to Enter'}</div>
                  <div class="ticket-fare">₹${t.fare}</div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    </main>
  `;
}

// Render station selection
function renderStationSelection(isFrom) {
  const s = state;
  const stations = isFrom ? s.stations : s.stations.filter(x => x !== s.transitFrom);
  
  return `
    <main class="kiosk-main transit-screen">
      <div class="screen-header">
        <button class="back-btn" id="back">←</button>
        <div>
          <h2 class="screen-title">${isFrom ? 'Select Origin' : `From ${esc(s.transitFrom)} → Select Destination`}</h2>
          <p class="screen-subtitle">Choose your ${isFrom ? 'starting' : 'destination'} station</p>
        </div>
      </div>
      
      <div class="stations-grid">
        ${stations.map(st => `
          <button class="station-btn" data-station="${esc(st)}">${esc(st)}</button>
        `).join('')}
      </div>
    </main>
  `;
}

// Render transit confirm
function renderTransitConfirm() {
  const s = state;
  return `
    <main class="kiosk-main">
      <div class="confirm-screen">
        <div class="confirm-card">
          <div class="confirm-route">
            <span>${esc(s.transitFrom)}</span>
            <span class="confirm-arrow">→</span>
            <span>${esc(s.transitTo)}</span>
          </div>
          <div class="confirm-amount">₹${s.transitFare}</div>
          <div class="confirm-instruction">
            <span>📡</span>
            <span>Tap your card on the reader to pay</span>
          </div>
        </div>
        
        <div class="confirm-buttons">
          <button class="confirm-btn cancel" id="back">Cancel</button>
        </div>
      </div>
    </main>
  `;
}

// Render ticket usage screen
function renderTicketScreen() {
  const t = state.selectedTicket;
  const isExit = t.status === 'ENTRY_USED';
  
  return `
    <main class="kiosk-main">
      <div class="confirm-screen">
        <div class="confirm-card">
          <h3 style="font-size: 20px; margin-bottom: 16px; color: var(--info);">
            ${isExit ? 'Exit Gate' : 'Entry Gate'}
          </h3>
          <div class="confirm-route">
            <span>${esc(t.from)}</span>
            <span class="confirm-arrow">→</span>
            <span>${esc(t.to)}</span>
          </div>
          <p style="font-family: monospace; font-size: 11px; color: var(--text-muted); margin: 16px 0;">
            ${esc(t.ticketId)}
          </p>
          <div class="confirm-instruction">
            <span>📡</span>
            <span>Tap card to ${isExit ? 'exit' : 'enter'}</span>
          </div>
        </div>
        
        <div class="confirm-buttons">
          <button class="confirm-btn cancel" id="back">← Back</button>
        </div>
      </div>
    </main>
  `;
}

// Render shop carts
function renderShopCarts() {
  const s = state;
  return `
    <main class="kiosk-main carts-screen">
      <div class="screen-header">
        <button class="back-btn" id="back">←</button>
        <div>
          <h2 class="screen-title">Shopping Carts</h2>
          <p class="screen-subtitle">Select a cart to pay</p>
        </div>
      </div>
      
      ${s.carts.length ? `
        <div class="carts-list">
          ${s.carts.map(c => `
            <div class="cart-card" data-cart="${c.cartId}">
              <div class="cart-info">
                <h3>${c.items?.length || 0} items</h3>
                <p>${new Date(c.createdAt).toLocaleString('en-IN')}</p>
              </div>
              <div class="cart-total">₹${c.total}</div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="empty-state">
          <span class="empty-icon">🛒</span>
          <h3 class="empty-title">No Carts Available</h3>
          <p class="empty-text">Use "Pay via Card" in the OneLink Shop app to create a cart for kiosk payment.</p>
        </div>
      `}
    </main>
  `;
}

// Render cart review
function renderCartReview() {
  const c = state.selectedCart;
  const items = (c.items || []).map(i => `
    <div class="cart-item">
      <div>
        <div class="item-name">${esc(i.name)}</div>
        <div class="item-qty">Qty: ${i.quantity}</div>
      </div>
      <div class="item-price">₹${i.price * i.quantity}</div>
    </div>
  `).join('');
  
  return `
    <main class="kiosk-main cart-review">
      <div class="screen-header">
        <button class="back-btn" id="back">←</button>
        <div>
          <h2 class="screen-title">Cart Review</h2>
          <p class="screen-subtitle">${c.items?.length || 0} items</p>
        </div>
      </div>
      
      <div class="cart-items">${items}</div>
      
      <div class="cart-summary">
        <div class="cart-summary-total">Total: ₹${c.total}</div>
        <div class="confirm-instruction">
          <span>📡</span>
          <span>Tap your card on the reader to pay</span>
        </div>
      </div>
    </main>
  `;
}

// ── Canteen screens ──────────────────────────────────────────────────────────

function renderCanteenHome() {
  const s = state;
  const cat = s.canteenCategory || 'All';
  const menu = (s.canteenMenu || []).filter((i) => cat === 'All' || i.category === cat);
  const localCart = s.canteenLocalCart || [];
  const pending = s.canteenCarts || [];
  const total = canteenLocalCartTotal();
  const nowServing = s.canteenQueue?.nowServing || 0;

  const pendingHtml = pending.length ? `
    <div class="canteen-pending">
      <h3 class="canteen-section-title">Your app carts — tap to pay</h3>
      ${pending.map((c) => `
        <div class="canteen-pending-card ${s.selectedCanteenCart?.cartId === c.cartId ? 'selected' : ''}" data-cncart="${esc(c.cartId)}">
          <div>
            <strong>${c.items?.length || 0} items</strong>
            <span class="muted">${new Date(c.createdAt).toLocaleString('en-IN')}</span>
          </div>
          <div class="canteen-pending-total">₹${c.total}</div>
        </div>
      `).join('')}
    </div>
  ` : '';

  return `
    <main class="kiosk-main canteen-screen">
      <div class="screen-header canteen-header-compact">
        <button class="back-btn" id="back">←</button>
        <div>
          <h2 class="screen-title">🍽️ Canteen</h2>
          <p class="screen-subtitle">${menu.length} items · Now serving #${nowServing || '—'} · ${s.userName ? esc(s.userName.split(' ')[0]) : 'Guest'}</p>
        </div>
        <button class="canteen-service-btn" id="canteen-service-link">Service Board</button>
      </div>

      ${pendingHtml}

      <div class="canteen-cats">
        ${(s.canteenCategories || ['All']).map((c) => `
          <button class="canteen-cat ${cat === c ? 'active' : ''}" data-cncat="${esc(c)}">${esc(c)}</button>
        `).join('')}
      </div>

      <div class="canteen-layout">
        <div class="canteen-grid">
          ${menu.map((item) => {
            const qty = localCart.find((c) => c.productId === item.productId)?.quantity || 0;
            return `
              <div class="canteen-item" data-cn-item="${esc(item.productId)}" data-cndetail="${esc(item.productId)}">
                <img class="canteen-img" src="${esc(resolveCanteenImageUrl(item.imageUrl))}" alt="${esc(item.name)}"
                  loading="lazy" decoding="async"
                  onerror="this.onerror=null;this.src='/kiosk/canteen-images/_pending.jpg'" />
                <div class="canteen-item-body">
                  <div class="canteen-item-cat">${esc(item.category)}</div>
                  <div class="canteen-item-name">${esc(item.name)}</div>
                  ${item.description ? `<div class="canteen-item-desc">${esc(item.description)}</div>` : ''}
                  <div class="canteen-item-row">
                    <span class="canteen-price">₹${Number(item.price) || 0}</span>
                    <div class="canteen-actions">
                      ${qty > 0 ? `
                        <div class="canteen-qty">
                          <button type="button" data-cndec="${esc(item.productId)}" aria-label="Decrease">−</button>
                          <span>${qty}</span>
                          <button type="button" data-cnadd="${esc(item.productId)}" aria-label="Increase">+</button>
                        </div>
                      ` : `
                        <button type="button" class="canteen-add" data-cnadd="${esc(item.productId)}">Add</button>
                      `}
                    </div>
                  </div>
                </div>
              </div>
            `;
          }).join('') || '<div class="empty-state"><p>Loading menu…</p></div>'}
        </div>

        <aside class="canteen-cart-panel">
          <h3>Cart</h3>
          <div class="canteen-cart-scroll">
          ${s.selectedCanteenCart ? `
            <p class="muted">Paying app cart · ${s.selectedCanteenCart.items?.length || 0} items</p>
            ${(s.selectedCanteenCart.items || []).map((i) => `
              <div class="canteen-cart-line"><span>${i.quantity}× ${esc(i.name)}</span><span>₹${i.price * i.quantity}</span></div>
            `).join('')}
            <div class="canteen-cart-total">₹${s.selectedCanteenCart.total}</div>
          ` : localCart.length ? `
            ${localCart.map((i) => `
              <div class="canteen-cart-line">
                <span>${i.quantity}× ${esc(i.name)}</span>
                <span>₹${i.price * i.quantity}</span>
              </div>
            `).join('')}
            <div class="canteen-cart-total">₹${total}</div>
          ` : `
            <p class="muted">Scroll the menu and tap Add on any item</p>
          `}
          </div>
          ${s.selectedCanteenCart ? `
            <button class="canteen-checkout-btn" id="canteen-checkout">Tap card to pay</button>
            <button class="canteen-clear-btn" id="canteen-clear-pending">Clear selection</button>
          ` : localCart.length ? `
            <button class="canteen-checkout-btn" id="canteen-checkout">Checkout · Tap card</button>
            <button class="canteen-clear-btn" id="canteen-clear-local">Clear cart</button>
          ` : ''}
        </aside>
      </div>
    </main>
  `;
}

function renderCanteenCheckout() {
  const cart = state.selectedCanteenCart;
  const local = state.canteenLocalCart || [];
  const items = cart ? (cart.items || []) : local;
  const total = cart ? cart.total : canteenLocalCartTotal();
  return `
    <main class="kiosk-main cart-review">
      <div class="screen-header">
        <button class="back-btn" id="back">←</button>
        <div>
          <h2 class="screen-title">Canteen Checkout</h2>
          <p class="screen-subtitle">${items.length} items · ₹${total}</p>
        </div>
      </div>
      <div class="cart-items">
        ${items.map((i) => `
          <div class="cart-item">
            <div>
              <div class="item-name">${esc(i.name)}</div>
              <div class="item-qty">Qty: ${i.quantity}</div>
            </div>
            <div class="item-price">₹${i.price * i.quantity}</div>
          </div>
        `).join('')}
      </div>
      <div class="cart-summary">
        <div class="cart-summary-total">Total: ₹${total}</div>
        <div class="confirm-instruction">
          <span>📡</span>
          <span>Tap your OneLink card to pay</span>
        </div>
      </div>
    </main>
  `;
}

function renderCanteenPaid() {
  const o = state.lastCanteenOrder || {};
  return `
    <main class="kiosk-main">
      <div class="result-screen">
        <div class="result-icon success">✓</div>
        <h2 class="result-title success">Order placed!</h2>
        <p class="result-message">Your order number</p>
        <div class="canteen-order-big">#${o.orderNumber ?? '—'}</div>
        <p class="result-message">Paid ₹${o.amount ?? o.total ?? 0} · ETA ~${o.etaMinutes ?? 2} min</p>
        <p class="result-message muted">Watch the service board — tap your ready order number to collect</p>
        <button class="result-btn" id="canteen-goto-service">Open Service Board</button>
      </div>
    </main>
  `;
}

function renderCanteenService() {
  const q = state.canteenQueue || { nowServing: 0, orders: [] };
  let mine = state.lastCanteenOrder;
  if ((!mine || mine.status === 'COLLECTED') && !state.canteenCollectOrderNumber) {
    try {
      const raw = localStorage.getItem('onelink_canteen_pending_collect');
      if (raw) mine = JSON.parse(raw);
    } catch (_) {}
  }
  const myNum = mine?.orderNumber ?? state.canteenCollectOrderNumber;
  const myReady = myNum != null && (
    mine?.status === 'READY' ||
    myNum <= (q.nowServing || 0)
  );
  const list = (q.orders || []).slice(0, 16);
  const err = state.error
    ? `<div class="canteen-collect-error">${esc(state.error)}</div>`
    : '';

  return `
    <main class="kiosk-main canteen-service-screen">
      <div class="screen-header">
        <button class="back-btn" id="back">←</button>
        <div>
          <h2 class="screen-title">Canteen Service</h2>
          <p class="screen-subtitle">Tap a ready order number, then tap your card to collect</p>
        </div>
      </div>
      <div class="canteen-now-serving">
        <div class="cns-label">Now Serving</div>
        <div class="cns-number">#${q.nowServing || 0}</div>
      </div>
      ${err}
      ${myNum != null ? `
        <div class="canteen-your-order ${myReady ? 'ready' : ''}">
          <div>Your order <strong>#${myNum}</strong>${mine?.status ? ` · ${esc(mine.status)}` : ''}</div>
          ${myReady
            ? `<button class="canteen-checkout-btn" id="canteen-collect" data-collect="${myNum}">Tap card to collect</button>`
            : `<p class="muted">Please wait — about ${Math.max(0, myNum - (q.nowServing || 0)) * 2} min</p>
               <button class="canteen-checkout-btn canteen-checkout-btn-secondary" id="canteen-collect" data-collect="${myNum}">Tap card when ready</button>`
          }
        </div>
      ` : `
        <p class="muted" style="text-align:center;margin:12px 0">Select any <strong>READY</strong> order below to collect with the card that paid for it</p>
      `}
      <h3 class="canteen-section-title">Orders — tap READY to collect</h3>
      <div class="canteen-queue-list">
        ${list.map((o) => {
          const ready = o.status === 'READY' || o.orderNumber <= (q.nowServing || 0);
          if (ready && o.status !== 'COLLECTED') {
            return `
              <button type="button" class="canteen-queue-chip ready canteen-queue-chip-btn"
                data-cn-collect="${o.orderNumber}"
                title="Tap to collect order #${o.orderNumber}">
                #${o.orderNumber} · READY · Tap to collect
              </button>`;
          }
          return `
            <div class="canteen-queue-chip ${o.status === 'COLLECTED' ? 'collected' : ''}">
              #${o.orderNumber} · ${esc(o.status || 'PREPARING')}
            </div>`;
        }).join('') || '<p class="muted">No orders in queue</p>'}
      </div>
      <div class="quick-actions">
        <button class="quick-action-btn" id="canteen-back-menu">← Back to Menu</button>
        <button class="quick-action-btn" id="done">Done</button>
      </div>
    </main>
  `;
}

function renderCanteenCollect() {
  return `
    <main class="kiosk-main">
      <div class="result-screen">
        <div class="result-icon success" style="font-size:48px">📡</div>
        <h2 class="result-title">Collect Order #${state.canteenCollectOrderNumber}</h2>
        <p class="result-message">Tap the same card you used to pay to collect your order and get the receipt</p>
        <button class="result-btn" id="back">Cancel</button>
      </div>
    </main>
  `;
}

function renderCanteenCollected() {
  const o = state.lastCanteenOrder || {};
  const items = (o.items || []).map((i) => `
    <div class="cart-item">
      <div class="item-name">${i.quantity}× ${esc(i.name)}</div>
      <div class="item-price">₹${i.price * i.quantity}</div>
    </div>
  `).join('');
  return `
    <main class="kiosk-main">
      <div class="result-screen">
        <div class="result-icon success">✓</div>
        <h2 class="result-title success">Enjoy your meal!</h2>
        <p class="result-message">Order #${o.orderNumber ?? '—'} collected</p>
        <div class="cart-items" style="max-width:480px;width:100%;margin:0 auto">${items}</div>
        <p class="result-message muted">Receipt #${esc(o.receiptId || '')} · also in the app Canteen tab</p>
        <button class="result-btn" id="done">Done</button>
      </div>
    </main>
  `;
}

// Render parking grid
function renderParkingGrid() {
  const s = state;
  const zones = ['A', 'B', 'C', 'D', 'E'];
  
  const zonesHtml = zones.map(z => {
    const zspots = s.spots.filter(p => p.zone === z);
    if (!zspots.length) return '';
    
    return `
      <div class="zone-section">
        <div class="zone-header">Zone ${z}</div>
        <div class="spots-grid">
          ${zspots.map(p => {
            const mine = isMyParkingSpot(p);
            const canVacate = mine && p.status === 'OCCUPIED';
            const canPick = p.status === 'FREE';
            const action = canVacate ? 'vacate' : canPick ? 'allocate' : 'none';
            
            let statusClass = 'occupied';
            let statusText = 'Occupied';
            
            if (p.status === 'FREE') {
              statusClass = 'free';
              statusText = 'Available';
            } else if (canVacate) {
              statusClass = 'mine';
              statusText = 'Your Spot';
            } else if (p.status === 'RESERVED') {
              statusClass = 'reserved';
              statusText = 'Reserved';
            }
            
            return `
              <button class="spot-btn ${statusClass}" 
                      data-spot="${p.spotId}" 
                      data-spot-action="${action}"
                      ${action === 'none' ? 'disabled' : ''}>
                <div class="spot-id">${p.spotId}</div>
                <div class="spot-status">${statusText}</div>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
  
  return `
    <main class="kiosk-main parking-screen">
      <div class="screen-header">
        <button class="back-btn" id="back">←</button>
        <div>
          <h2 class="screen-title">Parking</h2>
          <p class="screen-subtitle">Select an available spot or manage your parking</p>
        </div>
      </div>
      
      ${s.activeParkingSpot ? `
        <div class="parking-alert">
          <div class="parking-alert-text">
            <span>🚗</span>
            <span>You're parked at <strong>${esc(s.activeParkingSpot)}</strong></span>
          </div>
          <button class="quick-action-btn danger" id="park-exit" style="flex: none; padding: 12px 20px;">
            Vacate & Pay
          </button>
        </div>
      ` : ''}
      
      <div class="parking-zones">${zonesHtml}</div>
    </main>
  `;
}

// Render parking confirm screens
function renderParkingVacate() {
  const s = state;
  const spot = s.spots.find(p => p.spotId === s.selectedSpot) || {};
  const mins = spotElapsedMinutes(spot);
  const rate = spot.ratePerMinute || s.activeParking?.ratePerMinute || 50;
  const est = mins * rate;
  const cannotAfford = Number(s.balance) < est;

  return `
    <main class="kiosk-main">
      <div class="confirm-screen">
        <div class="confirm-card">
          <h3 style="font-size: 20px; margin-bottom: 16px; color: var(--danger);">
            Vacate Parking
          </h3>
          <div style="font-size: 32px; font-weight: 700; margin-bottom: 8px;">
            ${esc(s.selectedSpot || s.activeParkingSpot)}
          </div>
          <p style="color: var(--text-secondary); margin-bottom: 16px;">
            ${esc(s.userName)} · ${mins} minutes parked · Balance ₹${Number(s.balance).toLocaleString('en-IN')}
          </p>
          <div class="confirm-amount">₹${est}</div>
          ${cannotAfford ? `
            <div class="recharge-callout" style="margin-top:0;">
              <div class="recharge-head"><span class="recharge-icon">⚠️</span><span>Insufficient balance</span></div>
              <p class="recharge-text">
                This will cost <strong>₹${est}</strong> but your balance is only
                <strong>₹${Number(s.balance).toLocaleString('en-IN')}</strong>.
                Recharge your OneLink wallet via the app, then tap your card.
              </p>
              <p class="recharge-url">onelink-wine-psi.vercel.app</p>
            </div>
          ` : `
            <div class="confirm-instruction">
              <span>📡</span>
              <span>Tap card to pay & leave</span>
            </div>
          `}
        </div>
        
        <div class="confirm-buttons">
          <button class="confirm-btn cancel" id="back">Cancel</button>
        </div>
      </div>
    </main>
  `;
}

function renderParkingAllocate() {
  const s = state;
  return `
    <main class="kiosk-main">
      <div class="confirm-screen">
        <div class="confirm-card">
          <h3 style="font-size: 20px; margin-bottom: 16px; color: var(--success);">
            Allocate Parking Spot
          </h3>
          <div style="font-size: 48px; font-weight: 700; margin: 24px 0;">
            ${esc(s.selectedSpot)}
          </div>
          <div class="confirm-instruction">
            <span>📡</span>
            <span>Tap card to confirm</span>
          </div>
        </div>
        
        <div class="confirm-buttons">
          <button class="confirm-btn cancel" id="back">Cancel</button>
        </div>
      </div>
    </main>
  `;
}

// Main render function
function render() {
  const s = state;
  let body = '';
  
  // Header (always visible)
  const header = renderHeader();
  
  // Main content based on step
  if (s.step === 'idle') {
    body = renderIdleScreen();
  } else if (s.step === 'checking') {
    body = renderLoadingScreen('Reading Card...');
  } else if (s.step === 'processing') {
    body = renderLoadingScreen(s.processingMsg || 'Processing...');
  } else if (s.step === 'pairing') {
    body = renderPairingScreen();
  } else if (s.step === 'home') {
    body = renderHomeScreen();
  } else if (s.step === 'guide') {
    body = renderGuideScreen();
  } else if (s.step === 'result') {
    body = renderResultScreen();
  } else if (s.step === 'transit_menu') {
    body = renderTransitMenu();
  } else if (s.step === 'transit_from') {
    body = renderStationSelection(true);
  } else if (s.step === 'transit_to') {
    body = renderStationSelection(false);
  } else if (s.step === 'transit_confirm') {
    body = renderTransitConfirm();
  } else if (s.step === 'transit_ticket') {
    body = renderTicketScreen();
  } else if (s.step === 'shop_carts') {
    body = renderShopCarts();
  } else if (s.step === 'shop_review') {
    body = renderCartReview();
  } else if (s.step === 'canteen_home') {
    body = renderCanteenHome();
  } else if (s.step === 'canteen_checkout') {
    body = renderCanteenCheckout();
  } else if (s.step === 'canteen_paid') {
    body = renderCanteenPaid();
  } else if (s.step === 'canteen_service') {
    body = renderCanteenService();
  } else if (s.step === 'canteen_collect') {
    body = renderCanteenCollect();
  } else if (s.step === 'canteen_collected') {
    body = renderCanteenCollected();
  } else if (s.step === 'parking_grid') {
    body = renderParkingGrid();
  } else if (s.step === 'parking_vacate') {
    body = renderParkingVacate();
  } else if (s.step === 'parking_allocate') {
    body = renderParkingAllocate();
  } else if (s.step === 'parking_exit_wait') {
    body = renderParkingVacate();
  }
  
  // Footer / help policy:
  // • idle (services welcome) → full footer with Need Help
  // • home (signed-in services) → Need Help is in quick actions (help-home)
  // • everywhere else → no help FAB (it collided with canteen/checkout UI)
  let footer = '';
  if (s.step === 'idle') {
    footer = renderFooter();
  }
  
  document.getElementById('app').innerHTML = header + body + footer;
}

function goBack() {
  if (document.getElementById('canteen-detail-overlay')) return closeCanteenDetail();
  if (state.step === 'guide') closeGuide();
  else if (['transit_from', 'transit_to', 'transit_confirm'].includes(state.step)) openTransit();
  else if (state.step === 'shop_review') openShop();
  else if (state.step === 'canteen_checkout') openCanteen(false);
  else if (state.step === 'canteen_collect') openCanteenService();
  else if (state.step === 'canteen_service') openCanteen(false);
  else if (state.step === 'canteen_home') {
    if (state.userName) setState({ step: 'home', service: null });
    else reset();
  }
  else if (state.step === 'parking_allocate' || state.step === 'parking_vacate') openParking();
  else if (state.step === 'transit_ticket') openTransit();
  else setState({ step: 'home', service: null });
}

function startVacate() {
  warmNow(); // wake the free-tier backend while the user reaches for their card
  setState({
    selectedSpot: state.activeParkingSpot,
    parkingMode: 'exit',
    awaitingTap: true,
    service: 'parking',
    step: 'parking_vacate',
  });
}

function handleKeypad(k) {
  if (k === 'C') setState({ digits: '', error: null });
  else if (k === '⌫') setState({ digits: state.digits.slice(0, -1), error: null });
  else if (state.digits.length < 10) {
    const digits = state.digits + k;
    setState({ digits, error: null });
    if (digits.length === 10) submitPair();
  }
}

function handleStation(st) {
  if (state.step === 'transit_from') {
    setState({ transitFrom: st, step: 'transit_to' });
  } else if (state.step === 'transit_to') {
    const fare = localSlabFare(state.transitFrom, st);
    warmNow();
    setState({ transitTo: st, transitFare: fare, step: 'transit_confirm', awaitingTap: true, service: 'transit' });
  }
}

function handleSpot(spotId, action) {
  if (action === 'vacate') {
    warmNow();
    setState({ selectedSpot: spotId, parkingMode: 'exit', step: 'parking_vacate', awaitingTap: true, service: 'parking' });
  } else if (action === 'allocate') {
    warmNow();
    setState({ selectedSpot: spotId, parkingMode: 'allocate', step: 'parking_allocate', awaitingTap: true, service: 'parking' });
  }
}

// Single delegated click handler for the whole kiosk — attached once, so no
// per-render listener rebinding. Runs in O(1) per click via closest().
let _cnTouchGuard = 0;
let _cnDetailTap = { id: null, t: 0 };

function isCanteenDetailDoubleTap(productId) {
  const id = String(productId || '');
  const now = Date.now();
  if (_cnDetailTap.id === id && now - _cnDetailTap.t < 450) {
    _cnDetailTap = { id: null, t: 0 };
    return true;
  }
  _cnDetailTap = { id, t: now };
  return false;
}

function handleAppClick(e) {
  const t = e.target;

  // Tactile feedback for any actionable element. Service cards and the back
  // button get their own (admin-customizable) sounds; everything else a press.
  if (window.Sound) {
    const actionable = t.closest(
      'button, [data-key], [data-station], [data-map-station], [data-ticket], [data-cart], [data-spot], [data-svc], [data-cnadd], [data-cndec], [data-cncart], [data-cncat], [data-cndetail], [data-cndetail-close], [data-cn-collect]'
    );
    if (actionable) {
      const svcEl = t.closest('[data-svc]');
      if (svcEl) window.Sound.service(svcEl.dataset.svc);
      else if (t.closest('#back')) window.Sound.back();
      else window.Sound.press();
    }
  }

  const detailClose = t.closest('[data-cndetail-close]');
  if (detailClose) return closeCanteenDetail();

  const keyBtn = t.closest('[data-key]');
  if (keyBtn) return handleKeypad(keyBtn.dataset.key);

  const stationBtn = t.closest('[data-station]');
  if (stationBtn) return handleStation(stationBtn.dataset.station);

  // Tapping a station on the metro map starts a trip from that station.
  const mapStationBtn = t.closest('[data-map-station]');
  if (mapStationBtn) {
    const from = mapStationBtn.dataset.mapStation;
    return setState({
      step: 'transit_to', service: 'transit',
      transitFrom: from, transitTo: null, transitFare: 0, awaitingTap: false,
    });
  }

  const ticketBtn = t.closest('[data-ticket]');
  if (ticketBtn) {
    const ticket = state.tickets.find((x) => x.ticketId === ticketBtn.dataset.ticket);
    warmNow();
    return setState({ selectedTicket: ticket, step: 'transit_ticket', awaitingTap: true, service: 'transit' });
  }

  const cartBtn = t.closest('[data-cart]');
  if (cartBtn) {
    const cart = state.carts.find((x) => x.cartId === cartBtn.dataset.cart);
    warmNow();
    return setState({ selectedCart: cart, step: 'shop_review', awaitingTap: true, service: 'shop' });
  }

  const cnAdd = t.closest('[data-cnadd]');
  if (cnAdd) return canteenAddItem(cnAdd.dataset.cnadd);

  const cnDec = t.closest('[data-cndec]');
  if (cnDec) return canteenDecItem(cnDec.dataset.cndec);

  const cnCollect = t.closest('[data-cn-collect]');
  if (cnCollect) {
    if (Date.now() - _cnTouchGuard < 400) return;
    const orderNum = Number(cnCollect.getAttribute('data-cn-collect'));
    if (Number.isFinite(orderNum) && orderNum > 0) return startCanteenCollect(orderNum);
  }

  const cnDetail = t.closest('[data-cndetail]');
  if (cnDetail) {
    if (Date.now() - _cnTouchGuard < 400) return;
    const pid = cnDetail.getAttribute('data-cndetail') || cnDetail.dataset.cndetail;
    // Preview only on double-tap so scrolling doesn't open dishes by accident
    if (!isCanteenDetailDoubleTap(pid)) return;
    return openCanteenDetail(pid, cnDetail);
  }

  const cnCat = t.closest('[data-cncat]');
  if (cnCat) return setState({ canteenCategory: cnCat.dataset.cncat });

  const cnCart = t.closest('[data-cncart]');
  if (cnCart) {
    const cart = (state.canteenCarts || []).find((x) => x.cartId === cnCart.dataset.cncart);
    return setState({ selectedCanteenCart: cart, canteenLocalCart: [] });
  }

  const spotBtn = t.closest('[data-spot]');
  if (spotBtn) {
    const action = spotBtn.dataset.spotAction || 'allocate';
    if (action === 'none') return;
    return handleSpot(spotBtn.dataset.spot, action);
  }

  const svcBtn = t.closest('[data-svc]');
  if (svcBtn) {
    const svc = svcBtn.dataset.svc;
    if (svc === 'shop') return openShop();
    if (svc === 'transit') return openTransit();
    if (svc === 'parking') return openParking();
    if (svc === 'canteen') return openCanteen(false);
    return;
  }

  const idEl = t.closest('[id]');
  switch (idEl && idEl.id) {
    case 'sound-toggle': return toggleSound();
    case 'orient-toggle': return toggleKioskOrientation();
    case 'reader-status': return configureReader();
    case 'cancel':
    case 'done':
    case 'continue': return reset();
    case 'help-btn':
    case 'help-home': return openGuide();
    case 'back': return goBack();
    case 'new-trip': return setState({ step: 'transit_from', transitFrom: null, transitTo: null });
    case 'park-exit':
    case 'quick-vacate': return startVacate();
    case 'idle-canteen': return openCanteen(true);
    case 'canteen-checkout': return startCanteenCheckout();
    case 'canteen-clear-local': return setState({ canteenLocalCart: [] });
    case 'canteen-clear-pending': return setState({ selectedCanteenCart: null });
    case 'canteen-service-link':
    case 'canteen-goto-service': return openCanteenService();
    case 'canteen-back-menu': return openCanteen(false);
    case 'canteen-collect':
      return startCanteenCollect(idEl.dataset.collect || state.lastCanteenOrder?.orderNumber);
    default: return;
  }
}

// Initialize
render();
// Load any admin-uploaded custom kiosk sounds, then start the background pad.
// (Falls back to the built-in synthesized sounds if none are uploaded.)
fetch(`${BACKEND}/kiosk/sounds`)
  .then((r) => r.json())
  .then((m) => { if (window.Sound && m && m.success) window.Sound.configure(m, BACKEND); })
  .catch(() => {})
  .finally(() => updateAmbient());
updateAmbient();
// Attach ONE delegated click listener to the persistent #app container.
document.getElementById('app').addEventListener('click', handleAppClick);
// Collect chips: respond on touch without waiting for click. Dish preview stays double-tap via click.
document.getElementById('app').addEventListener('touchend', (e) => {
  const t = e.target;
  if (!t || !t.closest) return;
  if (t.closest('[data-cnadd], [data-cndec], [data-cndetail-close], [data-cndetail]')) return;
  const collect = t.closest('[data-cn-collect]');
  if (collect) {
    e.preventDefault();
    _cnTouchGuard = Date.now();
    const orderNum = Number(collect.getAttribute('data-cn-collect'));
    if (Number.isFinite(orderNum) && orderNum > 0) startCanteenCollect(orderNum);
  }
}, { passive: false });

connectWs();
loadStations();
fetchWeather();
setInterval(fetchWeather, 600000); // Update weather every 10 minutes

// One warm on boot only — do NOT ping Render on a timer (burns free instance hours).
// Predictive warm starts as soon as someone touches the kiosk so cold boots finish
// before the RFID tap / payment.
warmNow();

document.addEventListener('pointerdown', () => {
  noteUserActivity();
  predictiveWarm();
}, { passive: true });
document.addEventListener('touchstart', () => {
  noteUserActivity();
  predictiveWarm();
}, { passive: true });
document.addEventListener('keydown', () => {
  noteUserActivity();
  predictiveWarm();
});

// Warm when the kiosk tab becomes visible again (may have slept while hidden).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    noteUserActivity();
    warmNow();
    if (wsIdlePaused) {
      wsIdlePaused = false;
      connectWs();
    }
  }
});
window.addEventListener('focus', () => {
  noteUserActivity();
  warmNow();
});

// Pause reader WS after long idle so we are not stuck in reconnect loops when
// the kiosk is unused overnight. Render free hours are saved by NOT pinging
// the cloud on a timer; local WS pause is complementary hygiene.
setInterval(() => {
  if (wsIdlePaused) return;
  if (Date.now() - lastUserActivityAt >= WS_IDLE_DISCONNECT_MS) {
    disconnectWsForIdle();
  }
}, 60000);

// Keep layout in sync when the tablet is physically rotated (Tab A 10.1").
function onDeviceOrientationChange() {
  let physical = 'landscape';
  try {
    if (window.matchMedia('(orientation: portrait)').matches) physical = 'portrait';
  } catch (_) { /* ignore */ }
  if (physical === getKioskOrientation()) return;
  applyKioskOrientation(physical);
  render();
}
window.addEventListener('orientationchange', () => setTimeout(onDeviceOrientationChange, 120));
try {
  window.matchMedia('(orientation: portrait)').addEventListener('change', onDeviceOrientationChange);
} catch (_) {
  try {
    window.matchMedia('(orientation: portrait)').addListener(onDeviceOrientationChange);
  } catch (_) { /* older WebViews */ }
}

// ── Live session sync ──────────────────────────────────────────────
// While a user is active on a non-payment screen, re-read their card from the
// backend so wallet balance, loyalty points, tickets and carts reflect activity
// done elsewhere (e.g. a top-up in the OneLink app) in near real time — without
// requiring the user to re-tap. Also ends the session if the card gets locked.
const LIVE_REFRESH_STEPS = new Set([
  'home', 'transit_menu', 'transit_from', 'transit_to', 'shop_carts', 'parking_grid',
  'canteen_home', 'canteen_service',
]);

let refreshInFlight = false;
async function refreshSession() {
  if (!state.cardUid || !state.userId) return;
  if (!LIVE_REFRESH_STEPS.has(state.step)) return;
  // Don't let 5s ticks pile up while a slow (cold-starting) request is pending.
  if (refreshInFlight) return;
  refreshInFlight = true;
  try {
    const { data } = await api('POST', '/kiosk/check-card', { cardUid: state.cardUid });
    if (!data) return;
    if (data.blocked) {
      // Card was locked from the app during the session — end it safely.
      setState({
        step: 'result',
        error: data.error || 'This card was locked in the OneLink app.',
        resultMsg: 'Card Locked',
        insufficientBalance: false,
      });
      setTimeout(reset, 7000);
      return;
    }
    if (!data.registered) return;

    const nextTickets = data.activeTickets ?? state.tickets;
    const nextCarts = data.pendingCarts ?? state.carts;
    const nextCanteenCarts = data.pendingCanteenCarts ?? state.canteenCarts;
    const changed =
      (typeof data.balance === 'number' && data.balance !== state.balance) ||
      (typeof data.loyaltyPoints === 'number' && data.loyaltyPoints !== state.loyaltyPoints) ||
      (nextTickets.length !== state.tickets.length) ||
      (nextCarts.length !== state.carts.length) ||
      (nextCanteenCarts.length !== (state.canteenCarts || []).length) ||
      ((data.activeParkingSpot || null) !== (state.activeParkingSpot || null));

    if (!changed) return; // avoid needless re-renders / tap interruptions

    setState({
      balance: typeof data.balance === 'number' ? data.balance : state.balance,
      loyaltyPoints: typeof data.loyaltyPoints === 'number' ? data.loyaltyPoints : state.loyaltyPoints,
      memberTier: data.memberTier || state.memberTier,
      dailyLimit: typeof data.dailyLimit === 'number' ? data.dailyLimit : state.dailyLimit,
      lastTopUp: data.lastTopUp ?? state.lastTopUp,
      tickets: nextTickets,
      carts: nextCarts,
      canteenCarts: nextCanteenCarts,
      activeParkingSpot: data.activeParkingSpot ?? state.activeParkingSpot,
      activeParking: data.activeParking ?? state.activeParking,
    });
  } catch (_) {
    /* transient network/backend error — try again next tick */
  } finally {
    refreshInFlight = false;
  }
}

setInterval(refreshSession, 5000); // every 5s (well under the 30/min rate limit)
