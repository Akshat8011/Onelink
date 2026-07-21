import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { socketService } from '../services/socket';
import { disableDemoMode } from '../services/demoMode';
import type { User, AuthState } from '../types';
import { resetAllUserStores } from '../utils/resetUserStores';
import { useNotificationsStore } from './useNotificationsStore';
import { useWalletStore } from './useWalletStore';
import { useTicketsStore } from './useTicketsStore';
import { useTransitStore } from './useTransitStore';
import { useMobilityStore } from './useMobilityStore';
import { useOrdersStore } from './useOrdersStore';
import { useCanteenStore } from './useCanteenStore';

const TOKEN_KEY = 'onelink_token';
const REMEMBER_KEY = 'onelink_remember_me';
const CREDENTIALS_KEY = 'onelink_saved_credentials';

let realtimeBound = false;

interface AuthStore extends AuthState {
  loginWithUsername: (username: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  register: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  loadToken: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  tryAutoLogin: () => Promise<boolean>;
  updateNfcCard: (settings: { isBlocked?: boolean; domesticUsage?: boolean; internationalUsage?: boolean }) => Promise<boolean>;
  revealPairingToken: (password: string) => Promise<{ success: boolean; pairingToken?: string; error?: string }>;
  regeneratePairingToken: (password: string) => Promise<{ success: boolean; pairingToken?: string; error?: string }>;
  delinkCard: () => Promise<{ success: boolean; pairingToken?: string; error?: string }>;
  setupRealtimeListeners: () => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  loginWithUsername: async (username: string, password: string, rememberMe = true) => {
    try {
      const { data } = await api.post('/v1/auth/login', { username, password, rememberMe });
      await AsyncStorage.setItem(TOKEN_KEY, data.token);
      await AsyncStorage.setItem(REMEMBER_KEY, rememberMe ? '1' : '0');
      if (rememberMe) {
        await AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify({ username, password }));
      } else {
        await AsyncStorage.removeItem(CREDENTIALS_KEY);
      }
      disableDemoMode();
      set({ user: data.user, token: data.token, isAuthenticated: true, isLoading: false });
      socketService.connect(data.user.userId);
      get().setupRealtimeListeners();
      useTransitStore.getState().setupRealtimeUpdates();
      useMobilityStore.getState().setupRealtimeUpdates();
      return true;
    } catch (err: any) {
      console.error('[OneLink Auth] login failed:', err?.response?.data || err?.message);
      set({ isLoading: false });
      // No HTTP response = server unreachable (e.g. Render cold start / offline).
      // Re-throw so the UI shows a "connection error" instead of the misleading
      // "invalid credentials". A real credential failure has err.response (401).
      if (!err?.response) throw err;
      return false;
    }
  },

  register: async (username: string, password: string) => {
    try {
      const { data } = await api.post('/v1/auth/register', { username, password });
      await AsyncStorage.setItem(TOKEN_KEY, data.token);
      await AsyncStorage.setItem(REMEMBER_KEY, '1');
      await AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify({ username, password }));
      disableDemoMode();
      set({ user: data.user, token: data.token, isAuthenticated: true, isLoading: false });
      socketService.connect(data.user.userId);
      get().setupRealtimeListeners();
      useTransitStore.getState().setupRealtimeUpdates();
      useMobilityStore.getState().setupRealtimeUpdates();
      return { success: true };
    } catch (err: any) {
      const error = err?.response?.data?.error || err?.message || 'Registration failed';
      console.error('[OneLink Auth] register failed:', err?.response?.data || err?.message);
      return { success: false, error };
    }
  },

  logout: async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    const remember = await AsyncStorage.getItem(REMEMBER_KEY);
    if (remember !== '1') {
      await AsyncStorage.removeItem(CREDENTIALS_KEY);
    }
    socketService.disconnect();
    realtimeBound = false;
    resetAllUserStores();
    set({ user: null, token: null, isAuthenticated: false, isLoading: false });
  },

  tryAutoLogin: async () => {
    const remember = await AsyncStorage.getItem(REMEMBER_KEY);
    if (remember !== '1') return false;
    const raw = await AsyncStorage.getItem(CREDENTIALS_KEY);
    if (!raw) return false;
    try {
      const { username, password } = JSON.parse(raw);
      return get().loginWithUsername(username, password, true);
    } catch {
      return false;
    }
  },

  loadToken: async () => {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (token) {
      set({ token, isLoading: true });
      try {
        await get().fetchProfile();
        return;
      } catch {
        // token invalid — try saved credentials
      }
    }
    const autoLoggedIn = await get().tryAutoLogin();
    if (!autoLoggedIn) {
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },

  fetchProfile: async () => {
    try {
      const { data } = await api.get('/v1/auth/profile');
      disableDemoMode();
      set({ user: data, isAuthenticated: true, isLoading: false });
      socketService.connect(data.userId);
      get().setupRealtimeListeners();
      useTransitStore.getState().setupRealtimeUpdates();
      useMobilityStore.getState().setupRealtimeUpdates();
    } catch {
      await AsyncStorage.removeItem(TOKEN_KEY);
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },

  updateNfcCard: async (settings) => {
    try {
      const { data } = await api.patch('/v1/auth/nfc-card', settings);
      if (!data.success) return false;
      const current = get().user;
      if (!current) return false;
      set({
        user: {
          ...current,
          card: {
            ...current.card,
            isBlocked: data.card.isBlocked,
            domesticUsage: data.card.domesticUsage,
            internationalUsage: data.card.internationalUsage,
          },
        },
      });
      useWalletStore.getState().fetchDashboard();
      return true;
    } catch {
      return false;
    }
  },

  regeneratePairingToken: async (password: string) => {
    try {
      const { data } = await api.post('/v1/auth/regenerate-pairing-token', { password });
      if (!data.success) {
        return { success: false, error: data.error || 'Failed to regenerate code' };
      }
      set({ user: data.user });
      return { success: true, pairingToken: data.pairingToken };
    } catch (err: any) {
      const error = err?.response?.data?.error || err?.message || 'Failed to regenerate code';
      return { success: false, error };
    }
  },

  revealPairingToken: async (password: string) => {
    try {
      const { data } = await api.post('/v1/auth/reveal-pairing-token', { password });
      if (!data.success) {
        return { success: false, error: data.error || 'Failed to reveal code' };
      }
      return { success: true, pairingToken: data.pairingToken };
    } catch (err: any) {
      const error = err?.response?.data?.error || err?.message || 'Incorrect password';
      return { success: false, error };
    }
  },

  delinkCard: async () => {
    try {
      const { data } = await api.post('/v1/auth/delink-card');
      if (!data.success) {
        return { success: false, error: data.error || 'Failed to unlink card' };
      }
      // Optimistically reflect the unlinked state right away so the Profile UI
      // updates instantly, even if the follow-up profile refetch is slow.
      const current = get().user;
      if (current) {
        set({
          user: {
            ...current,
            cardUid: '',
            isCardPaired: false,
            hasPairingCode: true,
            card: current.card ? { ...current.card, isBlocked: false } : current.card,
          } as User,
        });
      }
      // Refresh from the server, but never let a transient profile error log the
      // user out mid-unlink — swallow failures and keep the optimistic state.
      try {
        await get().fetchProfile();
      } catch {
        /* keep optimistic state */
      }
      return { success: true, pairingToken: data.pairingToken };
    } catch (err: any) {
      const error = err?.response?.data?.error || err?.message || 'Failed to unlink card';
      return { success: false, error };
    }
  },

  setupRealtimeListeners: () => {
    if (realtimeBound) return;
    realtimeBound = true;

    const refreshAll = async () => {
      await useWalletStore.getState().fetchDashboard();
      useTransitStore.getState().fetchActiveJourney();
      useMobilityStore.getState().fetchMobilityData();
      useMobilityStore.getState().fetchParkingReceipts();
      useOrdersStore.getState().load();
      useTicketsStore.getState().load();
    };

    socketService.on('card:paired', async (data: { cardUid: string; message?: string }) => {
      await get().fetchProfile();
      await refreshAll();
      useNotificationsStore.getState().add({
        title: 'Card linked',
        body: data.message || `RFID card ${data.cardUid} is now linked to your account`,
        type: 'WALLET',
        actionRoute: 'Wallet',
      });
    });

    socketService.on('card:delinked', async (data: { message?: string }) => {
      await get().fetchProfile();
      useNotificationsStore.getState().add({
        title: 'Card unlinked',
        body: data.message || 'Your RFID card has been unlinked from your account',
        type: 'WALLET',
        actionRoute: 'Wallet',
      });
    });

    socketService.on('transit:entry', refreshAll);
    socketService.on('transit:exit', refreshAll);
    socketService.on('transit:ticket-booked', refreshAll);
    socketService.on('parking:entry', refreshAll);
    socketService.on('parking:exit', refreshAll);
    socketService.on('parking:update', () => useMobilityStore.getState().fetchMobilityData());
    socketService.on('parking:receipt', refreshAll);
    socketService.on('payment:receipt', refreshAll);
    socketService.on('shop:cart-pushed', async (data: { cartId: string; total: number }) => {
      await refreshAll();
      useNotificationsStore.getState().add({
        title: 'Cart sent to kiosk',
        body: `Tap your card at the Pi to pay ₹${data.total}`,
        type: 'ORDER',
        actionRoute: 'Shop',
      });
    });
    socketService.on('shop:order-paid', async (data: {
      orderId: string;
      amount: number;
      items?: Array<{ productId?: string; name: string; brand?: string; quantity: number; unit?: string; price: number }>;
      receiptAt?: string;
    }) => {
      useOrdersStore.getState().upsertKioskOrder(data);
      await refreshAll();
    });

    socketService.on('canteen:cart-pushed', async (data: { cartId: string; total: number }) => {
      await refreshAll();
      useNotificationsStore.getState().add({
        title: 'Cart sent to canteen',
        body: `Tap your card at the canteen kiosk to pay ₹${data.total}`,
        type: 'ORDER',
        actionRoute: 'Canteen',
      });
    });

    socketService.on('canteen:order-paid', async (data: {
      orderId: string;
      orderNumber: number;
      amount?: number;
      total?: number;
      items?: Array<{ productId: string; name: string; quantity: number; price: number; imageUrl?: string; category?: string }>;
      receiptId: string;
      paidAt?: string;
      readyAt?: string;
      nowServing?: number;
      etaMinutes?: number;
      status?: 'PREPARING' | 'READY' | 'COLLECTED';
      transactionId?: string;
    }) => {
      useCanteenStore.getState().upsertOrder({
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        items: data.items || [],
        total: data.total ?? data.amount ?? 0,
        status: data.status || 'PREPARING',
        paidAt: data.paidAt || new Date().toISOString(),
        readyAt: data.readyAt || new Date().toISOString(),
        receiptId: data.receiptId,
        transactionId: data.transactionId,
        nowServing: data.nowServing,
        etaMinutes: data.etaMinutes,
      });
      if (data.nowServing != null) useCanteenStore.getState().setNowServing(data.nowServing);
      useNotificationsStore.getState().add({
        title: `Canteen order #${data.orderNumber}`,
        body: `Paid ₹${data.total ?? data.amount ?? 0}. Wait for your number to be served.`,
        type: 'ORDER',
        actionRoute: 'Canteen',
        actionParams: { orderId: data.orderId },
      });
      await refreshAll();
    });

    socketService.on('canteen:order-ready', (data: {
      orderId: string;
      orderNumber: number;
      receiptId?: string;
      total?: number;
      items?: CanteenOrderItems;
      nowServing?: number;
      status?: 'READY';
    }) => {
      if (data.nowServing != null) useCanteenStore.getState().setNowServing(data.nowServing);
      useCanteenStore.getState().markOrderReady(data);
    });

    socketService.on('canteen:order-collected', (data: {
      orderId: string;
      orderNumber: number;
      collectedAt?: string;
      receiptId?: string;
    }) => {
      useCanteenStore.getState().markOrderCollected(data);
      useNotificationsStore.getState().add({
        title: `Order #${data.orderNumber} collected`,
        body: 'Your canteen receipt is saved in the Canteen tab',
        type: 'ORDER',
        actionRoute: 'Canteen',
        actionParams: { orderId: data.orderId },
      });
    });

    socketService.on('canteen:queue-updated', (data: { nowServing?: number }) => {
      if (data.nowServing != null) useCanteenStore.getState().setNowServing(data.nowServing);
    });
  },
}));

type CanteenOrderItems = Array<{
  productId: string;
  name: string;
  quantity: number;
  price: number;
  imageUrl?: string;
  category?: string;
}>;
