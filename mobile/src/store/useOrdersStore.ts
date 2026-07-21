import { create } from 'zustand';
import api from '../services/api';
import { isDemoMode } from '../services/demoMode';
import { useNotificationsStore } from './useNotificationsStore';
import { getUserStorageItem, setUserStorageItem } from '../utils/userStorage';
import { useAuthStore } from './useAuthStore';

export interface OrderItem {
  productId: string;
  name: string;
  brand: string;
  quantity: number;
  unit: string;
  price: number;
  expiryDate?: string;
}

export interface OrderReceipt {
  orderId: string;
  username: string;
  customerName: string;
  items: OrderItem[];
  subtotal: number;
  handlingFee: number;
  deliveryFee: number;
  total: number;
  paymentMode: string;
  deliveryAddress: string;
  status: 'PLACED' | 'DELIVERED' | 'CANCELLED';
  placedAt: string;
  deliveredAt?: string;
}

interface OrdersStore {
  orders: OrderReceipt[];
  load: () => Promise<void>;
  reset: () => void;
  upsertKioskOrder: (data: {
    orderId: string;
    amount: number;
    items?: Array<{
      productId?: string;
      name: string;
      brand?: string;
      quantity: number;
      unit?: string;
      price: number;
    }>;
    receiptAt?: string;
  }) => OrderReceipt;
  addOrder: (params: {
    items: OrderItem[];
    subtotal: number;
    handlingFee: number;
    deliveryFee: number;
    total: number;
    deliveryAddress: string;
    paymentMode?: string;
  }) => OrderReceipt;
}

const STORAGE_KEY = 'onelink_orders';

async function persist(orders: OrderReceipt[]) {
  const userId = useAuthStore.getState().user?.userId;
  await setUserStorageItem(STORAGE_KEY, userId, JSON.stringify(orders));
}

function mergeOrders(local: OrderReceipt[], remote: OrderReceipt[]): OrderReceipt[] {
  const byId = new Map<string, OrderReceipt>();
  for (const order of local) byId.set(order.orderId, order);
  for (const order of remote) byId.set(order.orderId, order);
  return [...byId.values()].sort(
    (a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime(),
  );
}

export const useOrdersStore = create<OrdersStore>((set, get) => ({
  orders: [],

  reset: () => {
    set({ orders: [] });
  },

  load: async () => {
    const user = useAuthStore.getState().user;
    const userId = user?.userId;
    const username = user?.username || '';

    let localOrders: OrderReceipt[] = [];
    const raw = await getUserStorageItem(STORAGE_KEY, userId);
    if (raw) {
      localOrders = (JSON.parse(raw) as OrderReceipt[]).filter(
        (o) => !o.username || o.username === username,
      );
    }

    if (!isDemoMode() && userId) {
      try {
        const { data } = await api.get('/v1/kiosk/shop/orders');
        if (data.success && Array.isArray(data.orders)) {
          const merged = mergeOrders(localOrders, data.orders as OrderReceipt[]);
          set({ orders: merged });
          await persist(merged);
          return;
        }
      } catch {
        /* use local fallback */
      }
    }

    set({ orders: localOrders });
  },

  upsertKioskOrder: (data) => {
    const user = useAuthStore.getState().user;
    const order: OrderReceipt = {
      orderId: data.orderId,
      username: user?.username || 'guest',
      customerName: user?.name || user?.username || 'Guest',
      items: (data.items || []).map((item) => ({
        productId: item.productId || '',
        name: item.name,
        brand: item.brand || '',
        quantity: item.quantity,
        unit: item.unit || '1 pc',
        price: item.price,
      })),
      subtotal: data.amount,
      handlingFee: 0,
      deliveryFee: 0,
      total: data.amount,
      paymentMode: 'Pay via Card · Kiosk',
      deliveryAddress: 'OneLink Supermarket · Kiosk pickup',
      status: 'PLACED',
      placedAt: data.receiptAt || new Date().toISOString(),
    };

    const orders = mergeOrders(
      get().orders.filter((o) => o.orderId !== order.orderId),
      [order],
    );
    set({ orders });
    persist(orders);

    useNotificationsStore.getState().add({
      title: 'Kiosk order paid',
      body: `${order.items.length} items · ₹${order.total} · Receipt ${order.orderId}`,
      type: 'ORDER',
      actionRoute: 'OrderReceipt',
      actionParams: { orderId: order.orderId },
    });

    return order;
  },

  addOrder: (params) => {
    const user = useAuthStore.getState().user;
    const order: OrderReceipt = {
      orderId: `ORD_${Date.now()}`,
      username: user?.username || 'guest',
      customerName: user?.name || user?.username || 'Guest',
      items: params.items,
      subtotal: params.subtotal,
      handlingFee: params.handlingFee,
      deliveryFee: params.deliveryFee,
      total: params.total,
      paymentMode: params.paymentMode || 'OneLink Wallet',
      deliveryAddress: params.deliveryAddress,
      status: 'PLACED',
      placedAt: new Date().toISOString(),
    };

    const orders = [order, ...get().orders];
    set({ orders });
    persist(orders);

    useNotificationsStore.getState().add({
      title: 'Supermarket order placed',
      body: `${params.items.length} items · ₹${params.total} · ${params.deliveryAddress}`,
      type: 'ORDER',
      actionRoute: 'OrderReceipt',
      actionParams: { orderId: order.orderId },
    });

    return order;
  },
}));
