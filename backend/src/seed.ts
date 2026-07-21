/**
 * OneLink Database Seed Script
 * Migrates all user data, shopping items, events, and bills
 * from the original Tkinter prototype into MongoDB.
 *
 * Run: npm run seed
 */

import { connectDatabase, disconnectDatabase } from './config/database.js';
import { User } from './models/User.js';
import { Transaction } from './models/Transaction.js';
import { ParkingSpot } from './models/ParkingSpot.js';
import { MetroJourney } from './models/MetroJourney.js';
import { Event } from './models/Event.js';
import { ShoppingItem, Bill } from './models/ShoppingItem.js';
import { logger } from './utils/logger.js';
import bcrypt from 'bcryptjs';

async function seed(): Promise<void> {
  await connectDatabase();
  logger.info('🌱 Starting database seed...');

  // ─────────────────────────────────────
  // CLEAR EXISTING DATA
  // ─────────────────────────────────────
  await User.deleteMany({});
  await Transaction.deleteMany({});
  await ParkingSpot.deleteMany({});
  await MetroJourney.deleteMany({});
  await Event.deleteMany({});
  await ShoppingItem.deleteMany({});
  await Bill.deleteMany({});
  logger.info('🗑️ Cleared existing data');

  // ─────────────────────────────────────
  // USERS (from old self.users dict)
  // ─────────────────────────────────────
  const akshatPassword = await bcrypt.hash('ratni@0602', 10);
  const defaultPassword = await bcrypt.hash('onelink123', 10);
  const defaultCvv = await bcrypt.hash('123', 10);

  const users = [
    {
      userId: 'usr_akshat_001', username: 'Akshat Choudhary', cardUid: 'A97432', name: 'Akshat Choudhary',
      email: 'akshat.choudhary@onelink.in', phone: '+91-9876543210', avatar: '',
      password: akshatPassword, isCardPaired: true, pairingToken: null,
      balance: 15250, loyaltyPoints: 550, transactionCount: 4,
      banks: [
        { bankName: 'SBI', accountNumber: 'xx3456', balance: 45000, ifsc: 'SBIN0001234', isPrimary: true },
        { bankName: 'HDFC', accountNumber: 'xx9812', balance: 120000, ifsc: 'HDFC0005678', isPrimary: false },
      ],
      bills: [
        { name: 'Electricity Bill', amount: 1450, dueDate: '2025-08-25', provider: 'UPPCL' },
        { name: 'Water Bill', amount: 580, dueDate: '2025-08-28', provider: 'JAL NIGAM' },
        { name: 'Gas Bill', amount: 890, dueDate: '2025-09-05', provider: 'GAIL' },
        { name: 'WiFi Bill', amount: 999, dueDate: '2025-08-20', provider: 'JioFiber' },
      ],
    },
    {
      userId: 'usr_bharat_002', username: 'Bharat', cardUid: '274932', name: 'Bharat',
      email: 'bharat@onelink.in', phone: '+91-9876543211', avatar: '',
      password: defaultPassword, isCardPaired: true, pairingToken: null,
      balance: 8750, loyaltyPoints: 320, transactionCount: 3,
      banks: [
        { bankName: 'PNB', accountNumber: 'xx7890', balance: 32000, ifsc: 'PUNB0001234', isPrimary: true },
        { bankName: 'ICICI', accountNumber: 'xx4567', balance: 87000, ifsc: 'ICIC0005678', isPrimary: false },
      ],
      bills: [
        { name: 'Electricity Bill', amount: 1200, dueDate: '2025-08-22', provider: 'UPPCL' },
        { name: 'Mobile Recharge', amount: 599, dueDate: '2025-08-15', provider: 'Airtel' },
        { name: 'Insurance Premium', amount: 3500, dueDate: '2025-09-01', provider: 'LIC' },
      ],
    },
    {
      userId: 'usr_nitya_003', username: 'Nitya', cardUid: 'B32914', name: 'Nitya',
      email: 'nitya@onelink.in', phone: '+91-9876543212', avatar: '',
      password: defaultPassword, isCardPaired: true, pairingToken: null,
      balance: 22100, loyaltyPoints: 780, transactionCount: 5,
      banks: [
        { bankName: 'BOB', accountNumber: 'xx2345', balance: 56000, ifsc: 'BARB0001234', isPrimary: true },
        { bankName: 'Axis', accountNumber: 'xx8901', balance: 95000, ifsc: 'UTIB0005678', isPrimary: false },
      ],
      bills: [
        { name: 'Electricity Bill', amount: 1800, dueDate: '2025-08-26', provider: 'UPPCL' },
        { name: 'Internet Bill', amount: 1499, dueDate: '2025-08-18', provider: 'Airtel Xstream' },
        { name: 'DTH Recharge', amount: 450, dueDate: '2025-08-30', provider: 'Tata Play' },
      ],
    },
    {
      userId: 'usr_arin_004', username: 'Arin', cardUid: 'D48271', name: 'Arin',
      email: 'arin@onelink.in', phone: '+91-9876543213', avatar: '',
      password: defaultPassword, isCardPaired: true, pairingToken: null,
      balance: 5400, loyaltyPoints: 150, transactionCount: 2,
      banks: [
        { bankName: 'Kotak', accountNumber: 'xx6789', balance: 28000, ifsc: 'KKBK0001234', isPrimary: true },
      ],
      bills: [
        { name: 'Electricity Bill', amount: 950, dueDate: '2025-08-24', provider: 'UPPCL' },
        { name: 'Water Bill', amount: 380, dueDate: '2025-09-02', provider: 'JAL NIGAM' },
      ],
    },
  ];

  for (const u of users) {
    await User.create({
      userId: u.userId,
      username: u.username,
      cardUid: u.cardUid,
      name: u.name,
      email: u.email,
      phone: u.phone,
      passwordHash: u.password,
      avatar: u.avatar,
      pairingToken: u.pairingToken,
      pairingTokenExpiresAt: null,
      isCardPaired: u.isCardPaired,
      wallet: { balance: u.balance, currency: 'INR', dailyLimit: 50000, contactlessLimit: 2000, lastTopUp: null },
      card: {
        cardNumber: `****-****-****-${Math.floor(1000 + Math.random() * 9000)}`,
        cardType: 'NFC Smart Card',
        expiry: '12/28',
        isBlocked: false, domesticUsage: true, internationalUsage: false,
        dailyLimit: 50000, contactlessLimit: 2000,
        cvvHash: defaultCvv,
      },
      linkedBanks: u.banks,
      loyaltyPoints: u.loyaltyPoints,
      transactionCount: u.transactionCount,
      memberTier: u.loyaltyPoints >= 500 ? 'GOLD' : u.loyaltyPoints >= 200 ? 'SILVER' : 'BRONZE',
      language: 'EN', theme: 'DARK', notificationsEnabled: true,
    });

    // Create bills for this user
    for (const bill of u.bills) {
      await Bill.create({
        billId: `bill_${u.userId}_${bill.name.toLowerCase().replace(/\s+/g, '_')}`,
        userId: u.userId,
        name: bill.name,
        amount: bill.amount,
        dueDate: new Date(bill.dueDate),
        provider: bill.provider,
        category: 'UTILITY',
        isPaid: false,
      });
    }

    logger.info(`👤 Created user: ${u.name} (${u.cardUid}) — ₹${u.balance}`);
  }

  // ─────────────────────────────────────
  // PARKING SPOTS (A1-B3)
  // ─────────────────────────────────────
  const spots = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'];
  for (const spotId of spots) {
    await ParkingSpot.create({
      spotId,
      zone: spotId[0],
      spotNumber: parseInt(spotId[1]),
      status: 'FREE',
      ratePerMinute: 50,
      ledColor: 'GREEN',
      barrierState: 'CLOSED',
    });
  }
  logger.info('🅿️ Created 6 parking spots: A1-B3');

  // ─────────────────────────────────────
  // SHOPPING ITEMS (from old self.items)
  // ─────────────────────────────────────
  const items = [
    // Dairy
    { name: 'Fresh Milk', price: 65, category: 'Dairy', emoji: '🥛', popularity: 'HOT' },
    { name: 'Paneer (Cottage Cheese)', price: 120, category: 'Dairy', emoji: '🧀', popularity: 'POPULAR' },
    { name: 'Curd/Yogurt', price: 45, category: 'Dairy', emoji: '🥣', popularity: 'TRENDING' },
    // Bakery
    { name: 'Fresh Bread', price: 45, category: 'Bakery', emoji: '🍞', popularity: 'HOT' },
    { name: 'Butter Croissant', price: 60, category: 'Bakery', emoji: '🥐', popularity: 'TRENDING' },
    { name: 'Chocolate Cake', price: 450, category: 'Bakery', emoji: '🎂', popularity: 'POPULAR' },
    // Beverages
    { name: 'Coffee Beans', price: 350, category: 'Beverages', emoji: '☕', popularity: 'HOT' },
    { name: 'Green Tea Pack', price: 180, category: 'Beverages', emoji: '🍵', popularity: 'TRENDING' },
    { name: 'Fresh Orange Juice', price: 120, category: 'Beverages', emoji: '🍊', popularity: 'NEW' },
    // Grains
    { name: 'Basmati Rice (5kg)', price: 450, category: 'Grains', emoji: '🍚', popularity: 'HOT' },
    { name: 'Whole Wheat Flour', price: 280, category: 'Grains', emoji: '🌾', popularity: 'POPULAR' },
    { name: 'Organic Oats', price: 220, category: 'Grains', emoji: '🥣', popularity: 'TRENDING' },
    // Protein
    { name: 'Farm Eggs (12)', price: 96, category: 'Protein', emoji: '🥚', popularity: 'HOT' },
    { name: 'Chicken Breast', price: 320, category: 'Protein', emoji: '🍗', popularity: 'POPULAR' },
    { name: 'Fresh Fish', price: 450, category: 'Seafood', emoji: '🐟', popularity: 'TRENDING' },
    // Fruits & Vegetables
    { name: 'Mango (Alphonso)', price: 250, category: 'Fruits', emoji: '🥭', popularity: 'HOT' },
    { name: 'Banana Bunch', price: 50, category: 'Fruits', emoji: '🍌', popularity: 'POPULAR' },
    { name: 'Fresh Spinach', price: 40, category: 'Vegetables', emoji: '🥬', popularity: 'NEW' },
    { name: 'Tomatoes (1kg)', price: 60, category: 'Vegetables', emoji: '🍅', popularity: 'POPULAR' },
    { name: 'Onions (1kg)', price: 45, category: 'Vegetables', emoji: '🧅', popularity: 'HOT' },
    // Snacks
    { name: 'Mixed Dry Fruits', price: 580, category: 'Snacks', emoji: '🥜', popularity: 'TRENDING' },
    { name: 'Dark Chocolate', price: 180, category: 'Snacks', emoji: '🍫', popularity: 'HOT' },
    { name: 'Potato Chips', price: 50, category: 'Snacks', emoji: '🥔', popularity: 'POPULAR' },
    // Household
    { name: 'Olive Oil (1L)', price: 650, category: 'Household', emoji: '🫒', popularity: 'TRENDING' },
    { name: 'Honey (500g)', price: 350, category: 'Household', emoji: '🍯', popularity: 'POPULAR' },
    { name: 'Ghee (1L)', price: 550, category: 'Household', emoji: '🧈', popularity: 'HOT' },
    { name: 'Spice Box Set', price: 420, category: 'Kitchen', emoji: '🌶️', popularity: 'NEW' },
  ];

  for (const item of items) {
    await ShoppingItem.create({
      itemId: `item_${item.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      ...item,
      currency: 'INR',
      inStock: true,
      stockQuantity: 100 + Math.floor(Math.random() * 100),
      merchantId: 'SMART_HUB_MART',
    });
  }
  logger.info(`🛒 Created ${items.length} shopping items`);

  // ─────────────────────────────────────
  // EVENTS (from old self.events)
  // ─────────────────────────────────────
  const events = [
    { name: 'IPL Cricket Match', category: 'Sports', venue: 'Ekana Stadium', price: 800, emoji: '🏏', tickets: 100, available: 5, popularity: 'HOT' },
    { name: 'Lucknow Marathon', category: 'Sports', venue: 'Ambedkar Park', price: 500, emoji: '🏃', tickets: 200, available: 45, popularity: 'TRENDING' },
    { name: 'AR Rahman Live Concert', category: 'Music', venue: 'Phoenix Palassio', price: 2500, emoji: '🎵', tickets: 50, available: 8, popularity: 'HOT' },
    { name: 'Classical Music Evening', category: 'Music', venue: 'Bhatkande University', price: 300, emoji: '🎶', tickets: 150, available: 80, popularity: 'POPULAR' },
    { name: 'Lucknow Literature Festival', category: 'Cultural', venue: 'La Martiniere', price: 200, emoji: '📚', tickets: 300, available: 120, popularity: 'POPULAR' },
    { name: 'Nawabi Food Festival', category: 'Food', venue: 'Aminabad Market', price: 150, emoji: '🍗', tickets: 500, available: 200, popularity: 'HOT' },
    { name: 'Art & Craft Exhibition', category: 'Art', venue: 'State Museum', price: 100, emoji: '🎨', tickets: 250, available: 180, popularity: 'NEW' },
    { name: 'Tech Innovation Summit', category: 'Technology', venue: 'IIM Lucknow', price: 1500, emoji: '💡', tickets: 80, available: 15, popularity: 'TRENDING' },
    { name: 'Yoga & Wellness Camp', category: 'Health', venue: 'Gomti Riverfront', price: 250, emoji: '🧘', tickets: 100, available: 60, popularity: 'POPULAR' },
    { name: 'Film Screening Festival', category: 'Entertainment', venue: 'Wave Cinema', price: 350, emoji: '🎬', tickets: 120, available: 40, popularity: 'NEW' },
    { name: 'Startup Pitch Competition', category: 'Technology', venue: 'SGPGI Auditorium', price: 400, emoji: '🚀', tickets: 60, available: 25, popularity: 'TRENDING' },
    { name: 'Heritage Walk Tour', category: 'Cultural', venue: 'Bara Imambara', price: 180, emoji: '🏛️', tickets: 40, available: 30, popularity: 'POPULAR' },
  ];

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const eventDate = new Date();
    eventDate.setDate(eventDate.getDate() + (i + 1) * 3); // Stagger events
    await Event.create({
      eventId: `evt_${ev.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      name: ev.name,
      date: eventDate,
      venue: ev.venue,
      city: 'Lucknow',
      category: ev.category,
      type: ev.category.toLowerCase(),
      pricing: { basePrice: ev.price, currency: 'INR' },
      tickets: { total: ev.tickets, available: ev.available, sold: ev.tickets - ev.available },
      popularity: ev.popularity,
      emoji: ev.emoji,
      isActive: true,
    });
  }
  logger.info(`🎭 Created ${events.length} events`);

  // ─────────────────────────────────────
  logger.info('');
  logger.info('═══════════════════════════════════════════');
  logger.info('  ✅ Database seeded successfully!');
  logger.info(`  👤 Users:     ${users.length}`);
  logger.info(`  🅿️ Spots:     ${spots.length}`);
  logger.info(`  🛒 Items:     ${items.length}`);
  logger.info(`  🎭 Events:    ${events.length}`);
  logger.info(`  📄 Bills:     ${users.reduce((s, u) => s + u.bills.length, 0)}`);
  logger.info('═══════════════════════════════════════════');

  await disconnectDatabase();
  process.exit(0);
}

seed().catch((err) => {
  logger.error('Seed failed:', err);
  process.exit(1);
});
