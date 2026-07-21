/**
 * OneLink Kiosk — Sound & Chime engine
 *
 * Playback uses HTMLAudioElement (not the Web Audio API): the kiosk flow is
 * driven by NFC card taps over WebSocket / async results with no DOM gesture,
 * and the Web Audio autoplay policy needs a gesture. HTML media elements obey
 * the kiosk's "autoplay music" setting instead, so they play without one.
 *
 * Everything is synthesized to WAV data URIs once at load. To make playback
 * INSTANT (no per-tap decode lag) we preload a small pool of Audio elements per
 * sound and just reset+play the next free one.
 *
 * Public API (used by app.js):
 *   Sound.welcome() / cardTap() / tap() / success() / error()
 *   Sound.ambient(bool)          — looping soothing pad for homepage/services
 *   Sound.isEnabled() / setEnabled(bool) / unlock()
 */
(function () {
  var SR = 22050;
  var cache = {};  // name -> WAV data URI
  var pools = {};  // name -> { els: Audio[], idx }
  var ambientEl = null;
  var ambientWanted = false;

  var enabled = (function () {
    try { return localStorage.getItem('onelink_kiosk_sound') !== 'off'; } catch (_) { return true; }
  })();

  // ── WAV encoding ─────────────────────────────────────────────────
  function encodeWav(samples) {
    var len = samples.length;
    var buffer = new ArrayBuffer(44 + len * 2);
    var view = new DataView(buffer);
    function str(off, s) { for (var i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); }
    str(0, 'RIFF'); view.setUint32(4, 36 + len * 2, true); str(8, 'WAVE');
    str(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); view.setUint32(24, SR, true); view.setUint32(28, SR * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    str(36, 'data'); view.setUint32(40, len * 2, true);
    var off = 44;
    for (var i = 0; i < len; i++) {
      var s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
    return buffer;
  }

  function toDataUri(buffer) {
    var bytes = new Uint8Array(buffer);
    var bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return 'data:audio/wav;base64,' + btoa(bin);
  }

  function shape(type, phase) {
    switch (type) {
      case 'triangle': return (2 / Math.PI) * Math.asin(Math.sin(phase));
      case 'square':   return Math.sin(phase) >= 0 ? 1 : -1;
      case 'sawtooth': var t = phase / (2 * Math.PI); t -= Math.floor(t); return 2 * t - 1;
      default:         return Math.sin(phase);
    }
  }

  // Render notes to a Float32 buffer with a smooth attack + exponential decay
  // and a tiny release fade so notes never end on a click.
  // note = { freq, start, dur, gain, type, attack, decay }  (type 'noise' = click)
  function synth(notes) {
    var total = 0, i, n;
    for (i = 0; i < notes.length; i++) total = Math.max(total, notes[i].start + notes[i].dur + 0.02);
    var len = Math.ceil(total * SR);
    var buf = new Float32Array(len);
    var rel = Math.floor(0.008 * SR);
    for (var ni = 0; ni < notes.length; ni++) {
      n = notes[ni];
      var s0 = Math.floor(n.start * SR);
      var s1 = Math.floor((n.start + n.dur) * SR);
      var span = Math.max(1, s1 - s0);
      var gain = n.gain != null ? n.gain : 0.25;
      var attack = Math.max(1, Math.floor((n.attack != null ? n.attack : 0.006) * SR));
      var decay = n.decay != null ? n.decay : 5;
      var type = n.type || 'sine';
      var phase = 0;
      for (i = s0; i < s1 && i < len; i++) {
        var k = i - s0;
        var sample = type === 'noise' ? (Math.random() * 2 - 1) : shape(type, (phase += (2 * Math.PI * n.freq) / SR));
        var env;
        if (k < attack) env = k / attack;
        else env = Math.exp(-decay * ((k - attack) / SR));
        var toEnd = span - k;
        if (toEnd < rel) env *= toEnd / rel;
        buf[i] += sample * gain * env;
      }
    }
    for (i = 0; i < len; i++) buf[i] = Math.tanh(buf[i]);
    return buf;
  }

  function build(name, notes) {
    try { cache[name] = toDataUri(encodeWav(synth(notes))); } catch (_) {}
  }

  // ── Soothing looping ambient pad ─────────────────────────────────
  // A soft, warm chord that gently swells in and out; fading to silence at both
  // ends makes the loop seamless (a slow "breathing" pad) and relaxing.
  function buildAmbient() {
    var dur = 9.0;
    var len = Math.ceil(dur * SR);
    var buf = new Float32Array(len);
    var chord = [130.81, 164.81, 196.00, 261.63, 329.63, 392.00]; // C3 E3 G3 C4 E4 G4
    var gains = [0.11, 0.08, 0.08, 0.07, 0.05, 0.04];
    for (var c = 0; c < chord.length; c++) {
      var f = chord[c] * (1 + c * 0.0006); // slight detune for warmth
      var g = gains[c];
      var ph = 0;
      for (var i = 0; i < len; i++) {
        ph += (2 * Math.PI * f) / SR;
        var trem = 0.82 + 0.18 * Math.sin((2 * Math.PI * 0.09 * i) / SR + c * 1.3);
        buf[i] += Math.sin(ph) * g * trem;
      }
    }
    var fade = Math.floor(1.8 * SR);
    for (var j = 0; j < len; j++) {
      var e = 1;
      if (j < fade) e = j / fade;
      else if (j > len - fade) e = (len - j) / fade;
      buf[j] *= e;
    }
    for (var m = 0; m < len; m++) buf[m] = Math.tanh(buf[m] * 1.1);
    try { cache.ambient = toDataUri(encodeWav(buf)); } catch (_) {}
  }

  // ── Sound definitions ────────────────────────────────────────────
  // Crisp real-feel UI click: a tiny filtered noise tick + a short high ping.
  build('tap', [
    { type: 'noise', freq: 0,    start: 0, dur: 0.018, gain: 0.32, attack: 0.0005, decay: 140 },
    { freq: 2100,    start: 0,   dur: 0.03, type: 'sine', gain: 0.16, attack: 0.001, decay: 90 },
  ]);
  // Clean rising reader beep-beep.
  build('cardTap', [
    { freq: 784.0,  start: 0.00, dur: 0.10, type: 'sine', gain: 0.30, attack: 0.004, decay: 16 },
    { freq: 1174.7, start: 0.09, dur: 0.14, type: 'sine', gain: 0.30, attack: 0.004, decay: 11 },
  ]);
  // Short, warm greeting chime (used as an accent when services open).
  build('welcome', [
    { freq: 523.25, start: 0.00, dur: 0.28, type: 'sine', gain: 0.26, attack: 0.005, decay: 6 },
    { freq: 659.25, start: 0.09, dur: 0.28, type: 'sine', gain: 0.26, attack: 0.005, decay: 6 },
    { freq: 783.99, start: 0.18, dur: 0.55, type: 'sine', gain: 0.28, attack: 0.005, decay: 4 },
  ]);
  // Bright ascending "success" — clean sine bells (E5 · G#5 · B5 + octave sparkle).
  build('success', [
    { freq: 659.25,  start: 0.00, dur: 0.16, type: 'sine', gain: 0.30, attack: 0.003, decay: 9 },
    { freq: 830.61,  start: 0.10, dur: 0.16, type: 'sine', gain: 0.30, attack: 0.003, decay: 9 },
    { freq: 987.77,  start: 0.20, dur: 0.55, type: 'sine', gain: 0.32, attack: 0.003, decay: 4.5 },
    { freq: 1318.51, start: 0.20, dur: 0.55, type: 'sine', gain: 0.10, attack: 0.003, decay: 4.5 },
  ]);
  // Soft, non-harsh "denied" — two gentle descending sine tones (G#4 → D#4).
  build('error', [
    { freq: 415.30, start: 0.00, dur: 0.16, type: 'sine', gain: 0.30, attack: 0.004, decay: 12 },
    { freq: 311.13, start: 0.15, dur: 0.32, type: 'sine', gain: 0.30, attack: 0.004, decay: 7 },
  ]);
  buildAmbient();

  // ── Sound keys → default synthesized cache ───────────────────────
  // Admin can upload a custom file per key (see configure()); otherwise these
  // built-in sounds are used. Keys without their own synth reuse 'tap'.
  var DEFAULT_CACHE = {
    home: 'ambient', services: 'welcome', tap: 'tap', press: 'tap', back: 'tap',
    cardTap: 'cardTap', transit: 'tap', shop: 'tap', parking: 'tap',
    success: 'success', denied: 'error',
  };
  var custom = {};        // key -> remote url (admin upload)
  var customPools = {};   // key -> pool of Audio from remote url

  // ── Preloaded pools for instant playback ─────────────────────────
  function buildPool(src, size) {
    var els = [];
    for (var i = 0; i < size; i++) {
      var a = new Audio(src);
      a.preload = 'auto';
      a.volume = 0.9;
      try { a.load(); } catch (_) {}
      els.push(a);
    }
    return { els: els, idx: 0 };
  }
  function makePool(name, size) { if (cache[name]) pools[name] = buildPool(cache[name], size); }
  makePool('tap', 6);
  makePool('cardTap', 2);
  makePool('welcome', 2);
  makePool('success', 2);
  makePool('error', 2);

  function playPool(pool) {
    if (!pool) return;
    var a = pool.els[pool.idx];
    pool.idx = (pool.idx + 1) % pool.els.length;
    try {
      a.currentTime = 0;
      var p = a.play();
      if (p && typeof p.catch === 'function') p.catch(function () {});
    } catch (_) {}
  }

  // Play by admin key. UI taps always use built-in synth pools so clicks stay
  // instant — custom uploads only affect ambient / success / service cues.
  function play(key) {
    if (!enabled) return;
    var instant = key === 'tap' || key === 'press' || key === 'back';
    if (!instant && customPools[key]) return playPool(customPools[key]);
    var cn = DEFAULT_CACHE[key];
    if (cn && pools[cn]) playPool(pools[cn]);
  }

  function makeAmbientEl() {
    var src = custom.home || cache.ambient;
    if (!src) return;
    ambientEl = new Audio(src);
    ambientEl.loop = true;
    ambientEl.volume = 0.32;
    ambientEl.preload = 'auto';
    try { ambientEl.load(); } catch (_) {}
  }

  function ambient(on) {
    ambientWanted = on;
    if (!ambientEl) makeAmbientEl();
    if (!ambientEl) return;
    if (on && enabled) {
      var p = ambientEl.play();
      if (p && typeof p.catch === 'function') p.catch(function () {});
    } else {
      try { ambientEl.pause(); } catch (_) {}
    }
  }

  // Apply an admin sound manifest: { sounds: { key: {updatedAt} } } + base URL.
  function configure(manifest, baseUrl) {
    if (!manifest || !manifest.sounds) return;
    var base = String(baseUrl || '').replace(/\/$/, '');
    Object.keys(manifest.sounds).forEach(function (key) {
      var meta = manifest.sounds[key] || {};
      var v = meta.updatedAt ? encodeURIComponent(meta.updatedAt) : Date.now();
      var url = base + '/kiosk/sounds/' + encodeURIComponent(key) + '?v=' + v;
      custom[key] = url;
      if (key === 'home') {
        var wasPlaying = ambientEl && !ambientEl.paused;
        try { if (ambientEl) ambientEl.pause(); } catch (_) {}
        ambientEl = null;
        makeAmbientEl();
        if (wasPlaying || ambientWanted) ambient(true);
      } else {
        customPools[key] = buildPool(url, key === 'tap' || key === 'press' ? 5 : 2);
      }
    });
  }

  var API = {
    isEnabled: function () { return enabled; },
    setEnabled: function (on) {
      enabled = !!on;
      try { localStorage.setItem('onelink_kiosk_sound', enabled ? 'on' : 'off'); } catch (_) {}
      if (!enabled) { if (ambientEl) { try { ambientEl.pause(); } catch (_) {} } }
      else if (ambientWanted) ambient(true);
    },
    unlock: function () {},
    configure: configure,
    ambient: ambient,
    welcome: function () { play('services'); },
    cardTap: function () { play('cardTap'); },
    tap: function () { play('tap'); },
    press: function () { play('press'); },
    back: function () { play('back'); },
    service: function (kind) { play(kind); }, // 'transit' | 'shop' | 'parking'
    success: function () { play('success'); },
    error: function () { play('denied'); },
  };

  window.Sound = API;
})();
