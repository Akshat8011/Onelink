import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { isDemoMode } from '../services/demoMode';
import { getUserStorageItem, setUserStorageItem } from '../utils/userStorage';
import { useAuthStore } from './useAuthStore';
import { useWalletStore } from './useWalletStore';
import { useNotificationsStore } from './useNotificationsStore';

export interface RedemptionRecord {
  id: string;
  points: number;
  creditAmount: number;
  date: string;
  description: string;
}

interface RewardsStore {
  loyaltyPoints: number;
  memberTier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  redemptionHistory: RedemptionRecord[];
  loaded: boolean;
  load: () => Promise<void>;
  reset: () => void;
  redeemPoints: (points: number) => Promise<{ success: boolean; message: string }>;
  earnFromSpend: (amountInr: number) => Promise<void>;
  getTierBenefits: () => { label: string; value: string }[];
}

const STORAGE_KEY = 'onelink_rewards';
const POINTS_PER_10_INR = 1;
const REDEEM_RATE = 10; // 10 points = ₹1

function tierFromPoints(points: number): RewardsStore['memberTier'] {
  if (points >= 5000) return 'PLATINUM';
  if (points >= 2500) return 'GOLD';
  if (points >= 1000) return 'SILVER';
  return 'BRONZE';
}

export const useRewardsStore = create<RewardsStore>((set, get) => ({
  loyaltyPoints: 0,
  memberTier: 'BRONZE' as const,
  redemptionHistory: [],
  loaded: false,

  reset: () => {
    set({
      loyaltyPoints: 0,
      memberTier: 'BRONZE',
      redemptionHistory: [],
      loaded: false,
    });
  },

  load: async () => {
    const user = useAuthStore.getState().user;
    if (user?.loyaltyPoints != null) {
      set({
        loyaltyPoints: user.loyaltyPoints,
        memberTier: (user.memberTier as RewardsStore['memberTier']) || 'BRONZE',
        loaded: true,
      });
    }
    const userId = user?.userId;
    const raw = await getUserStorageItem(STORAGE_KEY, userId);
    if (raw) {
      const parsed = JSON.parse(raw);
      set({
        loyaltyPoints: parsed.loyaltyPoints ?? user?.loyaltyPoints ?? 0,
        memberTier: parsed.memberTier ?? user?.memberTier ?? 'BRONZE',
        redemptionHistory: parsed.redemptionHistory ?? [],
        loaded: true,
      });
    } else {
      set({
        loyaltyPoints: user?.loyaltyPoints ?? 0,
        memberTier: (user?.memberTier as RewardsStore['memberTier']) ?? 'BRONZE',
        redemptionHistory: [],
        loaded: true,
      });
    }
  },

  redeemPoints: async (points) => {
    const { loyaltyPoints } = get();
    if (points < 100) return { success: false, message: 'Minimum 100 points required' };
    if (points > loyaltyPoints) return { success: false, message: 'Not enough points' };

    const creditAmount = Math.floor(points / REDEEM_RATE);
    if (creditAmount < 1) return { success: false, message: 'Redeem at least 100 points' };

    if (!isDemoMode()) {
      try {
        const { data } = await api.post('/v1/wallet/redeem', { points });
        if (!data?.success && data?.error) {
          return { success: false, message: data.error };
        }
      } catch {
        // fall through to local redeem in demo/offline
      }
    }

    const record: RedemptionRecord = {
      id: `RDM_${Date.now()}`,
      points,
      creditAmount,
      date: new Date().toISOString(),
      description: `Redeemed ${points} pts → ₹${creditAmount} wallet credit`,
    };

    const nextPoints = loyaltyPoints - points;
    const nextTier = tierFromPoints(nextPoints);
    const history = [record, ...get().redemptionHistory];

    set({ loyaltyPoints: nextPoints, memberTier: nextTier, redemptionHistory: history });
    const userId = useAuthStore.getState().user?.userId;
    await setUserStorageItem(
      STORAGE_KEY,
      userId,
      JSON.stringify({
        loyaltyPoints: nextPoints,
        memberTier: nextTier,
        redemptionHistory: history,
      }),
    );

    const wallet = useWalletStore.getState();
    useWalletStore.setState((s) => ({
      balance: s.balance + creditAmount,
      transactions: [
        {
          transactionId: `TXN_${Date.now()}`,
          type: 'CREDIT',
          amount: creditAmount,
          category: 'REWARDS',
          description: `Rewards redemption · ${points} pts`,
          date: new Date().toISOString(),
          paymentMode: 'Loyalty',
        },
        ...s.transactions,
      ],
    }));

    useNotificationsStore.getState().add({
      title: 'Points redeemed',
      body: `${points} points converted to ₹${creditAmount} wallet credit`,
      type: 'WALLET',
      actionRoute: 'Rewards',
    });

    return { success: true, message: `₹${creditAmount} added to your wallet` };
  },

  earnFromSpend: async (amountInr) => {
    const earned = Math.floor(amountInr / 10) * POINTS_PER_10_INR;
    if (earned <= 0) return;

    const nextPoints = get().loyaltyPoints + earned;
    const nextTier = tierFromPoints(nextPoints);
    const history = get().redemptionHistory;

    set({ loyaltyPoints: nextPoints, memberTier: nextTier });
    const userId = useAuthStore.getState().user?.userId;
    await setUserStorageItem(
      STORAGE_KEY,
      userId,
      JSON.stringify({ loyaltyPoints: nextPoints, memberTier: nextTier, redemptionHistory: history }),
    );

    useNotificationsStore.getState().add({
      title: 'Points earned',
      body: `+${earned} loyalty points from your purchase`,
      type: 'WALLET',
      actionRoute: 'Rewards',
    });
  },

  getTierBenefits: () => {
    const tier = get().memberTier;
    const map: Record<string, { label: string; value: string }[]> = {
      BRONZE: [
        { label: 'Earn rate', value: '1 pt per ₹10 spent' },
        { label: 'Redeem rate', value: '10 pts = ₹1' },
        { label: 'Partner offers', value: 'Basic deals' },
      ],
      SILVER: [
        { label: 'Earn rate', value: '1 pt per ₹10 spent' },
        { label: 'Redeem rate', value: '10 pts = ₹1' },
        { label: 'Partner offers', value: '5% extra on events' },
      ],
      GOLD: [
        { label: 'Earn rate', value: '1 pt per ₹10 spent' },
        { label: 'Redeem rate', value: '10 pts = ₹1' },
        { label: 'Partner offers', value: '10% off parking (weekdays)' },
      ],
      PLATINUM: [
        { label: 'Earn rate', value: '1.5 pts per ₹10 spent' },
        { label: 'Redeem rate', value: '10 pts = ₹1' },
        { label: 'Partner offers', value: 'Priority support + exclusive events' },
      ],
    };
    return map[tier] ?? map.BRONZE;
  },
}));
