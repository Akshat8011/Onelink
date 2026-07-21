import crypto from 'crypto';

/**
 * The banks a OneLink user can hold. Every user is given two of these at
 * random; top-ups debit the chosen account's balance for real.
 */
export const BANK_CATALOG: Array<{ bankName: string; ifsc: string }> = [
  { bankName: 'HDFC Bank', ifsc: 'HDFC0001234' },
  { bankName: 'SBI', ifsc: 'SBIN0005678' },
  { bankName: 'PNB', ifsc: 'PUNB0012345' },
  { bankName: 'ICICI Bank', ifsc: 'ICIC0006789' },
];

export interface LinkedBank {
  bankName: string;
  accountNumber: string;
  balance: number;
  ifsc: string;
  isPrimary: boolean;
}

function randomAccountNumber(): string {
  return `xx${crypto.randomInt(1000, 9999)}`;
}

/** A realistic opening balance between ₹20,000 and ₹80,000. */
function randomOpeningBalance(): number {
  return 20000 + crypto.randomInt(0, 60001);
}

/** Pick `count` distinct banks at random and turn them into linked accounts. */
export function generateLinkedBanks(count = 2): LinkedBank[] {
  const pool = [...BANK_CATALOG];
  // Fisher–Yates shuffle (crypto-random) so the pair is genuinely varied.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length)).map((b, i) => ({
    bankName: b.bankName,
    accountNumber: randomAccountNumber(),
    balance: randomOpeningBalance(),
    ifsc: b.ifsc,
    isPrimary: i === 0,
  }));
}

/** Build one linked account for a specific bank (used to top users up to two). */
export function buildLinkedBank(bankName: string, ifsc: string, isPrimary: boolean): LinkedBank {
  return {
    bankName,
    accountNumber: randomAccountNumber(),
    balance: randomOpeningBalance(),
    ifsc,
    isPrimary,
  };
}
