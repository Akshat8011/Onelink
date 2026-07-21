import { create } from 'zustand';
import api from '../services/api';
import { enableDemoMode, isDemoMode } from '../services/demoMode';
import { LUCKNOW_METRO_STATIONS, CITY_BUS_ROUTES, calculateMetroFare } from '../data/mockData';
import { CHALO_BUS_ROUTES } from '../data/busRoutesChalo';
import { socketService } from '../services/socket';
import { useWalletStore } from './useWalletStore';
import { useTicketsStore } from './useTicketsStore';
import type { ActiveJourney } from '../types';

let transitRealtimeBound = false;

export interface TransitTicket {
  journeyId: string;
  qrToken: string;
  qrPayload: string;
  fare: number;
  expiresIn: string;
}

interface TransitStore {
  activeJourney: ActiveJourney | null;
  activeTicket: TransitTicket | null;
  metroStations: string[];
  busRoutes: typeof CHALO_BUS_ROUTES;
  isLoading: boolean;
  fetchOptions: () => Promise<void>;
  fetchActiveJourney: () => Promise<void>;
  bookTicket: (entry: string, exit: string, mode?: string) => Promise<boolean>;
  setupRealtimeUpdates: () => void;
  clearJourney: () => void;
}

export const useTransitStore = create<TransitStore>((set, get) => ({
  activeJourney: null,
  activeTicket: null,
  metroStations: [],
  busRoutes: [],
  isLoading: false,

  fetchOptions: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/v1/transit/options');
      if (data.success) {
        set({
          metroStations: data.data.metroStations,
          busRoutes: data.data.busRoutes?.length ? data.data.busRoutes : CHALO_BUS_ROUTES,
          isLoading: false,
        });
        return;
      }
    } catch {
      // demo
    }
    enableDemoMode();
    set({
      metroStations: LUCKNOW_METRO_STATIONS,
      busRoutes: CHALO_BUS_ROUTES,
      isLoading: false,
    });
  },

  fetchActiveJourney: async () => {
    try {
      const { data } = await api.get('/v1/transit/journey/active');
      if (data.success && data.data) {
        set({ activeJourney: data.data });
      }
    } catch {
      /* demo/local */
    }
    useTicketsStore.getState().load();
  },

  bookTicket: async (entryStation: string, exitStation: string, mode = 'METRO') => {
    set({ isLoading: true });

    if (!isDemoMode()) {
      try {
        const { data } = await api.post('/v1/transit/book-ticket', { from: entryStation, to: exitStation });
        if (data.success) {
          useTicketsStore.getState().load();
          useWalletStore.getState().fetchDashboard();
          set({
            activeTicket: {
              journeyId: data.ticketId,
              qrToken: data.ticketId,
              qrPayload: data.qrPayload,
              fare: data.fare,
              expiresIn: '1h',
            },
            isLoading: false,
          });
          return true;
        }
      } catch {
        /* fall through to local */
      }
    }

    const stations = mode === 'METRO' ? get().metroStations : (get().busRoutes[0]?.stops || []);
    const fare = calculateMetroFare(entryStation, exitStation, stations);

    if (!useWalletStore.getState().debitWallet(
      fare,
      'METRO',
      `${mode} ticket: ${entryStation} → ${exitStation}`,
      'OneLink Wallet',
      { skipRemote: true }
    )) {
      set({ isLoading: false });
      return false;
    }

    const ticketRecord = useTicketsStore.getState().addTicket({
      type: mode === 'BUS' ? 'BUS' : 'METRO',
      from: entryStation,
      to: exitStation,
      fare,
      mode,
    });

    const ticket: TransitTicket = {
      journeyId: ticketRecord.ticketId,
      qrToken: ticketRecord.ticketId,
      qrPayload: ticketRecord.qrPayload,
      fare,
      expiresIn: '1h',
    };
    set({ activeTicket: ticket, isLoading: false });
    return true;
  },

  setupRealtimeUpdates: () => {
    if (transitRealtimeBound) return;
    transitRealtimeBound = true;
    socketService.on('transit:entry', () => {
      get().fetchActiveJourney();
      useWalletStore.getState().fetchDashboard();
    });
    socketService.on('transit:exit', () => {
      get().fetchActiveJourney();
      useWalletStore.getState().fetchDashboard();
    });
    socketService.on('transit:ticket-booked', () => {
      useTicketsStore.getState().load();
      useWalletStore.getState().fetchDashboard();
    });
  },
  clearJourney: () => set({ activeJourney: null, activeTicket: null }),
}));
