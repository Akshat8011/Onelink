import { create } from 'zustand';
import { getUserStorageItem, setUserStorageItem } from '../utils/userStorage';
import { useAuthStore } from './useAuthStore';
import { useWalletStore } from './useWalletStore';
import { useNotificationsStore } from './useNotificationsStore';
import { billPenalty, calcEmi, liveStockPrice, NSE_STOCKS, INSURANCE_PLANS, MUTUAL_FUNDS } from '../data/financialCatalog';

export interface UserBill {
  billId: string;
  name: string;
  provider: string;
  amount: number;
  dueDate: string;
  category: string;
  isPaid: boolean;
  paidAt?: string;
  penaltyPerDay: number;
}

export interface Holding {
  holdingId: string;
  type: 'STOCK' | 'FD' | 'MF';
  symbol: string;
  name: string;
  units: number;
  avgPrice: number;
  investedAt: string;
  /** Annual return rate (%) used for compounding FD / MF holdings. */
  annualRate?: number;
}

export interface UserLoan {
  loanId: string;
  bankName: string;
  loanType: string;
  principal: number;
  rate: number;
  tenureMonths: number;
  emi: number;
  remainingPrincipal: number;
  nextEmiDate: string;
  startDate: string;
}

export interface InsurancePolicy {
  policyId: string;
  planId: string;
  provider: string;
  type: string;
  planName: string;
  coverAmount: number;
  monthlyPremium: number;
  nextDueDate: string;
  active: boolean;
}

interface FinancialStore {
  bills: UserBill[];
  holdings: Holding[];
  loans: UserLoan[];
  policies: InsurancePolicy[];
  loaded: boolean;
  load: () => Promise<void>;
  reset: () => void;
  payBill: (billId: string) => boolean;
  investStock: (symbol: string, amountInr: number) => boolean;
  investFd: (bank: string, amount: number, rate: number) => boolean;
  investMf: (fundId: string, name: string, amount: number) => boolean;
  takeLoan: (bank: string, loanType: string, principal: number, rate: number, tenureMonths: number) => boolean;
  buyPolicy: (planId: string) => boolean;
  holdingValue: (holding: Holding) => number;
  withdrawHolding: (holdingId: string) => boolean;
  withdrawAll: () => number;
  portfolioValue: () => number;
  totalLoanDue: () => number;
  pendingBillsTotal: () => number;
}

const MF_DEFAULT_RATE = 8;
const FD_DEFAULT_RATE = 7;

/** Years elapsed since an ISO date (fractional). */
function yearsSince(iso: string): number {
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / (365.25 * 86400000));
}

/**
 * Current value of a holding. Interest compounds annually on the invested
 * amount and is NOT credited to the wallet until the user withdraws.
 */
function computeHoldingValue(h: Holding): number {
  if (h.type === 'STOCK') {
    const stock = NSE_STOCKS.find((s) => s.symbol === h.symbol);
    if (!stock) return h.units * h.avgPrice;
    const { price } = liveStockPrice(stock);
    return h.units * price;
  }
  const years = yearsSince(h.investedAt);
  if (h.type === 'FD') {
    const rate = (h.annualRate ?? FD_DEFAULT_RATE) / 100;
    return h.avgPrice * Math.pow(1 + rate, years);
  }
  // MF: invested amount grows at its annual return, compounded annually.
  const rate = (h.annualRate ?? MF_DEFAULT_RATE) / 100;
  const invested = h.units; // MF holdings store the invested rupee amount in `units`
  return invested * Math.pow(1 + rate, years);
}

const STORAGE_KEY = 'onelink_financial';

function seedBillsForUser(userId: string): UserBill[] {
  const hash = userId.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const base = 800 + (hash % 500);
  const d = (days: number) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + days);
    return dt.toISOString().split('T')[0];
  };
  return [
    { billId: 'bill_elec', name: 'Electricity Bill', provider: 'UPPCL', amount: base + 450, dueDate: d(-3), category: 'UTILITY', isPaid: false, penaltyPerDay: 0.02 },
    { billId: 'bill_water', name: 'Water Bill', provider: 'Jal Nigam', amount: 380 + (hash % 100), dueDate: d(5), category: 'UTILITY', isPaid: false, penaltyPerDay: 0.015 },
    { billId: 'bill_gas', name: 'Gas Bill', provider: 'Indane', amount: 920, dueDate: d(12), category: 'UTILITY', isPaid: false, penaltyPerDay: 0.02 },
    { billId: 'bill_wifi', name: 'WiFi Bill', provider: 'JioFiber', amount: 999, dueDate: d(-1), category: 'TELECOM', isPaid: false, penaltyPerDay: 0.025 },
    { billId: 'bill_mobile', name: 'Mobile Postpaid', provider: 'Airtel', amount: 599, dueDate: d(8), category: 'TELECOM', isPaid: false, penaltyPerDay: 0.02 },
  ];
}

async function persist(state: Pick<FinancialStore, 'bills' | 'holdings' | 'loans' | 'policies'>) {
  const userId = useAuthStore.getState().user?.userId;
  await setUserStorageItem(STORAGE_KEY, userId, JSON.stringify(state));
}

export const useFinancialStore = create<FinancialStore>((set, get) => ({
  bills: [],
  holdings: [],
  loans: [],
  policies: [],
  loaded: false,

  reset: () => set({ bills: [], holdings: [], loans: [], policies: [], loaded: false }),

  load: async () => {
    const userId = useAuthStore.getState().user?.userId;
    if (!userId) {
      set({ bills: [], holdings: [], loans: [], policies: [], loaded: true });
      return;
    }
    const raw = await getUserStorageItem(STORAGE_KEY, userId);
    if (raw) {
      const parsed = JSON.parse(raw);
      set({
        bills: parsed.bills ?? [],
        holdings: parsed.holdings ?? [],
        loans: parsed.loans ?? [],
        policies: parsed.policies ?? [],
        loaded: true,
      });
      return;
    }
    const bills = seedBillsForUser(userId);
    const initial = { bills, holdings: [], loans: [], policies: [] };
    set({ ...initial, loaded: true });
    await persist(initial);
  },

  payBill: (billId) => {
    const bill = get().bills.find((b) => b.billId === billId);
    if (!bill || bill.isPaid) return false;
    const penalty = billPenalty(bill.amount, bill.dueDate, bill.penaltyPerDay);
    const total = bill.amount + penalty;
    const ok = useWalletStore.getState().debitWallet(total, 'BILL_PAY', `${bill.name} · ${bill.provider}${penalty ? ` (+₹${penalty} penalty)` : ''}`);
    if (!ok) return false;
    const bills = get().bills.map((b) =>
      b.billId === billId ? { ...b, isPaid: true, paidAt: new Date().toISOString() } : b
    );
    set({ bills });
    persist({ bills, holdings: get().holdings, loans: get().loans, policies: get().policies });
    useNotificationsStore.getState().add({
      title: 'Bill paid',
      body: `${bill.name} · ₹${total.toLocaleString()}`,
      type: 'WALLET',
      actionRoute: 'Account',
    });
    return true;
  },

  investStock: (symbol, amountInr) => {
    const stock = NSE_STOCKS.find((s) => s.symbol === symbol);
    if (!stock || amountInr < 100) return false;
    if (!useWalletStore.getState().debitWallet(amountInr, 'INVEST', `Bought ${symbol} on NSE`)) return false;
    const { price } = liveStockPrice(stock);
    const units = amountInr / price;
    const holding: Holding = {
      holdingId: `H_${Date.now()}`,
      type: 'STOCK',
      symbol,
      name: stock.name,
      units,
      avgPrice: price,
      investedAt: new Date().toISOString(),
    };
    const holdings = [holding, ...get().holdings];
    set({ holdings });
    persist({ bills: get().bills, holdings, loans: get().loans, policies: get().policies });
    return true;
  },

  investFd: (bank, amount, rate) => {
    if (amount < 1000) return false;
    if (!useWalletStore.getState().debitWallet(amount, 'INVEST', `FD @ ${bank} · ${rate}%`)) return false;
    const holding: Holding = {
      holdingId: `H_${Date.now()}`,
      type: 'FD',
      symbol: bank,
      name: `${bank} Fixed Deposit`,
      units: 1,
      avgPrice: amount,
      investedAt: new Date().toISOString(),
      annualRate: rate,
    };
    const holdings = [holding, ...get().holdings];
    set({ holdings });
    persist({ bills: get().bills, holdings, loans: get().loans, policies: get().policies });
    return true;
  },

  investMf: (fundId, name, amount) => {
    if (amount < 500) return false;
    if (!useWalletStore.getState().debitWallet(amount, 'INVEST', `SIP ${name}`)) return false;
    const fund = MUTUAL_FUNDS.find((m) => m.id === fundId);
    const holding: Holding = {
      holdingId: `H_${Date.now()}`,
      type: 'MF',
      symbol: fundId,
      name,
      units: amount,
      avgPrice: amount,
      investedAt: new Date().toISOString(),
      annualRate: fund?.oneYearReturn ?? MF_DEFAULT_RATE,
    };
    const holdings = [holding, ...get().holdings];
    set({ holdings });
    persist({ bills: get().bills, holdings, loans: get().loans, policies: get().policies });
    return true;
  },

  takeLoan: (bank, loanType, principal, rate, tenureMonths) => {
    const { emi } = calcEmi(principal, rate, tenureMonths);
    const nextEmi = new Date();
    nextEmi.setMonth(nextEmi.getMonth() + 1);
    const loan: UserLoan = {
      loanId: `LN_${Date.now()}`,
      bankName: bank,
      loanType,
      principal,
      rate,
      tenureMonths,
      emi,
      remainingPrincipal: principal,
      nextEmiDate: nextEmi.toISOString().split('T')[0],
      startDate: new Date().toISOString().split('T')[0],
    };
    const loans = [loan, ...get().loans];
    set({ loans });
    persist({ bills: get().bills, holdings: get().holdings, loans, policies: get().policies });
    // Disburse the loan into the wallet and persist it to the backend so the
    // balance is consistent across the webapp and the kiosk.
    useWalletStore.getState().creditWallet(principal, 'LOAN', `${loanType} from ${bank}`, 'Loan');
    return true;
  },

  buyPolicy: (planId) => {
    const plan = INSURANCE_PLANS.find((p) => p.id === planId);
    if (!plan) return false;
    if (!useWalletStore.getState().debitWallet(plan.monthlyPremium, 'INSURANCE', `${plan.planName} premium`)) return false;
    const nextDue = new Date();
    nextDue.setMonth(nextDue.getMonth() + 1);
    const policy: InsurancePolicy = {
      policyId: `POL_${Date.now()}`,
      planId,
      provider: plan.provider,
      type: plan.type,
      planName: plan.planName,
      coverAmount: plan.coverAmount,
      monthlyPremium: plan.monthlyPremium,
      nextDueDate: nextDue.toISOString().split('T')[0],
      active: true,
    };
    const policies = [policy, ...get().policies];
    set({ policies });
    persist({ bills: get().bills, holdings: get().holdings, loans: get().loans, policies });
    return true;
  },

  holdingValue: (holding) => computeHoldingValue(holding),

  withdrawHolding: (holdingId) => {
    const holding = get().holdings.find((h) => h.holdingId === holdingId);
    if (!holding) return false;
    const value = Math.round(computeHoldingValue(holding));
    if (value <= 0) return false;
    // Interest is only credited to the wallet on withdrawal.
    const ok = useWalletStore.getState().creditWallet(value, 'WITHDRAW', `Withdrawal · ${holding.name}`);
    if (!ok) return false;
    const holdings = get().holdings.filter((h) => h.holdingId !== holdingId);
    set({ holdings });
    persist({ bills: get().bills, holdings, loans: get().loans, policies: get().policies });
    useNotificationsStore.getState().add({
      title: 'Investment withdrawn',
      body: `${holding.name} · ₹${value.toLocaleString()} credited to wallet`,
      type: 'WALLET',
      actionRoute: 'Account',
    });
    return true;
  },

  withdrawAll: () => {
    const holdings = get().holdings;
    if (holdings.length === 0) return 0;
    const total = Math.round(holdings.reduce((sum, h) => sum + computeHoldingValue(h), 0));
    if (total <= 0) return 0;
    const ok = useWalletStore.getState().creditWallet(total, 'WITHDRAW', `Withdrawal · ${holdings.length} holdings`);
    if (!ok) return 0;
    set({ holdings: [] });
    persist({ bills: get().bills, holdings: [], loans: get().loans, policies: get().policies });
    useNotificationsStore.getState().add({
      title: 'Portfolio withdrawn',
      body: `₹${total.toLocaleString()} credited to wallet`,
      type: 'WALLET',
      actionRoute: 'Account',
    });
    return total;
  },

  portfolioValue: () => get().holdings.reduce((sum, h) => sum + computeHoldingValue(h), 0),

  totalLoanDue: () => get().loans.reduce((s, l) => s + l.remainingPrincipal, 0),

  pendingBillsTotal: () =>
    get().bills
      .filter((b) => !b.isPaid)
      .reduce((s, b) => s + b.amount + billPenalty(b.amount, b.dueDate, b.penaltyPerDay), 0),
}));
