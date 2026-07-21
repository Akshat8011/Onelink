import { create } from 'zustand';
import api from '../services/api';
import { enableDemoMode } from '../services/demoMode';
import { LiveEvent } from '../data/eventsLucknow';
import { fetchAllEvents } from '../services/eventsScraper';
import { useWalletStore } from './useWalletStore';

export type CityEvent = LiveEvent;

export interface MenuItem {
  name: string;
  price: number;
  description: string;
  isVeg: boolean;
}

export interface DiningPlace {
  restaurantId: string;
  name: string;
  description: string;
  address: string;
  city: string;
  cuisine: string[];
  rating: number;
  costForTwo: number;
  imageUrl: string;
  menu: MenuItem[];
}

interface CityStore {
  events: CityEvent[];
  diningPlaces: DiningPlace[];
  isLoading: boolean;
  lastSyncedAt: string | null;
  fetchEvents: () => Promise<void>;
  fetchDining: () => Promise<void>;
  bookEvent: (eventId: string, ticketsCount: number) => Promise<boolean>;
  reserveTable: (restaurantId: string, guests: number) => Promise<boolean>;
}

import { MOCK_DINING } from '../data/mockData';

export const useCityStore = create<CityStore>((set, get) => ({
  events: [],
  diningPlaces: [],
  isLoading: false,
  lastSyncedAt: null,

  fetchEvents: async () => {
    set({ isLoading: true });
    try {
      const events = await fetchAllEvents('lucknow', { forceRefresh: true });
      if (events.length) {
        set({ events, isLoading: false, lastSyncedAt: new Date().toISOString() });
        return;
      }
    } catch {
      // fall through to bundled/cache path inside fetchAllEvents
    }
    try {
      const events = await fetchAllEvents('lucknow');
      if (events.length) {
        set({ events, isLoading: false, lastSyncedAt: new Date().toISOString() });
        return;
      }
    } catch {
      // demo
    }
    enableDemoMode();
    set({
      events: [],
      isLoading: false,
      lastSyncedAt: new Date().toISOString(),
    });
  },

  fetchDining: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/v1/city/dining');
      if (data.success) {
        set({ diningPlaces: data.data, isLoading: false });
        return;
      }
    } catch {
      // demo
    }
    enableDemoMode();
    set({ diningPlaces: JSON.parse(JSON.stringify(MOCK_DINING)), isLoading: false });
  },

  bookEvent: async (eventId: string, ticketsCount = 1) => {
    const event = get().events.find((e) => e.eventId === eventId);
    if (!event || event.ticketsSold >= event.capacity) return false;
    const total = event.price * ticketsCount;
    const wallet = useWalletStore.getState();
    if (!wallet.debitWallet(total, 'EVENT', `${event.title} × ${ticketsCount}`, 'OneLink Wallet')) return false;
    set({
      events: get().events.map((e) =>
        e.eventId === eventId ? { ...e, ticketsSold: e.ticketsSold + ticketsCount } : e
      ),
    });
    return true;
  },

  reserveTable: async (restaurantId: string, guests: number) => {
    const place = get().diningPlaces.find((d) => d.restaurantId === restaurantId);
    if (!place) return false;
    const deposit = Math.min(200, Math.floor(place.costForTwo / 4));
    return useWalletStore.getState().debitWallet(deposit, 'EVENT', `Table at ${place.name} for ${guests}`, 'OneLink Wallet');
  },
}));
