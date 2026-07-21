export interface ShopProduct {
  id: string;
  name: string;
  brand: string;
  category: string;
  subCategory: string;
  unit: string;
  price: number;
  mrp: number;
  image: string;
  inStock: boolean;
}

export interface ShopCatalog {
  generatedAt: string;
  currency: string;
  itemCount: number;
  categories: string[];
  products: ShopProduct[];
}

export interface CartItem {
  productId: string;
  name: string;
  brand: string;
  unit: string;
  price: number;
  image: string;
  qty: number;
}

export interface ShopOrder {
  orderId: string;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: 'placed' | 'delivered';
  placedAt: string;
  address: string;
  paymentMethod: string;
}
