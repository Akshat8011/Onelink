import { create } from 'zustand';
import api from '../services/api';
import { enableDemoMode, isDemoMode } from '../services/demoMode';
import { MOCK_PARKING_SPOTS } from '../data/mockData';
import { LUCKNOW_EV_STATIONS } from '../data/evStationsLucknow';
import { useWalletStore } from './useWalletStore';
import { useAuthStore } from './useAuthStore';
import { socketService } from '../services/socket';

import type { ParkingSpot } from '../types';

let mobilityRealtimeBound = false;

export interface EVStation {
  stationId: string;
  operator?: string;
  type: string;
  location: { address: string };
  connectors: Array<{ connectorId: string; type: string; powerKw: number; status: string }>;
  parkingStatus: string;
  ratePerMinute: number;
  hours?: string;
}

export interface ParkingReceipt {
  receiptId: string;
  spotId: string;
  zone: string;
  entryTime: string;
  exitTime: string;
  durationMinutes: number;
  ratePerMinute?: number;
  amount: number;
  totalCharge?: number;
  createdAt?: string;
}

interface MobilityStore {
  spots: ParkingSpot[];
  evStations: EVStation[];
  userSpot: string | null;
  parkingReceipts: ParkingReceipt[];
  isLoading: boolean;
  fetchMobilityData: () => Promise<void>;
  fetchParkingReceipts: () => Promise<void>;
  reserveSpot: (spotId: string) => Promise<boolean>;
  releaseReservation: (spotId: string) => Promise<boolean>;
  rechargeFastag: (amount: number, vehicleNumber: string) => Promise<boolean>;
  setupRealtimeUpdates: () => void;
}

function cloneSpots() {
  return JSON.parse(JSON.stringify(MOCK_PARKING_SPOTS)) as ParkingSpot[];
}

function normalizeSpot(raw: any): ParkingSpot {
  const status = raw.status ?? 'FREE';
  return {
    spotId: raw.spotId,
    zone: raw.zone,
    spotNumber: raw.spotNumber ?? (parseInt(String(raw.spotId).replace(/\D/g, ''), 10) || 1),
    status,
    occupiedBy: raw.occupiedBy ?? null,
    occupantName: raw.occupantName ?? null,
    entryTime: raw.entryTime ? String(raw.entryTime) : null,
    reservedUntil: raw.reservedUntil ? String(raw.reservedUntil) : null,
    ratePerMinute: raw.ratePerMinute ?? 5,
    ledColor: raw.ledColor ?? (status === 'FREE' ? 'GREEN' : status === 'RESERVED' ? 'YELLOW' : 'RED'),
  };
}

function syncUserSpot(spots: ParkingSpot[]): string | null {
  const userId = useAuthStore.getState().user?.userId;
  const active = useAuthStore.getState().user?.activeParkingSpot;
  if (active && spots.some((s) => s.spotId === active)) return active;
  if (!userId) return null;
  const mine = spots.find(
    (s) => s.occupiedBy === userId && (s.status === 'OCCUPIED' || s.status === 'RESERVED'),
  );
  return mine?.spotId ?? null;
}

export const useMobilityStore = create<MobilityStore>((set, get) => ({
  spots: [],
  evStations: [],
  userSpot: null,
  parkingReceipts: [],
  isLoading: false,

  fetchMobilityData: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/v1/kiosk/parking/spots');
      if (data.success && Array.isArray(data.spots) && data.spots.length > 0) {
        const spots = data.spots.map(normalizeSpot);
        set({ spots, userSpot: syncUserSpot(spots), isLoading: false });
        return;
      }
    } catch {
      /* try legacy mobility endpoint */
    }
    try {
      const { data } = await api.get('/v1/mobility/status');
      if (data.success && data.data?.parkingSpots?.length) {
        const spots = data.data.parkingSpots.map(normalizeSpot);
        set({
          spots,
          userSpot: syncUserSpot(spots),
          evStations: data.data.evStations ?? [],
          isLoading: false,
        });
        return;
      }
    } catch {
      // demo
    }
    enableDemoMode();
    const spots = cloneSpots();
    set({
      spots,
      userSpot: syncUserSpot(spots),
      evStations: JSON.parse(JSON.stringify(LUCKNOW_EV_STATIONS)),
      isLoading: false,
    });
  },

  fetchParkingReceipts: async () => {
    if (isDemoMode()) return;
    try {
      const { data } = await api.get('/v1/kiosk/parking/receipts');
      if (data.success && Array.isArray(data.receipts)) {
        set({
          parkingReceipts: data.receipts.map((r: any) => ({
            receiptId: r.receiptId,
            spotId: r.spotId,
            zone: r.zone,
            entryTime: r.entryTime,
            exitTime: r.exitTime,
            durationMinutes: r.durationMinutes,
            ratePerMinute: r.ratePerMinute,
            amount: r.amount ?? r.totalCharge ?? 0,
            totalCharge: r.totalCharge ?? r.amount,
            createdAt: r.createdAt,
          })),
        });
      }
    } catch {
      /* ignore */
    }
  },

  reserveSpot: async (spotId: string) => {
    if (get().userSpot) return false;

    const spot = get().spots.find((s) => s.spotId === spotId);
    if (!spot || spot.status !== 'FREE') return false;

    const userName = useAuthStore.getState().user?.name ?? 'You';
    const userId = useAuthStore.getState().user?.userId ?? 'local';

    if (!isDemoMode()) {
      try {
        const { data } = await api.post('/v1/mobility/reserve', { spotId });
        if (!data.success) {
          await get().fetchMobilityData();
          return false;
        }
        await get().fetchMobilityData();
        return true;
      } catch {
        enableDemoMode();
      }
    }

    set((state) => ({
      spots: state.spots.map((s) =>
        s.spotId === spotId
          ? {
              ...s,
              status: 'RESERVED' as const,
              ledColor: 'YELLOW' as const,
              occupiedBy: userId,
              occupantName: userName,
              reservedUntil: new Date(Date.now() + 120 * 60000).toISOString(),
              entryTime: new Date().toISOString(),
            }
          : s,
      ),
      userSpot: spotId,
    }));
    return true;
  },

  releaseReservation: async (spotId: string) => {
    const spot = get().spots.find((s) => s.spotId === spotId);
    if (!spot) return false;

    if (!isDemoMode()) {
      if (spot.status === 'OCCUPIED') {
        try {
          const { data } = await api.post('/v1/mobility/parking/exit');
          if (!data.success) return false;
          set({ userSpot: null });
          await get().fetchMobilityData();
          await get().fetchParkingReceipts();
          useWalletStore.getState().fetchDashboard();
          return true;
        } catch {
          return false;
        }
      }
      if (spot.status === 'RESERVED') {
        try {
          const { data } = await api.post('/v1/mobility/release', { spotId });
          if (!data.success) {
            await get().fetchMobilityData();
            return false;
          }
          await get().fetchMobilityData();
          set({ userSpot: null });
          return true;
        } catch {
          enableDemoMode();
        }
      }
    }

    const elapsed = spot.entryTime
      ? Math.max(1, Math.floor((Date.now() - new Date(spot.entryTime).getTime()) / 60000))
      : 1;
    const charge = spot.status === 'OCCUPIED' ? elapsed * spot.ratePerMinute : 0;
    if (spot.status === 'OCCUPIED' && !useWalletStore.getState().debitWallet(charge, 'PARKING', `Parking ${spotId} (${elapsed} min)`, 'OneLink Wallet', { skipRemote: true })) {
      return false;
    }
    set((state) => ({
      spots: state.spots.map((s) =>
        s.spotId === spotId
          ? { ...s, status: 'FREE' as const, ledColor: 'GREEN' as const, entryTime: null, occupiedBy: null, occupantName: null, reservedUntil: null }
          : s,
      ),
      userSpot: null,
    }));
    return true;
  },

  rechargeFastag: async (amount: number, vehicleNumber: string) => {
    return useWalletStore.getState().debitWallet(amount, 'MOBILITY', `FASTag recharge ${vehicleNumber}`, 'OneLink Wallet');
  },

  setupRealtimeUpdates: () => {
    if (mobilityRealtimeBound) return;
    mobilityRealtimeBound = true;
    socketService.on('parking:update', (updatedSpots: ParkingSpot[]) => {
      if (Array.isArray(updatedSpots)) {
        const spots = updatedSpots.map(normalizeSpot);
        set({ spots, userSpot: syncUserSpot(spots) });
      } else {
        get().fetchMobilityData();
      }
    });
    socketService.on('parking:entry', (data: { spotId?: string }) => {
      if (data?.spotId) set({ userSpot: data.spotId });
      get().fetchMobilityData();
      useWalletStore.getState().fetchDashboard();
    });
    socketService.on('parking:exit', () => {
      set({ userSpot: null });
      get().fetchMobilityData();
      get().fetchParkingReceipts();
      useWalletStore.getState().fetchDashboard();
    });
    socketService.on('parking:receipt', () => {
      get().fetchParkingReceipts();
      useWalletStore.getState().fetchDashboard();
    });
  },
}));
