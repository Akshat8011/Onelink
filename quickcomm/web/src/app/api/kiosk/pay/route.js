import { processHardwareTap } from '../../../../lib/hardware-payment';

function jsonResponse(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
  });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400);
  }

  const cardUid = body?.cardUid ?? body?.uid;
  const terminalId = body?.terminalId ?? body?.node ?? 'main_kiosk';

  const result = await processHardwareTap(cardUid, terminalId);
  return jsonResponse(result.body, result.status);
}

export async function GET() {
  return jsonResponse({ success: false, error: 'Method not allowed. Use POST.' }, 405);
}
