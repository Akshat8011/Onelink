/**
 * Notify Render backend to emit Socket.IO events to mobile apps.
 * Called after Vercel serverless writes to MongoDB.
 */

const BACKEND_URL = process.env.BACKEND_NOTIFY_URL || 'https://onelink-fkqd.onrender.com/api/v1/internal/notify';
const NOTIFY_KEY = process.env.INTERNAL_NOTIFY_KEY || process.env.HARDWARE_TAP_API_KEY || '';

async function notifyBackend({ userId, event, data, broadcast = false }) {
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
    console.error('[notify-backend] Failed:', err.message);
  }
}

module.exports = { notifyBackend };
