import type { SupermarketProduct } from './productsCatalog';
import catalogData from './shopCatalog.json';

interface CatalogProduct {
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

interface ShopCatalogJson {
  categories: string[];
  itemCount: number;
  products: CatalogProduct[];
}

const catalog = catalogData as ShopCatalogJson;

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function toSupermarketProduct(p: CatalogProduct, index: number): SupermarketProduct {
  return {
    productId: p.id,
    name: p.name,
    brand: p.brand,
    description: `${p.brand} ${p.name} — ${p.unit}`,
    price: p.price,
    mrp: p.mrp,
    category: p.category,
    subCategory: p.subCategory,
    imageUrl: p.image,
    stock: p.inStock ? 20 + (index % 80) : 0,
    unit: p.unit,
    expiryDate: addDays(30 + (index % 200)),
    batchNo: `BN${p.id.replace('SKU_', '')}`,
  };
}

let _cached: SupermarketProduct[] | null = null;
let _byCategory: Map<string, SupermarketProduct[]> | null = null;

export function loadShopCatalog(): SupermarketProduct[] {
  if (!_cached) {
    _cached = catalog.products.map(toSupermarketProduct);
  }
  return _cached;
}

function getByCategory(): Map<string, SupermarketProduct[]> {
  if (!_byCategory) {
    _byCategory = new Map();
    const all = loadShopCatalog();
    for (const p of all) {
      const list = _byCategory.get(p.category) ?? [];
      list.push(p);
      _byCategory.set(p.category, list);
    }
  }
  return _byCategory;
}

export function getShopCategories(): string[] {
  return ['All', ...catalog.categories];
}

export function getShopProductCount(): number {
  return catalog.itemCount;
}

export function filterShopProducts(category?: string): SupermarketProduct[] {
  if (!category || category === 'All') return loadShopCatalog();
  return getByCategory().get(category) ?? [];
}

export function searchShopProducts(
  query: string,
  category?: string,
  limit = 24,
  offset = 0,
): { items: SupermarketProduct[]; total: number } {
  const q = query.trim().toLowerCase();
  const base =
    !category || category === 'All'
      ? loadShopCatalog()
      : getByCategory().get(category) ?? [];

  const filtered = q
    ? base.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q),
      )
    : base;

  return {
    items: filtered.slice(offset, offset + limit),
    total: filtered.length,
  };
}
