import mongoose from 'mongoose';
import { Wallet } from './models/Wallet';
import { Card } from './models/Card';
import { BankAccount } from './models/BankAccount';
import { Transaction } from './models/Transaction';
import dotenv from 'dotenv';

dotenv.config();

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/onelink';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB Atlas');

    // Clear existing data
    await Wallet.deleteMany({});
    await Card.deleteMany({});
    await BankAccount.deleteMany({});
    await Transaction.deleteMany({});

    const USER_ID = 'mock-user-123';

    // 1. Create Wallet
    await Wallet.create({
      userId: USER_ID,
      balance: 15450,
      currency: 'INR'
    });

    // 2. Create Bank Accounts
    await BankAccount.insertMany([
      { accountId: 'ACC_001', userId: USER_ID, bankName: 'HDFC Bank', accountType: 'SAVINGS', accountNumberLast4: '4567', ifscCode: 'HDFC0001234', balance: 245000 },
      { accountId: 'ACC_002', userId: USER_ID, bankName: 'State Bank of India', accountType: 'SAVINGS', accountNumberLast4: '8901', ifscCode: 'SBIN0005678', balance: 85000 },
      { accountId: 'ACC_003', userId: USER_ID, bankName: 'ICICI Bank', accountType: 'CURRENT', accountNumberLast4: '2345', ifscCode: 'ICIC0009012', balance: 1200000 },
      { accountId: 'ACC_004', userId: USER_ID, bankName: 'Punjab National Bank', accountType: 'SAVINGS', accountNumberLast4: '6789', ifscCode: 'PUNB0003456', balance: 45000 }
    ]);

    // 3. Create Cards (CRED style rendering needs cool colors)
    await Card.insertMany([
      {
        cardId: 'CRD_001', userId: USER_ID, bankName: 'HDFC Regalia', cardType: 'CREDIT', network: 'VISA',
        cardNumberLast4: '1234', expiryMonth: 12, expiryYear: 28, cvv: '123', cardholderName: 'John Doe',
        colorHex: '#1A1A24', isBlocked: false, internationalPayments: true, onlineTransactions: true, dailyLimit: 200000
      },
      {
        cardId: 'CRD_002', userId: USER_ID, bankName: 'SBI SimplyCLICK', cardType: 'CREDIT', network: 'VISA',
        cardNumberLast4: '5678', expiryMonth: 5, expiryYear: 27, cvv: '456', cardholderName: 'John Doe',
        colorHex: '#10529A', isBlocked: false, internationalPayments: false, onlineTransactions: true, dailyLimit: 100000
      },
      {
        cardId: 'CRD_003', userId: USER_ID, bankName: 'ICICI Coral', cardType: 'DEBIT', network: 'MASTERCARD',
        cardNumberLast4: '9012', expiryMonth: 8, expiryYear: 29, cvv: '789', cardholderName: 'John Doe',
        colorHex: '#A22829', isBlocked: true, internationalPayments: false, onlineTransactions: false, dailyLimit: 50000
      },
      {
        cardId: 'CRD_004', userId: USER_ID, bankName: 'PNB Platinum', cardType: 'DEBIT', network: 'RUPAY',
        cardNumberLast4: '3456', expiryMonth: 3, expiryYear: 30, cvv: '012', cardholderName: 'John Doe',
        colorHex: '#E29A21', isBlocked: false, internationalPayments: false, onlineTransactions: true, dailyLimit: 25000
      }
    ]);

    // 4. Create Transactions (Mix of categories)
    await Transaction.insertMany([
      { transactionId: 'TXN_001', userId: USER_ID, type: 'DEBIT', amount: 850, category: 'RETAIL', description: 'Blinkit Grocery', date: new Date(Date.now() - 86400000 * 1) },
      { transactionId: 'TXN_002', userId: USER_ID, type: 'DEBIT', amount: 45, category: 'TRANSIT', description: 'Lucknow Metro (Charbagh to Munshipulia)', date: new Date(Date.now() - 86400000 * 2) },
      { transactionId: 'TXN_003', userId: USER_ID, type: 'DEBIT', amount: 350, category: 'MOBILITY', description: 'EV Charging Station', date: new Date(Date.now() - 86400000 * 3) },
      { transactionId: 'TXN_004', userId: USER_ID, type: 'CREDIT', amount: 5000, category: 'ADD_FUNDS', description: 'Topup from HDFC Bank', date: new Date(Date.now() - 86400000 * 4) },
      { transactionId: 'TXN_005', userId: USER_ID, type: 'DEBIT', amount: 1500, category: 'CITY', description: 'Arijit Singh Concert Ticket', date: new Date(Date.now() - 86400000 * 5) },
      { transactionId: 'TXN_006', userId: USER_ID, type: 'DEBIT', amount: 800, category: 'CITY', description: 'Dastarkhwan Dinner', date: new Date(Date.now() - 86400000 * 6) }
    ]);

    console.log('✅ Seeded Wallet, Bank Accounts, Cards, and Transactions successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedData();
