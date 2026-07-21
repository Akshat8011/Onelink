const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

async function postJson(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export async function checkCard(cardUid: string, terminalId = 'main_kiosk') {
  return postJson('/api/kiosk/check-card', { cardUid, terminalId });
}

export async function pairCard(pairingToken: string, cardUid: string) {
  return postJson('/api/pair-card', { pairingToken, cardUid });
}

export async function processPayment(cardUid: string, terminalId: string) {
  return postJson('/api/kiosk/pay', { cardUid, terminalId });
}

export type KioskService = {
  id: string;
  label: string;
  amount: number;
  category: string;
};

export type CheckCardResult = {
  registered: boolean;
  pairingRequired?: boolean;
  blocked?: boolean;
  cardUid: string;
  name?: string;
  balance?: number;
  currency?: string;
  services?: KioskService[];
  error?: string;
  message?: string;
};
