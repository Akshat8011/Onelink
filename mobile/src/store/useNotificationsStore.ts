import { create } from 'zustand';
import { getUserStorageItem, setUserStorageItem } from '../utils/userStorage';
import { useAuthStore } from './useAuthStore';

export type NotificationRoute =
  | 'Tickets'
  | 'TicketDetail'
  | 'OrderHistory'
  | 'OrderReceipt'
  | 'City'
  | 'Wallet'
  | 'Parking'
  | 'Transit'
  | 'Shop'
  | 'Canteen'
  | 'Rewards'
  | 'Account'
  | 'Bills'
  | 'Invest'
  | 'Loans'
  | 'Insurance';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: 'TRANSIT' | 'WALLET' | 'ORDER' | 'EVENT' | 'PARKING' | 'SYSTEM';
  read: boolean;
  createdAt: string;
  actionRoute?: NotificationRoute;
  actionParams?: {
    orderId?: string;
    ticketId?: string;
    receiptId?: string;
  };
}

interface NotificationsStore {
  notifications: AppNotification[];
  unreadCount: number;
  load: () => Promise<void>;
  reset: () => void;
  add: (n: Omit<AppNotification, 'id' | 'read' | 'createdAt'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
}

const STORAGE_KEY = 'onelink_notifications';

async function persist(notifications: AppNotification[]) {
  const userId = useAuthStore.getState().user?.userId;
  await setUserStorageItem(STORAGE_KEY, userId, JSON.stringify(notifications));
}

export const useNotificationsStore = create<NotificationsStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,

  reset: () => {
    set({ notifications: [], unreadCount: 0 });
  },

  load: async () => {
    const userId = useAuthStore.getState().user?.userId;
    const raw = await getUserStorageItem(STORAGE_KEY, userId);
    if (raw) {
      const notifications = JSON.parse(raw) as AppNotification[];
      set({ notifications, unreadCount: notifications.filter((n) => !n.read).length });
    } else {
      set({ notifications: [], unreadCount: 0 });
    }
  },

  add: (n) => {
    const notification: AppNotification = {
      ...n,
      id: `N_${Date.now()}`,
      read: false,
      createdAt: new Date().toISOString(),
    };
    const notifications = [notification, ...get().notifications];
    set({ notifications, unreadCount: notifications.filter((x) => !x.read).length });
    persist(notifications);
  },

  markRead: (id) => {
    const notifications = get().notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    set({ notifications, unreadCount: notifications.filter((n) => !n.read).length });
    persist(notifications);
  },

  markAllRead: () => {
    const notifications = get().notifications.map((n) => ({ ...n, read: true }));
    set({ notifications, unreadCount: 0 });
    persist(notifications);
  },

  clear: () => {
    set({ notifications: [], unreadCount: 0 });
    persist([]);
  },
}));
