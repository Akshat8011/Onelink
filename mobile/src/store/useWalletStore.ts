import { create } from 'zustand';
import api from '../services/api';
import { disableDemoMode, enableDemoMode, isDemoMode } from '../services/demoMode';
import { MOCK_WALLET } from '../data/mockData';
import { useNotificationsStore } from './useNotificationsStore';
import { useSettingsStore } from './useSettingsStore';
import { useRewardsStore } from './useRewardsStore';
import { useAuthStore } from './useAuthStore';

export interface Card {
  cardId: string;
  bankName: string;
  cardType: string;
  network: string;
  cardNumberLast4: string;
  expiryMonth: number;
  expiryYear: number;
  cvv: string;
  cardholderName: string;
  colorHex: string;
  isBlocked: boolean;
  internationalPayments: boolean;
  onlineTransactions: boolean;
  contactlessPayments: boolean;
  atmWithdrawals: boolean;
  posTransactions: boolean;
  tapToPay: boolean;
  smsAlerts: boolean;
  autoPayEnabled: boolean;
  rewardRedemption: boolean;
  dailyLimit: number;
}

export interface BankAccount {
  accountId: string;
  bankName: string;
  accountType: string;
  accountNumberLast4: string;
  balance: number;
}

export interface Transaction {
  transactionId: string;
  type: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  paymentMode?: string;
}

interface Analytics {
  _id: string;
  total: number;
}

interface WalletStore {
  balance: number;
  cards: Card[];
  banks: BankAccount[];
  transactions: Transaction[];
  analytics: Analytics[];
  isLoading: boolean;

  fetchDashboard: () => Promise<void>;
  reset: () => void;
  addFunds: (amount: number, accountId: string) => Promise<boolean>;
  debitWallet: (amount: number, category: string, description: string, paymentMode?: string, opts?: WalletOpOptions) => boolean;
  creditWallet: (amount: number, category: string, description: string, paymentMode?: string, opts?: WalletOpOptions) => boolean;
  toggleCardSetting: (cardId: string, setting: string, value: boolean | number) => Promise<void>;
  setDailyLimit: (cardId: string, limit: number) => void;
}

/**
 * Options for wallet debit/credit.
 * `skipRemote` is used by flows that already persist the balance change to the
 * backend through their own endpoint (retail checkout, transit ticket booking,
 * parking gate) so we don't debit the server twice.
 */
export interface WalletOpOptions {
  skipRemote?: boolean;
}

/**
 * Persist a wallet balance change to the backend so MongoDB stays the single
 * source of truth shared by the mobile webapp and the physical kiosk. Runs in
 * the background: the caller has already applied an optimistic local update, so
 * on success we trust the server's authoritative balance, and on failure we
 * re-sync from the server (which rolls back the optimistic change).
 */
async function persistWalletOp(
  set: (partial: Partial<WalletStore>) => void,
  resync: () => Promise<void>,
  op: 'debit' | 'credit',
  amount: number,
  category: string,
  description: string,
) {
  if (isDemoMode()) return;
  try {
    const { data } = await api.post(`/v1/wallet/${op}`, { amount, category, description });
    if (data && data.success && typeof data.newBalance === 'number') {
      set({ balance: data.newBalance });
    } else {
      // Server rejected (e.g. insufficient balance) — reconcile with the truth.
      await resync();
    }
  } catch {
    // Network error: keep the optimistic value for now and reconcile from the
    // server on the next dashboard refresh so nothing is silently lost.
    await resync();
  }
}

function applyMockDashboard() {
  return {
    balance: MOCK_WALLET.balance,
    cards: JSON.parse(JSON.stringify(MOCK_WALLET.cards)),
    banks: JSON.parse(JSON.stringify(MOCK_WALLET.banks)),
    transactions: JSON.parse(JSON.stringify(MOCK_WALLET.transactions)),
    analytics: JSON.parse(JSON.stringify(MOCK_WALLET.analytics)),
  };
}

export const useWalletStore = create<WalletStore>((set, get) => ({
  balance: 0,
  cards: [],
  banks: [],
  transactions: [],
  analytics: [],
  isLoading: false,

  reset: () => {
    set({
      balance: 0,
      cards: [],
      banks: [],
      transactions: [],
      analytics: [],
      isLoading: false,
    });
  },

  fetchDashboard: async () => {
    set({ isLoading: true });
    const authUser = useAuthStore.getState().user;
    try {
      const { data } = await api.get('/v1/wallet/dashboard');
      if (data.success && data.data?.wallet) {
        disableDemoMode();
        set({
          balance: data.data.wallet.balance,
          cards: data.data.cards || [],
          banks: data.data.banks || [],
          transactions: data.data.transactions || [],
          analytics: data.data.analytics || [],
          isLoading: false,
        });
        if (data.data.wallet.loyaltyPoints != null) {
          useRewardsStore.setState({
            loyaltyPoints: data.data.wallet.loyaltyPoints,
            memberTier: data.data.wallet.memberTier || 'BRONZE',
          });
        }
        return;
      }
    } catch {
      // fall through to profile-based fallback
    }

    if (authUser) {
      disableDemoMode();
      const banks = (authUser.linkedBanks || []).map((b, i) => ({
        accountId: `ACC_${authUser.userId}_${i}`,
        bankName: b.bankName,
        accountType: 'SAVINGS',
        accountNumberLast4: b.accountNumber?.slice(-4) || '0000',
        balance: b.balance,
      }));
      set({
        balance: authUser.wallet?.balance ?? 0,
        cards: [],
        banks,
        transactions: [],
        analytics: [],
        isLoading: false,
      });
      return;
    }

    enableDemoMode();
    set({ ...applyMockDashboard(), isLoading: false });
  },

  debitWallet: (amount, category, description, paymentMode = 'OneLink Wallet', opts = {}) => {
    const { balance } = get();
    if (balance < amount) return false;
    const txn: Transaction = {
      transactionId: `TXN_${Date.now()}`,
      type: 'DEBIT',
      amount,
      category,
      description,
      date: new Date().toISOString(),
      paymentMode,
    };
    set({
      balance: balance - amount,
      transactions: [txn, ...get().transactions],
    });

    useRewardsStore.getState().earnFromSpend(amount);

    // Durably persist the debit to the backend so the balance is reduced for
    // real everywhere (mobile webapp AND the physical kiosk read the same
    // MongoDB document). Flows that already debit the server through their own
    // endpoint pass { skipRemote: true } to avoid a double charge.
    if (!opts.skipRemote) {
      persistWalletOp(set, get().fetchDashboard, 'debit', amount, category, description);
    }

    const settings = useSettingsStore.getState();
    if (settings.autoTopUp && get().balance < settings.autoTopUpThreshold) {
      const bank = get().banks[0];
      if (bank && bank.balance >= 500) {
        get().addFunds(500, bank.accountId);
        useNotificationsStore.getState().add({
          title: 'Auto top-up',
          body: '₹500 added to wallet (balance was low)',
          type: 'WALLET',
          actionRoute: 'Wallet',
        });
      }
    }

    return true;
  },

  creditWallet: (amount, category, description, paymentMode = 'OneLink Wallet', opts = {}) => {
    if (!Number.isFinite(amount) || amount <= 0) return false;
    const txn: Transaction = {
      transactionId: `TXN_${Date.now()}`,
      type: 'CREDIT',
      amount,
      category,
      description,
      date: new Date().toISOString(),
      paymentMode,
    };
    set({
      balance: get().balance + amount,
      transactions: [txn, ...get().transactions],
    });

    if (!opts.skipRemote) {
      persistWalletOp(set, get().fetchDashboard, 'credit', amount, category, description);
    }

    return true;
  },

  addFunds: async (amount: number, accountId: string) => {
    set({ isLoading: true });
    const bank = get().banks.find((b) => b.accountId === accountId);
    if (!bank) {
      set({ isLoading: false });
      return false;
    }
    if (bank.balance < amount) {
      set({ isLoading: false });
      return false;
    }

    const txn: Transaction = {
      transactionId: `TXN_${Date.now()}`,
      type: 'CREDIT',
      amount,
      category: 'TOP_UP',
      description: `Top-up from ${bank.bankName} ••${bank.accountNumberLast4}`,
      date: new Date().toISOString(),
      paymentMode: bank.bankName,
    };

    set({
      balance: get().balance + amount,
      banks: get().banks.map((b) =>
        b.accountId === accountId ? { ...b, balance: b.balance - amount } : b
      ),
      transactions: [txn, ...get().transactions],
      isLoading: false,
    });

    useNotificationsStore.getState().add({
      title: 'Wallet topped up',
      body: `₹${amount.toLocaleString()} from ${bank.bankName} · Balance: ₹${(get().balance).toLocaleString()}`,
      type: 'WALLET',
      actionRoute: 'Wallet',
    });

    if (!isDemoMode()) {
      try {
        // Persist the top-up to the backend wallet so the balance reflects
        // everywhere the account is used (mobile app AND the physical kiosk).
        // Send accountId so the backend debits the exact bank the user picked.
        const { data } = await api.post('/v1/wallet/topup', {
          amount,
          accountId,
          source: bank.bankName,
        });
        if (data && typeof data.newBalance === 'number') {
          // Trust the server's authoritative balances over the optimistic ones.
          set({
            balance: data.newBalance,
            banks: get().banks.map((b) =>
              b.accountId === accountId && typeof data.bankBalance === 'number'
                ? { ...b, balance: data.bankBalance }
                : b
            ),
          });
        }
        // Refresh dashboard so transactions/analytics stay in sync with server.
        get().fetchDashboard();
      } catch {
        enableDemoMode();
      }
    }
    return true;
  },

  toggleCardSetting: async (cardId: string, setting: string, value: boolean | number) => {
    set((state) => ({
      cards: state.cards.map((c) =>
        c.cardId === cardId ? { ...c, [setting]: value } : c
      ),
    }));

    if (isDemoMode()) return;

    try {
      const { data } = await api.post(`/v1/wallet/cards/${cardId}/toggle`, { setting, value });
      if (!data.success) throw new Error('toggle failed');
    } catch {
      set((state) => ({
        cards: state.cards.map((c) =>
          c.cardId === cardId
            ? { ...c, [setting]: typeof value === 'boolean' ? !value : c.dailyLimit }
            : c
        ),
      }));
    }
  },

  setDailyLimit: (cardId, limit) => {
    get().toggleCardSetting(cardId, 'dailyLimit', limit);
  },
}));
