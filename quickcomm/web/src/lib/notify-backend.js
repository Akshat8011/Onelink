/**
 * Notify the Render backend so it can emit Socket.IO events to the mobile
 * webapp after the kiosk serverless function writes to MongoDB. This closes the
 * loop so a physical NFC tap at the kiosk immediately refreshes the wallet
 * balance shown in the mobile app (kiosk → webapp), mirroring the webapp →
 * kiosk balance polling.
 *
 * No-ops safely when INTERNAL_NOTIFY_KEY is not configured.
 */

const BACKEND_URL =
  process.env.BACKEND_NOTIFY_URL || 'https://onelink-fkqd.onrender.com/api/v1/internal/notify';
const NOTIFY_KEY = process.env.INTERNAL_NOTIFY_KEY || process.env.HARDWARE_TAP_API_KEY || '';

export async function notifyBackend({ userId, event, data, broadcast = false }) {
  if (!NOTIFY_KEY) {
    console.warn('[notify-backend] INTERNAL_NOTIFY_KEY not set — skipping socket push');
    return;
  }
  try {
    await fetch(BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${NOTIFY_KEY}`,
      },
      body: JSON.stringify({ userId, event, data, broadcast }),
    });
  } catch (err) {
    console.error('[notify-backend] Failed:', err?.message || err);
  }
}
