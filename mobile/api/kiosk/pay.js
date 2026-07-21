/**
 * POST /api/kiosk/pay
 * Process payment from the Pi kiosk UI (no client-side API key required).
 * Body: { "cardUid": "72706D05", "terminalId": "metro_entry" }
 */

const { processHardwareTap } = require('../../lib/hardware-payment');

function jsonResponse(res, body, status = 200) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  res.status(status).json(body);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return jsonResponse(res, { success: false, error: 'Method not allowed. Use POST.' }, 405);
  }

  const cardUid = req.body?.cardUid ?? req.body?.uid;
  const terminalId = req.body?.terminalId ?? req.body?.node ?? 'main_kiosk';

  const result = await processHardwareTap(cardUid, terminalId);
  return jsonResponse(res, result.body, result.status);
};
