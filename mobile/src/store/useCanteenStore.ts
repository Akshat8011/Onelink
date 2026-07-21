import { create } from 'zustand';
import { Alert } from 'react-native';
import api from '../services/api';
import { enableDemoMode, isDemoMode } from '../services/demoMode';
import {
  CANTEEN_CATEGORIES,
  CANTEEN_MENU,
  filterCanteenMenu,
  type CanteenItem,
} from '../data/canteenCatalog';
import { useNotificationsStore } from './useNotificationsStore';
import { getUserStorageItem, setUserStorageItem } from '../utils/userStorage';
import { useAuthStore } from './useAuthStore';

export type CanteenOrderStatus = 'PREPARING' | 'READY' | 'COLLECTED';

export interface CanteenCartItem {
  product: CanteenItem;
  quantity: number;
}

export interface CanteenOrder {
  orderId: string;
  orderNumber: number;
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    price: number;
    imageUrl?: string;
    category?: string;
  }>;
  total: number;
  status: CanteenOrderStatus;
  paidAt: string;
  readyAt: string;
  collectedAt?: string;
  receiptId: string;
  transactionId?: string;
  nowServing?: number;
  etaMinutes?: number;
}

const MINUTES_PER_ORDER = 2;
const STORAGE_KEY = 'onelink_canteen_orders';
const QUEUE_KEY = 'onelink_canteen_queue';

let demoQueueTimer: ReturnType<typeof setInterval> | null = null;

interface CanteenStore {
  items: CanteenItem[];
  allItems: CanteenItem[];
  categories: string[];
  cart: CanteenCartItem[];
  selectedCategory: string;
  searchQuery: string;
  orders: CanteenOrder[];
  nowServing: number;
  isLoading: boolean;
  readyBanner: CanteenOrder | null;

  fetchMenu: () => Promise<void>;
  fetchOrders: () => Promise<void>;
  setCategory: (category: string) => void;
  setSearchQuery: (query: string) => void;

  addToCart: (product: CanteenItem) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartCount: () => number;

  pushCartToKiosk: () => Promise<boolean>;
  upsertOrder: (order: CanteenOrder) => void;
  markOrderReady: (payload: Partial<CanteenOrder> & { orderId?: string; orderNumber?: number }) => void;
  markOrderCollected: (payload: Partial<CanteenOrder> & { orderId?: string; orderNumber?: number }) => void;
  setNowServing: (n: number) => void;
  clearReadyBanner: () => void;
  startDemoQueue: () => void;
  stopDemoQueue: () => void;
  reset: () => void;
}

async function persistOrders(orders: CanteenOrder[], nowServing: number) {
  const userId = useAuthStore.getState().user?.userId;
  await setUserStorageItem(STORAGE_KEY, userId, JSON.stringify(orders));
  await setUserStorageItem(QUEUE_KEY, userId, String(nowServing));
}

function serializeLocalOrder(
  order: CanteenOrder,
  nowServing: number,
): CanteenOrder {
  const etaSteps = Math.max(0, order.orderNumber - nowServing);
  return {
    ...order,
    nowServing,
    etaMinutes: order.status === 'PREPARING' ? etaSteps * MINUTES_PER_ORDER : 0,
  };
}

export const useCanteenStore = create<CanteenStore>((set, get) => ({
  items: filterCanteenMenu('Meals'),
  allItems: CANTEEN_MENU,
  categories: [...CANTEEN_CATEGORIES],
  cart: [],
  selectedCategory: 'Meals',
  searchQuery: '',
  orders: [],
  nowServing: 0,
  isLoading: false,
  readyBanner: null,

  fetchMenu: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/v1/canteen/menu');
      if (data.success && Array.isArray(data.items) && data.items.length) {
        // Lock verified local images so a stale backend cannot reintroduce shared/fake photos.
        const localById = new Map(CANTEEN_MENU.map((i) => [i.productId, i]));
        const allItems = data.items.map((apiItem: CanteenItem) => {
          const loc = localById.get(apiItem.productId);
          if (!loc) return apiItem;
          return { ...apiItem, imageUrl: loc.imageUrl, name: loc.name, description: loc.description || apiItem.description };
        });
        for (const loc of CANTEEN_MENU) {
          if (!allItems.some((i) => i.productId === loc.productId)) allItems.push(loc);
        }
        set({
          allItems,
          items: filterItems(allItems, get().selectedCategory, get().searchQuery),
          categories: data.categories?.length ? data.categories : [...CANTEEN_CATEGORIES],
          isLoading: false,
        });
        return;
      }
    } catch {
      enableDemoMode();
    }
    set({
      allItems: CANTEEN_MENU,
      items: filterCanteenMenu(get().selectedCategory, get().searchQuery),
      categories: [...CANTEEN_CATEGORIES],
      isLoading: false,
    });
  },

  fetchOrders: async () => {
    try {
      const { data } = await api.get('/v1/canteen/orders');
      if (data.success) {
        set({
          orders: data.orders || [],
          nowServing: data.nowServing ?? 0,
        });
        await persistOrders(data.orders || [], data.nowServing ?? 0);
        return;
      }
    } catch {
      enableDemoMode();
    }

    const userId = useAuthStore.getState().user?.userId;
    try {
      const raw = await getUserStorageItem(STORAGE_KEY, userId);
      const queueRaw = await getUserStorageItem(QUEUE_KEY, userId);
      const orders: CanteenOrder[] = raw ? JSON.parse(raw) : [];
      const nowServing = queueRaw ? Number(queueRaw) || 0 : 0;
      set({
        orders: orders.map((o) => serializeLocalOrder(o, nowServing)),
        nowServing,
      });
    } catch {
      set({ orders: [], nowServing: 0 });
    }
    get().startDemoQueue();
  },

  setCategory: (category) => {
    set({
      selectedCategory: category,
      items: filterItems(get().allItems, category, get().searchQuery),
    });
  },

  setSearchQuery: (query) => {
    set({
      searchQuery: query,
      items: filterItems(get().allItems, get().selectedCategory, query),
    });
  },

  addToCart: (product) => {
    set((state) => {
      const existing = state.cart.find((c) => c.product.productId === product.productId);
      if (existing) {
        return {
          cart: state.cart.map((c) =>
            c.product.productId === product.productId
              ? { ...c, quantity: c.quantity + 1 }
              : c,
          ),
        };
      }
      return { cart: [...state.cart, { product, quantity: 1 }] };
    });
  },

  removeFromCart: (productId) => {
    set((state) => ({
      cart: state.cart.filter((c) => c.product.productId !== productId),
    }));
  },

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeFromCart(productId);
      return;
    }
    set((state) => ({
      cart: state.cart.map((c) =>
        c.product.productId === productId ? { ...c, quantity } : c,
      ),
    }));
  },

  clearCart: () => set({ cart: [] }),

  getCartTotal: () =>
    get().cart.reduce((sum, c) => sum + c.product.price * c.quantity, 0),

  getCartCount: () => get().cart.reduce((sum, c) => sum + c.quantity, 0),

  pushCartToKiosk: async () => {
    const cartSnapshot = [...get().cart];
    if (!cartSnapshot.length) return false;
    const subtotal = get().getCartTotal();

    try {
      const { data } = await api.post('/v1/canteen/push-cart', {
        items: cartSnapshot.map((c) => ({
          productId: c.product.productId,
          name: c.product.name,
          quantity: c.quantity,
          price: c.product.price,
          imageUrl: c.product.imageUrl,
          category: c.product.category,
        })),
        subtotal,
      });
      if (!data.success) return false;
      set({ cart: [] });
      useNotificationsStore.getState().add({
        title: 'Cart sent to canteen',
        body: `Tap your card at the canteen kiosk to pay ₹${subtotal}`,
        type: 'ORDER',
        actionRoute: 'Canteen',
      });
      return true;
    } catch {
      enableDemoMode();
      // Demo: store a pending local cart id so the UI can still proceed
      const cartId = `DEMO_CNCART_${Date.now()}`;
      set({ cart: [] });
      useNotificationsStore.getState().add({
        title: 'Cart ready (demo)',
        body: `Pay ₹${subtotal} at the canteen kiosk · ${cartId.slice(-8)}`,
        type: 'ORDER',
        actionRoute: 'Canteen',
      });
      // Create a demo preparing order immediately so the flow is usable offline
      const nowServing = get().nowServing || 0;
      const orderNumber = Math.max(nowServing + 1, ...get().orders.map((o) => o.orderNumber), 0) + 1;
      const paidAt = new Date();
      const steps = Math.max(1, orderNumber - nowServing);
      const order: CanteenOrder = {
        orderId: `DEMO_CNORD_${Date.now()}`,
        orderNumber,
        items: cartSnapshot.map((c) => ({
          productId: c.product.productId,
          name: c.product.name,
          quantity: c.quantity,
          price: c.product.price,
          imageUrl: c.product.imageUrl,
          category: c.product.category,
        })),
        total: subtotal,
        status: 'PREPARING',
        paidAt: paidAt.toISOString(),
        readyAt: new Date(paidAt.getTime() + steps * MINUTES_PER_ORDER * 60_000).toISOString(),
        receiptId: `DEMO_CNRCP_${Date.now()}`,
        nowServing,
        etaMinutes: steps * MINUTES_PER_ORDER,
      };
      // For demo "pay at canteen", we only push — don't create paid order until kiosk.
      // Keep notification only; store pending cart metadata in notification body.
      void cartId;
      void order;
      get().startDemoQueue();
      return true;
    }
  },

  upsertOrder: (order) => {
    set((state) => {
      const idx = state.orders.findIndex(
        (o) => o.orderId === order.orderId || o.orderNumber === order.orderNumber,
      );
      const next = [...state.orders];
      const merged = serializeLocalOrder(order, state.nowServing);
      if (idx >= 0) next[idx] = { ...next[idx], ...merged };
      else next.unshift(merged);
      persistOrders(next, state.nowServing);
      return { orders: next };
    });
  },

  markOrderReady: (payload) => {
    set((state) => {
      const next = state.orders.map((o) => {
        const match =
          (payload.orderId && o.orderId === payload.orderId) ||
          (payload.orderNumber != null && o.orderNumber === payload.orderNumber);
        if (!match) return o;
        return { ...o, ...payload, status: 'READY' as const, etaMinutes: 0 };
      });
      const ready =
        next.find(
          (o) =>
            o.status === 'READY' &&
            ((payload.orderId && o.orderId === payload.orderId) ||
              (payload.orderNumber != null && o.orderNumber === payload.orderNumber)),
        ) || null;
      persistOrders(next, state.nowServing);
      return { orders: next, readyBanner: ready };
    });

    const orderNumber = payload.orderNumber;
    Alert.alert(
      'Order ready!',
      orderNumber
        ? `Your canteen order #${orderNumber} is ready. Collect it at the kiosk.`
        : 'Your canteen order is ready. Collect it at the kiosk.',
    );
    useNotificationsStore.getState().add({
      title: 'Canteen order ready',
      body: orderNumber
        ? `Order #${orderNumber} is ready for collection`
        : 'Your food is ready at the canteen',
      type: 'ORDER',
      actionRoute: 'Canteen',
      actionParams: payload.orderId ? { orderId: payload.orderId } : undefined,
    });
  },

  markOrderCollected: (payload) => {
    set((state) => {
      const next = state.orders.map((o) => {
        const match =
          (payload.orderId && o.orderId === payload.orderId) ||
          (payload.orderNumber != null && o.orderNumber === payload.orderNumber);
        if (!match) return { ...o, nowServing: state.nowServing };
        return {
          ...o,
          ...payload,
          status: 'COLLECTED' as const,
          collectedAt: payload.collectedAt || new Date().toISOString(),
          etaMinutes: 0,
        };
      });
      persistOrders(next, state.nowServing);
      return { orders: next, readyBanner: null };
    });
  },

  setNowServing: (n) => {
    set((state) => {
      const orders = state.orders.map((o) => {
        if (o.status === 'PREPARING' && o.orderNumber <= n) {
          return { ...o, status: 'READY' as const, nowServing: n, etaMinutes: 0 };
        }
        return serializeLocalOrder(o, n);
      });
      persistOrders(orders, n);
      return { nowServing: n, orders };
    });
  },

  clearReadyBanner: () => set({ readyBanner: null }),

  startDemoQueue: () => {
    if (demoQueueTimer) return;
    demoQueueTimer = setInterval(() => {
      const { orders, nowServing } = get();
      const preparing = orders.filter((o) => o.status === 'PREPARING');
      if (!preparing.length) return;
      const maxNum = Math.max(...preparing.map((o) => o.orderNumber));
      if (nowServing >= maxNum) return;
      const next = nowServing + 1;
      const becomingReady = preparing.filter((o) => o.orderNumber <= next);
      get().setNowServing(next);
      becomingReady.forEach((o) => get().markOrderReady({ ...o, orderNumber: o.orderNumber, orderId: o.orderId }));
    }, MINUTES_PER_ORDER * 60_000);
  },

  stopDemoQueue: () => {
    if (demoQueueTimer) {
      clearInterval(demoQueueTimer);
      demoQueueTimer = null;
    }
  },

  reset: () => {
    get().stopDemoQueue();
    set({
      cart: [],
      orders: [],
      nowServing: 0,
      readyBanner: null,
      selectedCategory: 'Meals',
      searchQuery: '',
      items: filterCanteenMenu('Meals'),
      allItems: CANTEEN_MENU,
    });
  },
}));

function filterItems(all: CanteenItem[], category: string, search: string): CanteenItem[] {
  const q = search.trim().toLowerCase();
  return all.filter((item) => {
    if (category && category !== 'All' && item.category !== category) return false;
    if (!q) return true;
    return (
      item.name.toLowerCase().includes(q) ||
      (item.description || '').toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  });
}
