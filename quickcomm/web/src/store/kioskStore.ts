import { create } from 'zustand';
import type { CheckCardResult, KioskService } from '../lib/kioskApi';

export type KioskStep =
  | 'idle'
  | 'checking'
  | 'pairing'
  | 'home'
  | 'confirm'
  | 'processing'
  | 'result';

type KioskState = {
  step: KioskStep;
  cardUid: string | null;
  terminalId: string;
  userName: string | null;
  balance: number;
  currency: string;
  services: KioskService[];
  selectedService: KioskService | null;
  pairingDigits: string;
  error: string | null;
  resultMessage: string | null;
  wsConnected: boolean;
  setWsConnected: (connected: boolean) => void;
  handleCardTap: (cardUid: string, terminalId?: string) => void;
  setCheckResult: (result: CheckCardResult) => void;
  setChecking: () => void;
  appendPairingDigit: (digit: string) => void;
  backspacePairingDigit: () => void;
  clearPairingDigits: () => void;
  selectService: (service: KioskService) => void;
  setProcessing: () => void;
  syncBalance: (balance: number, services?: KioskService[]) => void;
  setPaymentResult: (success: boolean, message: string, balance?: number) => void;
  setPairingError: (message: string) => void;
  setPairingSuccess: (name: string, balance: number) => void;
  reset: () => void;
};

const initialState = {
  step: 'idle' as KioskStep,
  cardUid: null,
  terminalId: 'main_kiosk',
  userName: null,
  balance: 0,
  currency: 'INR',
  services: [] as KioskService[],
  selectedService: null,
  pairingDigits: '',
  error: null,
  resultMessage: null,
  wsConnected: false,
};

export const useKioskStore = create<KioskState>((set, get) => ({
  ...initialState,

  setWsConnected: (connected) => set({ wsConnected: connected }),

  handleCardTap: (cardUid, terminalId = 'main_kiosk') =>
    set({
      cardUid: cardUid.toUpperCase(),
      terminalId,
      error: null,
      resultMessage: null,
      pairingDigits: '',
      selectedService: null,
    }),

  setChecking: () => set({ step: 'checking', error: null }),

  setCheckResult: (result) => {
    if (result.blocked) {
      set({
        step: 'result',
        error: result.error || 'Card is blocked',
        resultMessage: 'Access denied',
      });
      return;
    }

    if (!result.registered || result.pairingRequired) {
      set({ step: 'pairing', error: null });
      return;
    }

    set({
      step: 'home',
      userName: result.name || 'User',
      balance: result.balance ?? 0,
      currency: result.currency || 'INR',
      services: result.services || [],
      error: null,
    });
  },

  appendPairingDigit: (digit) => {
    const current = get().pairingDigits;
    if (current.length >= 10) return;
    set({ pairingDigits: current + digit, error: null });
  },

  backspacePairingDigit: () => {
    const current = get().pairingDigits;
    set({ pairingDigits: current.slice(0, -1), error: null });
  },

  clearPairingDigits: () => set({ pairingDigits: '', error: null }),

  selectService: (service) => set({ selectedService: service, step: 'confirm', error: null }),

  setProcessing: () => set({ step: 'processing', error: null }),

  // Keep the on-screen balance in step with the shared wallet (MongoDB) while a
  // card is active, so spends/top-ups made in the mobile webapp show up here
  // without needing a re-tap. Only updates the idle "home" screen so we never
  // disturb an in-progress payment/confirm/pairing flow.
  syncBalance: (balance, services) =>
    set((state) =>
      state.step === 'home'
        ? { balance, services: services ?? state.services }
        : {},
    ),

  setPaymentResult: (success, message, balance) =>
    set({
      step: 'result',
      resultMessage: message,
      error: success ? null : message,
      balance: balance ?? get().balance,
    }),

  setPairingError: (message) => set({ error: message }),

  setPairingSuccess: (name, balance) =>
    set({
      step: 'home',
      userName: name,
      balance,
      pairingDigits: '',
      error: null,
      services: [
        { id: 'metro_entry', label: 'Metro', amount: 20, category: 'METRO' },
        { id: 'main_kiosk', label: 'Shopping', amount: 50, category: 'SHOPPING' },
      ],
    }),

  reset: () => set({ ...initialState, wsConnected: get().wsConnected }),
}));
