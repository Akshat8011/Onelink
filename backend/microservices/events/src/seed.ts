import mongoose from 'mongoose';
import { Event } from './models/Event';
import { DiningPlace } from './models/DiningPlace';
import dotenv from 'dotenv';

dotenv.config();

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/onelink';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB Atlas');

    // Clear existing data
    await Event.deleteMany({});
    await DiningPlace.deleteMany({});

    // Seed Events (Real-world Lucknow style)
    const events = [
      {
        eventId: 'EVT_001',
        title: 'Arijit Singh Live in Concert',
        description: 'Experience the magic of Arijit Singh live at Ekana Stadium.',
        venue: 'Bharat Ratna Shri Atal Bihari Vajpayee Ekana Cricket Stadium',
        city: 'Lucknow',
        date: new Date(Date.now() + 86400000 * 5), // 5 days from now
        price: 1500,
        capacity: 25000,
        category: 'MUSIC',
        imageUrl: 'https://images.unsplash.com/photo-1540039155732-68ee14e12781?auto=format&fit=crop&q=80&w=800'
      },
      {
        eventId: 'EVT_002',
        title: 'UP Yoddhas vs Patna Pirates - PKL',
        description: 'Pro Kabaddi League action in Lucknow.',
        venue: 'BBD UP Badminton Academy',
        city: 'Lucknow',
        date: new Date(Date.now() + 86400000 * 2),
        price: 500,
        capacity: 5000,
        category: 'SPORTS',
        imageUrl: 'https://images.unsplash.com/photo-1552667466-07770ae110d0?auto=format&fit=crop&q=80&w=800'
      },
      {
        eventId: 'EVT_003',
        title: 'Zakir Khan: Tathastu',
        description: 'Zakir Khan brings his newest standup special to Lucknow.',
        venue: 'Sangeet Natak Akademi',
        city: 'Lucknow',
        date: new Date(Date.now() + 86400000 * 12),
        price: 999,
        capacity: 800,
        category: 'COMEDY',
        imageUrl: 'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?auto=format&fit=crop&q=80&w=800'
      }
    ];

    await Event.insertMany(events);
    console.log(`✅ Seeded ${events.length} Events`);

    // Seed Dining Places (Authentic Lucknow)
    const diningPlaces = [
      {
        restaurantId: 'DIN_001',
        name: 'Tunday Kababi',
        description: 'The legendary Galauti Kababs of Aminabad, Lucknow.',
        address: 'Aminabad, Lucknow',
        city: 'Lucknow',
        cuisine: ['Awadhi', 'Mughlai', 'North Indian'],
        rating: 4.8,
        costForTwo: 600,
        imageUrl: 'https://images.unsplash.com/photo-1599487405902-1bef759c26be?auto=format&fit=crop&q=80&w=800',
        menu: [
          { name: 'Galauti Kabab (Beef)', price: 160, description: 'Melt in mouth authentic kababs', isVeg: false },
          { name: 'Mutton Biryani', price: 220, description: 'Awadhi dum biryani', isVeg: false },
          { name: 'Mughlai Paratha', price: 40, description: 'Crispy paratha', isVeg: true }
        ]
      },
      {
        restaurantId: 'DIN_002',
        name: 'Dastarkhwan',
        description: 'Famous for its Mughlai delicacies and Chicken Masala.',
        address: 'Lalbagh, Lucknow',
        city: 'Lucknow',
        cuisine: ['Mughlai', 'North Indian'],
        rating: 4.6,
        costForTwo: 800,
        imageUrl: 'https://images.unsplash.com/photo-1544148103-0773bf10d330?auto=format&fit=crop&q=80&w=800',
        menu: [
          { name: 'Chicken Masala', price: 320, description: 'Signature chicken dish', isVeg: false },
          { name: 'Mutton Boti Kabab', price: 280, description: 'Tender boti kababs', isVeg: false },
          { name: 'Roomali Roti', price: 20, description: 'Soft thin bread', isVeg: true }
        ]
      },
      {
        restaurantId: 'DIN_003',
        name: 'Royal Sky',
        description: 'Fine dining with a great view in Hazratganj.',
        address: 'Hazratganj, Lucknow',
        city: 'Lucknow',
        cuisine: ['Continental', 'Italian', 'North Indian'],
        rating: 4.5,
        costForTwo: 1200,
        imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=800',
        menu: [
          { name: 'Arrabbiata Pasta', price: 350, description: 'Spicy red sauce pasta', isVeg: true },
          { name: 'Paneer Tikka', price: 290, description: 'Grilled cottage cheese', isVeg: true },
          { name: 'Virgin Mojito', price: 180, description: 'Refreshing mocktail', isVeg: true }
        ]
      }
    ];

    await DiningPlace.insertMany(diningPlaces);
    console.log(`✅ Seeded ${diningPlaces.length} Dining Places`);

    console.log('🌱 Seeding Completed Successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedData();
