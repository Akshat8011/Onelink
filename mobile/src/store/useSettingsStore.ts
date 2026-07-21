import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AppSettings {
  pushNotifications: boolean;
  emailAlerts: boolean;
  smsAlerts: boolean;
  darkMode: boolean;
  language: 'EN' | 'HI';
  showBalanceOnHome: boolean;
  autoTopUp: boolean;
  autoTopUpThreshold: number;
}

interface SettingsStore extends AppSettings {
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<AppSettings>) => Promise<void>;
  reset: () => Promise<void>;
}

const STORAGE_KEY = 'onelink_settings';

const DEFAULTS: AppSettings = {
  pushNotifications: true,
  emailAlerts: true,
  smsAlerts: false,
  darkMode: false,
  language: 'EN',
  showBalanceOnHome: true,
  autoTopUp: false,
  autoTopUpThreshold: 500,
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...DEFAULTS,
  loaded: false,

  load: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) set({ ...JSON.parse(raw), loaded: true });
    else set({ ...DEFAULTS, loaded: true });
  },

  update: async (patch) => {
    const next = { ...get(), ...patch };
    const { load, update, reset, loaded, ...settings } = next as SettingsStore;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    set({ ...settings, loaded: true });
  },

  reset: async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULTS));
    set({ ...DEFAULTS, loaded: true });
  },
}));
