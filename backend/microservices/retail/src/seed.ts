import mongoose from 'mongoose';
import { Product } from './models/Product';
import dotenv from 'dotenv';

dotenv.config();

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/onelink';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB Atlas');

    await Product.deleteMany({});

    const products = [];
    let counter = 1;

    const categories = [
      { name: 'Fruits & Veggies', items: ['Apple', 'Banana', 'Onion', 'Tomato', 'Potato', 'Mango', 'Orange', 'Carrot', 'Broccoli', 'Spinach'], priceRange: [40, 150], unit: '1 kg' },
      { name: 'Dairy & Breakfast', items: ['Milk', 'Bread', 'Eggs', 'Butter', 'Cheese', 'Yogurt', 'Oats', 'Cornflakes', 'Paneer', 'Curd'], priceRange: [30, 250], unit: '1 pack' },
      { name: 'Snacks & Munchies', items: ['Chips', 'Nachos', 'Popcorn', 'Biscuits', 'Cookies', 'Bhujia', 'Mixture', 'Chocolates', 'Wafers', 'Peanuts'], priceRange: [10, 150], unit: '1 pack' },
      { name: 'Beverages', items: ['Cola', 'Orange Juice', 'Water Bottle', 'Energy Drink', 'Cold Coffee', 'Soda', 'Lemonade', 'Green Tea', 'Coffee Powder', 'Tea Leaves'], priceRange: [20, 300], unit: '1 unit' },
      { name: 'Personal Care', items: ['Soap', 'Shampoo', 'Toothpaste', 'Deodorant', 'Face Wash', 'Body Lotion', 'Hair Oil', 'Conditioner', 'Hand Wash', 'Sanitizer'], priceRange: [50, 400], unit: '1 unit' }
    ];

    const imageMap: Record<string, string> = {
      'Fruits & Veggies': 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&q=80&w=400',
      'Dairy & Breakfast': 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&q=80&w=400',
      'Snacks & Munchies': 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?auto=format&fit=crop&q=80&w=400',
      'Beverages': 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=400',
      'Personal Care': 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&q=80&w=400'
    };

    const adjectives = ['Fresh', 'Organic', 'Premium', 'Classic', 'Spicy', 'Sweet', 'Healthy', 'Delicious', 'Natural', 'Tasty'];
    const brands = ['FarmFresh', 'Amul', 'Britannia', 'Nestle', 'Parle', 'Haldirams', 'Tata', 'Himalaya', 'Dove', 'Tropicana'];

    // Generate 1000 items
    while (products.length < 1000) {
      const cat = categories[Math.floor(Math.random() * categories.length)];
      const itemBase = cat.items[Math.floor(Math.random() * cat.items.length)];
      const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
      const brand = brands[Math.floor(Math.random() * brands.length)];
      
      const price = Math.floor(Math.random() * (cat.priceRange[1] - cat.priceRange[0]) + cat.priceRange[0]);
      
      products.push({
        productId: `PRD_${counter.toString().padStart(4, '0')}`,
        name: `${adj} ${itemBase} by ${brand}`,
        description: `High quality ${itemBase.toLowerCase()} from ${brand}.`,
        price: price,
        category: cat.name,
        subCategory: itemBase,
        imageUrl: imageMap[cat.name],
        stock: Math.floor(Math.random() * 200) + 10,
        unit: cat.unit
      });
      counter++;
    }

    // Insert in batches of 200 to avoid memory issues
    for (let i = 0; i < products.length; i += 200) {
      await Product.insertMany(products.slice(i, i + 200));
    }
    
    console.log(`✅ Seeded ${products.length} Products algorithmically`);

    console.log('🌱 Seeding Completed Successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedData();
