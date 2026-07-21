export interface SupermarketProduct {
  productId: string;
  name: string;
  brand: string;
  description: string;
  price: number;
  mrp: number;
  category: string;
  subCategory: string;
  imageUrl: string;
  stock: number;
  unit: string;
  expiryDate: string;
  batchNo: string;
}

const CATEGORY_IMAGES: Record<string, string> = {
  'Fruits & Vegetables': 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&q=80&w=400',
  'Dairy & Breakfast': 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&q=80&w=400',
  'Snacks & Munchies': 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?auto=format&fit=crop&q=80&w=400',
  Beverages: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=400',
  'Personal Care': 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&q=80&w=400',
  'Home & Cleaning': 'https://images.unsplash.com/photo-1585421516928-4b8c5e2e2b0e?auto=format&fit=crop&q=80&w=400',
  'Staples & Grains': 'https://images.unsplash.com/photo-1586201375767-2b74b24f3e8c?auto=format&fit=crop&q=80&w=400',
  'Baby Care': 'https://images.unsplash.com/photo-1515488042361-ee00e17ddd4f?auto=format&fit=crop&q=80&w=400',
};

const CATALOG: { category: string; subCategory: string; brands: string[]; items: string[]; units: string[]; priceRange: [number, number] }[] = [
  {
    category: 'Fruits & Vegetables',
    subCategory: 'Fresh Produce',
    brands: ['FarmFresh', 'Organic Harvest', 'Local Farm', 'Nature\'s Best'],
    items: ['Apple', 'Banana', 'Tomato', 'Onion', 'Potato', 'Carrot', 'Spinach', 'Broccoli', 'Mango', 'Orange', 'Capsicum', 'Cauliflower', 'Cabbage', 'Lady Finger', 'Brinjal', 'Cucumber', 'Lemon', 'Ginger', 'Garlic', 'Coriander'],
    units: ['500 g', '1 kg', '250 g', '1 pc', '1 bunch'],
    priceRange: [20, 250],
  },
  {
    category: 'Dairy & Breakfast',
    subCategory: 'Dairy',
    brands: ['Amul', 'Mother Dairy', 'Britannia', 'Nestle', 'Parag', 'Gowardhan'],
    items: ['Taaza Milk', 'Gold Milk', 'Butter', 'Cheese Slices', 'Paneer', 'Curd', 'Ghee', 'Bread', 'Eggs', 'Oats', 'Cornflakes', 'Muesli', 'Yogurt', 'Lassi', 'Cream', 'Buttermilk'],
    units: ['500 ml', '1 L', '200 g', '100 g', '6 pcs', '400 g', '1 pack'],
    priceRange: [25, 450],
  },
  {
    category: 'Snacks & Munchies',
    subCategory: 'Packaged Food',
    brands: ['Lays', 'Haldiram\'s', 'Parle', 'Britannia', 'Cadbury', 'Nestle', 'Bingo', 'Kurkure', 'Uncle Chips', 'Too Yumm'],
    items: ['Classic Salted Chips', 'Masala Munch', 'Bhujia', 'Namkeen', 'Glucose Biscuits', 'Marie Gold', 'Good Day', 'Dairy Milk', 'KitKat', 'Munch', 'Popcorn', 'Nachos', 'Wafers', 'Mixture', 'Mathri'],
    units: ['52 g', '80 g', '100 g', '200 g', '400 g', '1 pack'],
    priceRange: [10, 350],
  },
  {
    category: 'Beverages',
    subCategory: 'Drinks',
    brands: ['Coca-Cola', 'Pepsi', 'Real', 'Tropicana', 'Bisleri', 'Kinley', 'Red Bull', 'Nescafe', 'Tata Tea', 'Bru'],
    items: ['Cola', 'Orange Juice', 'Apple Juice', 'Water Bottle', 'Energy Drink', 'Cold Coffee', 'Green Tea', 'Tea Leaves', 'Coffee Powder', 'Lemonade', 'Soda', 'Mango Drink', 'Coconut Water', 'Buttermilk Pack'],
    units: ['250 ml', '500 ml', '750 ml', '1 L', '2 L', '100 g', '200 g'],
    priceRange: [15, 400],
  },
  {
    category: 'Personal Care',
    subCategory: 'Hygiene',
    brands: ['Dove', 'Head & Shoulders', 'Colgate', 'Dettol', 'Himalaya', 'Patanjali', 'Nivea', 'Gillette', 'Ponds', 'Lakme'],
    items: ['Soap', 'Shampoo', 'Toothpaste', 'Hand Wash', 'Body Lotion', 'Face Wash', 'Deodorant', 'Razor', 'Cream', 'Talcum Powder', 'Hair Oil', 'Conditioner', 'Sanitizer', 'Wet Wipes', 'Face Cream'],
    units: ['75 g', '100 g', '125 g', '150 g', '200 ml', '340 ml', '1 unit'],
    priceRange: [35, 550],
  },
  {
    category: 'Home & Cleaning',
    subCategory: 'Household',
    brands: ['Surf Excel', 'Rin', 'Vim', 'Harpic', 'Lizol', 'Godrej', 'Colin', 'Odonil', 'Pril', 'Tide'],
    items: ['Detergent Powder', 'Dishwash Liquid', 'Floor Cleaner', 'Toilet Cleaner', 'Glass Cleaner', 'Air Freshener', 'Scrubber', 'Mop', 'Tissue Roll', 'Garbage Bags', 'Fabric Softener', 'Bleach', 'Phenyl'],
    units: ['500 ml', '1 L', '1 kg', '2 L', '1 pack', '5 pcs'],
    priceRange: [25, 600],
  },
  {
    category: 'Staples & Grains',
    subCategory: 'Grocery',
    brands: ['Fortune', 'Aashirvaad', 'Tata Sampann', 'India Gate', 'Kohinoor', 'Rajdhani', 'Daawat'],
    items: ['Basmati Rice', 'Wheat Flour', 'Toor Dal', 'Moong Dal', 'Chana Dal', 'Sugar', 'Salt', 'Mustard Oil', 'Sunflower Oil', 'Garam Masala', 'Turmeric', 'Red Chilli', 'Cumin', 'Coriander Powder', 'Poha'],
    units: ['500 g', '1 kg', '5 kg', '1 L', '100 g', '200 g'],
    priceRange: [30, 800],
  },
  {
    category: 'Baby Care',
    subCategory: 'Infant',
    brands: ['Pampers', 'Huggies', 'Johnson\'s', 'Mamaearth', 'Himalaya Baby', 'Nestle Cerelac'],
    items: ['Diapers', 'Baby Wipes', 'Baby Oil', 'Baby Powder', 'Baby Soap', 'Baby Shampoo', 'Cerelac', 'Feeding Bottle', 'Baby Cream', 'Rash Cream'],
    units: ['1 pack', '200 ml', '100 g', '400 g', '76 pcs'],
    priceRange: [50, 1200],
  },
];

let _cached: SupermarketProduct[] | null = null;

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function generateProductCatalog(count = 1500): SupermarketProduct[] {
  if (_cached && _cached.length >= count) return _cached.slice(0, count);

  const products: SupermarketProduct[] = [];
  let id = 1;

  while (products.length < count) {
    for (const cat of CATALOG) {
      if (products.length >= count) break;
      for (const item of cat.items) {
        if (products.length >= count) break;
        for (const brand of cat.brands) {
          if (products.length >= count) break;
          const variant = (id % 3) + 1;
          const price = Math.floor(
            Math.random() * (cat.priceRange[1] - cat.priceRange[0]) + cat.priceRange[0]
          );
          const mrp = price + Math.floor(price * (0.05 + (id % 10) * 0.02));
          products.push({
            productId: `SKU_${String(id).padStart(5, '0')}`,
            name: variant > 1 ? `${brand} ${item} (${variant === 2 ? 'Premium' : 'Family Pack'})` : `${brand} ${item}`,
            brand,
            description: `${brand} ${item} — quality assured, FSSAI certified.`,
            price,
            mrp,
            category: cat.category,
            subCategory: cat.subCategory,
            imageUrl: CATEGORY_IMAGES[cat.category],
            stock: 5 + (id % 95),
            unit: cat.units[id % cat.units.length],
            expiryDate: addDays(30 + (id % 300)),
            batchNo: `BN${new Date().getFullYear()}${String(id % 10000).padStart(4, '0')}`,
          });
          id++;
        }
      }
    }
  }

  _cached = products;
  return products;
}

export const SUPERMARKET_CATEGORIES = ['All', ...CATALOG.map((c) => c.category)];

export function getProductsByCategory(category?: string): SupermarketProduct[] {
  const all = generateProductCatalog();
  if (!category || category === 'All') return all;
  return all.filter((p) => p.category === category);
}
