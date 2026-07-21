import { create } from 'zustand';
import api from '../services/api';
import { enableDemoMode, isDemoMode } from '../services/demoMode';
import {
  getShopCategories,
  getShopProductCount,
  searchShopProducts,
} from '../data/shopCatalogLoader';
import { useWalletStore } from './useWalletStore';
import { useOrdersStore } from './useOrdersStore';
import { useRewardsStore } from './useRewardsStore';

export type Product = import('../data/productsCatalog').SupermarketProduct;

export interface CartItem {
  product: Product;
  quantity: number;
}

const PAGE_SIZE = 24;

interface RetailStore {
  products: Product[];
  categories: string[];
  cart: CartItem[];
  selectedCategory: string;
  searchQuery: string;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  totalProductCount: number;
  visibleCount: number;

  fetchProducts: (category?: string, reset?: boolean) => Promise<void>;
  loadMoreProducts: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  fetchCategories: () => Promise<void>;
  setCategory: (category: string) => void;

  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartCount: () => number;

  checkout: () => Promise<boolean>;
  pushCartToKiosk: () => Promise<boolean>;
}

function loadLocalPage(
  category: string,
  searchQuery: string,
  offset: number,
  limit: number,
) {
  return searchShopProducts(searchQuery, category, limit, offset);
}

export const useRetailStore = create<RetailStore>((set, get) => ({
  products: [],
  categories: getShopCategories(),
  cart: [],
  selectedCategory: 'All',
  searchQuery: '',
  isLoading: false,
  isLoadingMore: false,
  hasMore: true,
  totalProductCount: getShopProductCount(),
  visibleCount: 0,

  fetchProducts: async (category?: string, reset = true) => {
    const cat = category ?? get().selectedCategory;
    const searchQuery = get().searchQuery;
    const offset = reset ? 0 : get().products.length;

    set({ isLoading: reset, isLoadingMore: !reset, selectedCategory: cat });

    try {
      const url =
        cat && cat !== 'All'
          ? `/v1/retail/products?category=${encodeURIComponent(cat)}`
          : '/v1/retail/products';
      const { data } = await api.get(url);
      if (data.success && Array.isArray(data.data) && data.data.length > 50) {
        const slice = reset ? data.data.slice(0, PAGE_SIZE) : data.data;
        set({
          products: reset ? slice : [...get().products, ...slice],
          totalProductCount: data.data.length,
          visibleCount: reset ? slice.length : get().products.length + slice.length,
          hasMore: slice.length >= PAGE_SIZE,
          isLoading: false,
          isLoadingMore: false,
        });
        return;
      }
    } catch {
      // bundled catalog
    }

    enableDemoMode();
    const { items, total } = loadLocalPage(cat, searchQuery, offset, PAGE_SIZE);
    set({
      products: reset ? items : [...get().products, ...items],
      totalProductCount: total,
      visibleCount: reset ? items.length : get().products.length + items.length,
      hasMore: offset + items.length < total,
      isLoading: false,
      isLoadingMore: false,
    });
  },

  loadMoreProducts: async () => {
    const { isLoading, isLoadingMore, hasMore } = get();
    if (isLoading || isLoadingMore || !hasMore) return;
    await get().fetchProducts(undefined, false);
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
    get().fetchProducts(get().selectedCategory, true);
  },

  fetchCategories: async () => {
    set({ categories: getShopCategories() });
  },

  setCategory: (category: string) => {
    set({ selectedCategory: category, searchQuery: '' });
    get().fetchProducts(category, true);
  },

  addToCart: (product: Product) => {
    set((state) => {
      const existing = state.cart.find((c) => c.product.productId === product.productId);
      if (existing) {
        if (existing.quantity >= product.stock) return state;
        return {
          cart: state.cart.map((c) =>
            c.product.productId === product.productId ? { ...c, quantity: c.quantity + 1 } : c
          ),
        };
      }
      return { cart: [...state.cart, { product, quantity: 1 }] };
    });
  },

  removeFromCart: (productId: string) => {
    set((state) => ({ cart: state.cart.filter((c) => c.product.productId !== productId) }));
  },

  updateQuantity: (productId: string, quantity: number) => {
    if (quantity <= 0) {
      get().removeFromCart(productId);
      return;
    }
    set((state) => {
      const item = state.cart.find((c) => c.product.productId === productId);
      if (item && quantity > item.product.stock) return state;
      return {
        cart: state.cart.map((c) =>
          c.product.productId === productId ? { ...c, quantity } : c
        ),
      };
    });
  },

  clearCart: () => set({ cart: [] }),

  getCartTotal: () => get().cart.reduce((sum, c) => sum + c.product.price * c.quantity, 0),

  getCartCount: () => get().cart.reduce((sum, c) => sum + c.quantity, 0),

  checkout: async () => {
    const subtotal = get().getCartTotal();
    const total = subtotal;
    const cartSnapshot = [...get().cart];

    const wallet = useWalletStore.getState();
    if (!wallet.debitWallet(total, 'SHOPPING', `Supermarket purchase · ${cartSnapshot.length} items`, 'OneLink Wallet', { skipRemote: true })) {
      return false;
    }

    useRewardsStore.getState().earnFromSpend(total);

    useOrdersStore.getState().addOrder({
      items: cartSnapshot.map((c) => ({
        productId: c.product.productId,
        name: c.product.name,
        brand: c.product.brand,
        quantity: c.quantity,
        unit: c.product.unit,
        price: c.product.price,
        expiryDate: c.product.expiryDate,
      })),
      subtotal,
      handlingFee: 0,
      deliveryFee: 0,
      total,
      deliveryAddress: 'OneLink Supermarket',
    });

    set((state) => ({
      cart: [],
      products: state.products.map((p) => {
        const cartItem = cartSnapshot.find((c) => c.product.productId === p.productId);
        if (!cartItem) return p;
        return { ...p, stock: Math.max(0, p.stock - cartItem.quantity) };
      }),
    }));

    if (!isDemoMode()) {
      try {
        await api.post('/v1/retail/order', {
          items: cartSnapshot.map((c) => ({ productId: c.product.productId, quantity: c.quantity })),
          deliveryAddress: 'OneLink Supermarket',
        });
      } catch {
        enableDemoMode();
      }
    }
    return true;
  },

  pushCartToKiosk: async () => {
    const cartSnapshot = [...get().cart];
    if (!cartSnapshot.length) return false;
    const subtotal = get().getCartTotal();
    try {
      const { data } = await api.post('/v1/kiosk/shop/push-cart', {
        items: cartSnapshot.map((c) => ({
          productId: c.product.productId,
          name: c.product.name,
          brand: c.product.brand,
          quantity: c.quantity,
          unit: c.product.unit,
          price: c.product.price,
        })),
        subtotal,
      });
      if (!data.success) return false;
      set({ cart: [] });
      return true;
    } catch {
      return false;
    }
  },
}));
