import type { CartItem, ShopOrder } from './shopTypes';

const CART_KEY = 'quickcomm_shop_cart';
const ORDERS_KEY = 'quickcomm_shop_orders';

export function loadCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export function loadOrders(): ShopOrder[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveOrders(orders: ShopOrder[]) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

export function addToCart(item: Omit<CartItem, 'qty'>, qty = 1): CartItem[] {
  const cart = loadCart();
  const idx = cart.findIndex((c) => c.productId === item.productId);
  if (idx >= 0) cart[idx].qty += qty;
  else cart.push({ ...item, qty });
  saveCart(cart);
  return cart;
}

export function updateCartQty(productId: string, qty: number): CartItem[] {
  let cart = loadCart();
  if (qty <= 0) cart = cart.filter((c) => c.productId !== productId);
  else cart = cart.map((c) => (c.productId === productId ? { ...c, qty } : c));
  saveCart(cart);
  return cart;
}

export function clearCart() {
  saveCart([]);
}

export function placeOrder(
  items: CartItem[],
  paymentMethod: string,
): ShopOrder {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const order: ShopOrder = {
    orderId: `ORD-${Date.now().toString(36).toUpperCase()}`,
    items,
    subtotal,
    deliveryFee: 0,
    total: subtotal,
    status: 'placed',
    placedAt: new Date().toISOString(),
    address: 'OneLink Supermarket',
    paymentMethod,
  };
  const orders = [order, ...loadOrders()];
  saveOrders(orders);
  clearCart();
  return order;
}
