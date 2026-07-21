import type { ParkingSpot } from '../types';

export const DEMO_USER = {
  userId: 'demo-user-001',
  cardUid: 'OLNK-8842',
  name: 'Akshat Choudhary',
  username: 'Akshat Choudhary',
  email: 'akshat.choudhary@onelink.in',
  phone: '+91 98765 43210',
  avatar: '',
  loyaltyPoints: 1250,
  memberTier: 'GOLD' as const,
};

// Complete UPMRC Red Line (North-South Corridor) - all 21 stations, CCS Airport → Munshipulia
export const LUCKNOW_METRO_STATIONS = [
  'CCS Airport',
  'Amausi',
  'Transport Nagar',
  'Krishna Nagar',
  'Singar Nagar',
  'Alambagh',
  'Alambagh Bus Station',
  'Mawaiya',
  'Durgapuri',
  'Charbagh',
  'Husain Ganj',
  'Sachivalaya',
  'Hazratganj',
  'KD Singh Stadium',
  'Vishwavidyalaya',
  'IT Chauraha',
  'Badshah Nagar',
  'Lekhraj Market',
  'Bhootnath Market',
  'Indira Nagar',
  'Munshipulia'
];

export const CITY_BUS_ROUTES = [
  { routeNo: '11', name: 'Charbagh to Munshipulia', stops: ['Charbagh', 'Hazratganj', 'Gomti Nagar', 'Munshipulia'] },
  { routeNo: '33', name: 'Alambagh to Kamta', stops: ['Alambagh Bus Stand', 'Charbagh', 'Polytechnic', 'Kamta'] },
];

export const MOCK_WALLET = {
  balance: 15450,
  cards: [
    {
      cardId: 'CRD_001', bankName: 'HDFC Regalia', cardType: 'CREDIT', network: 'VISA',
      cardNumberLast4: '1234', expiryMonth: 12, expiryYear: 28, cvv: '123', cardholderName: 'Akshat Sharma',
      colorHex: '#152238', isBlocked: false, internationalPayments: true, onlineTransactions: true,
      contactlessPayments: true, atmWithdrawals: true, posTransactions: true, tapToPay: true,
      smsAlerts: true, autoPayEnabled: false, rewardRedemption: true, dailyLimit: 200000,
    },
    {
      cardId: 'CRD_002', bankName: 'SBI SimplyCLICK', cardType: 'CREDIT', network: 'VISA',
      cardNumberLast4: '5678', expiryMonth: 5, expiryYear: 27, cvv: '456', cardholderName: 'Akshat Sharma',
      colorHex: '#1E3A5F', isBlocked: false, internationalPayments: false, onlineTransactions: true,
      contactlessPayments: true, atmWithdrawals: true, posTransactions: true, tapToPay: true,
      smsAlerts: true, autoPayEnabled: true, rewardRedemption: true, dailyLimit: 100000,
    },
    {
      cardId: 'CRD_003', bankName: 'ICICI Coral', cardType: 'DEBIT', network: 'MASTERCARD',
      cardNumberLast4: '9012', expiryMonth: 8, expiryYear: 29, cvv: '789', cardholderName: 'Akshat Sharma',
      colorHex: '#4A2828', isBlocked: true, internationalPayments: false, onlineTransactions: false,
      contactlessPayments: false, atmWithdrawals: false, posTransactions: false, tapToPay: false,
      smsAlerts: true, autoPayEnabled: false, rewardRedemption: false, dailyLimit: 50000,
    },
    {
      cardId: 'CRD_004', bankName: 'PNB Platinum', cardType: 'DEBIT', network: 'RUPAY',
      cardNumberLast4: '3456', expiryMonth: 3, expiryYear: 30, cvv: '012', cardholderName: 'Akshat Sharma',
      colorHex: '#2C3A4A', isBlocked: false, internationalPayments: false, onlineTransactions: true,
      contactlessPayments: true, atmWithdrawals: true, posTransactions: true, tapToPay: false,
      smsAlerts: false, autoPayEnabled: false, rewardRedemption: true, dailyLimit: 25000,
    },
  ],
  banks: [
    { accountId: 'ACC_001', bankName: 'HDFC Bank', accountType: 'SAVINGS', accountNumberLast4: '4567', balance: 245000 },
    { accountId: 'ACC_002', bankName: 'State Bank of India', accountType: 'SAVINGS', accountNumberLast4: '8901', balance: 85000 },
    { accountId: 'ACC_003', bankName: 'ICICI Bank', accountType: 'CURRENT', accountNumberLast4: '2345', balance: 1200000 },
  ],
  transactions: [
    { transactionId: 'TXN_001', type: 'DEBIT', amount: 850, category: 'SHOPPING', description: 'Blinkit Grocery', date: new Date(Date.now() - 86400000).toISOString() },
    { transactionId: 'TXN_002', type: 'DEBIT', amount: 45, category: 'METRO', description: 'Lucknow Metro (Charbagh → Munshipulia)', date: new Date(Date.now() - 86400000 * 2).toISOString() },
    { transactionId: 'TXN_003', type: 'DEBIT', amount: 350, category: 'PARKING', description: 'EV Charging Station', date: new Date(Date.now() - 86400000 * 3).toISOString() },
    { transactionId: 'TXN_004', type: 'CREDIT', amount: 5000, category: 'TOP_UP', description: 'Top-up from HDFC Bank', date: new Date(Date.now() - 86400000 * 4).toISOString() },
    { transactionId: 'TXN_005', type: 'DEBIT', amount: 1500, category: 'EVENT', description: 'Arijit Singh Concert Ticket', date: new Date(Date.now() - 86400000 * 5).toISOString() },
    { transactionId: 'TXN_006', type: 'DEBIT', amount: 800, category: 'EVENT', description: 'Dastarkhwan Dinner', date: new Date(Date.now() - 86400000 * 6).toISOString() },
  ],
  analytics: [
    { _id: 'SHOPPING', total: 3200 },
    { _id: 'TRANSIT', total: 890 },
    { _id: 'MOBILITY', total: 1450 },
    { _id: 'CITY', total: 4200 },
    { _id: 'ADD_FUNDS', total: 10000 },
  ],
};

export const MOCK_PARKING_SPOTS: ParkingSpot[] = [
  ...['A', 'B', 'C', 'D', 'E'].flatMap((zone) =>
    [1, 2, 3, 4].map((n) => {
      const spotId = `${zone}${n}`;
      let status: ParkingSpot['status'] = 'FREE';
      let occupantName: string | null = null;
      let occupiedBy: string | null = null;
      let entryTime: string | null = null;
      let reservedUntil: string | null = null;
      let ledColor: ParkingSpot['ledColor'] = 'GREEN';

      if (spotId === 'A2') {
        status = 'OCCUPIED'; occupantName = 'Rahul S.'; occupiedBy = 'demo_parker_1';
        entryTime = new Date(Date.now() - 45 * 60000).toISOString(); ledColor = 'RED';
      } else if (spotId === 'A3') {
        status = 'RESERVED'; occupantName = 'Priya M.'; occupiedBy = 'demo_parker_2';
        reservedUntil = new Date(Date.now() + 90 * 60000).toISOString(); ledColor = 'YELLOW';
      } else if (spotId === 'B1') {
        status = 'OCCUPIED'; occupantName = 'Amit K.'; occupiedBy = 'demo_parker_3';
        entryTime = new Date(Date.now() - 120 * 60000).toISOString(); ledColor = 'RED';
      } else if (spotId === 'B4') {
        status = 'RESERVED'; occupantName = 'Sneha R.'; occupiedBy = 'demo_parker_4';
        reservedUntil = new Date(Date.now() + 60 * 60000).toISOString(); ledColor = 'YELLOW';
      } else if (spotId === 'C2') {
        status = 'OCCUPIED'; occupantName = 'Vikram P.'; occupiedBy = 'demo_parker_5';
        entryTime = new Date(Date.now() - 30 * 60000).toISOString(); ledColor = 'RED';
      } else if (spotId === 'D3') {
        status = 'RESERVED'; occupantName = 'Ananya D.'; occupiedBy = 'demo_parker_6';
        reservedUntil = new Date(Date.now() + 45 * 60000).toISOString(); ledColor = 'YELLOW';
      }

      return {
        spotId,
        zone,
        spotNumber: n,
        status,
        occupiedBy,
        occupantName,
        entryTime,
        reservedUntil,
        ratePerMinute: zone === 'A' || zone === 'B' ? 5 : 4,
        ledColor,
      };
    }),
  ),
];

export const MOCK_EV_STATIONS = [
  {
    stationId: 'EV_LKO_1',
    type: 'EV_CHARGING',
    location: { address: 'Hazratganj EV Point, Lucknow' },
    connectors: [
      { connectorId: 'C1', type: 'CCS2', powerKw: 60, status: 'AVAILABLE' },
      { connectorId: 'C2', type: 'Type2', powerKw: 22, status: 'AVAILABLE' },
    ],
    parkingStatus: 'AVAILABLE',
    ratePerMinute: 25,
  },
  {
    stationId: 'EV_LKO_2',
    type: 'EV_CHARGING',
    location: { address: 'Gomti Nagar Charging Hub' },
    connectors: [
      { connectorId: 'C1', type: 'Type2', powerKw: 22, status: 'OCCUPIED' },
    ],
    parkingStatus: 'OCCUPIED',
    ratePerMinute: 15,
  },
  {
    stationId: 'EV_LKO_3',
    type: 'EV_CHARGING',
    location: { address: 'Alambagh Smart Station' },
    connectors: [
      { connectorId: 'C1', type: 'CCS2', powerKw: 50, status: 'AVAILABLE' },
      { connectorId: 'C2', type: 'CHAdeMO', powerKw: 40, status: 'AVAILABLE' },
    ],
    parkingStatus: 'AVAILABLE',
    ratePerMinute: 20,
  },
];

export const MOCK_EVENTS = [
  {
    eventId: 'EVT_001',
    title: 'Arijit Singh Live in Concert',
    description: 'Experience the magic of Arijit Singh live at Ekana Stadium.',
    venue: 'Bharat Ratna Shri Atal Bihari Vajpayee Ekana Cricket Stadium',
    city: 'Lucknow',
    date: new Date(Date.now() + 86400000 * 5).toISOString(),
    price: 1500,
    capacity: 25000,
    ticketsSold: 18200,
    category: 'MUSIC',
    imageUrl: 'https://images.unsplash.com/photo-1540039155732-68ee14e12781?auto=format&fit=crop&q=80&w=800',
  },
  {
    eventId: 'EVT_002',
    title: 'UP Yoddhas vs Patna Pirates',
    description: 'Pro Kabaddi League action in Lucknow.',
    venue: 'BBD UP Badminton Academy',
    city: 'Lucknow',
    date: new Date(Date.now() + 86400000 * 2).toISOString(),
    price: 500,
    capacity: 5000,
    ticketsSold: 3200,
    category: 'SPORTS',
    imageUrl: 'https://images.unsplash.com/photo-1552667466-07770ae110d0?auto=format&fit=crop&q=80&w=800',
  },
  {
    eventId: 'EVT_003',
    title: 'Zakir Khan: Tathastu',
    description: 'Zakir Khan brings his newest standup special to Lucknow.',
    venue: 'Sangeet Natak Akademi',
    city: 'Lucknow',
    date: new Date(Date.now() + 86400000 * 12).toISOString(),
    price: 999,
    capacity: 800,
    ticketsSold: 650,
    category: 'COMEDY',
    imageUrl: 'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?auto=format&fit=crop&q=80&w=800',
  },
  {
    eventId: 'EVT_004',
    title: 'Pushpa 2: The Rule',
    description: 'Blockbuster movie premiere at INOX Gomti Nagar.',
    venue: 'INOX Gomti Nagar',
    city: 'Lucknow',
    date: new Date(Date.now() + 86400000 * 1).toISOString(),
    price: 350,
    capacity: 300,
    ticketsSold: 180,
    category: 'MOVIE',
    imageUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&q=80&w=800',
  },
  {
    eventId: 'EVT_005',
    title: 'Masaan — Repertory Screening',
    description: 'Classic Indian cinema at a heritage venue.',
    venue: 'Sangeet Natak Akademi',
    city: 'Lucknow',
    date: new Date(Date.now() + 86400000 * 8).toISOString(),
    price: 200,
    capacity: 200,
    ticketsSold: 95,
    category: 'MOVIE',
    imageUrl: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&q=80&w=800',
  },
];

export const MOCK_DINING = [
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
      { name: 'Galauti Kabab', price: 160, description: 'Melt-in-mouth authentic kababs', isVeg: false },
      { name: 'Mutton Biryani', price: 220, description: 'Awadhi dum biryani', isVeg: false },
      { name: 'Mughlai Paratha', price: 40, description: 'Crispy paratha', isVeg: true },
    ],
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
      { name: 'Roomali Roti', price: 20, description: 'Soft thin bread', isVeg: true },
    ],
  },
  {
    restaurantId: 'DIN_003',
    name: 'Royal Sky',
    description: 'Fine dining with a great view in Hazratganj.',
    address: 'Hazratganj, Lucknow',
    city: 'Lucknow',
    cuisine: ['Continental', 'North Indian'],
    rating: 4.4,
    costForTwo: 1500,
    imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&q=80&w=800',
    menu: [
      { name: 'Grilled Chicken', price: 450, description: 'Herb-marinated grilled chicken', isVeg: false },
      { name: 'Paneer Tikka', price: 320, description: 'Smoky cottage cheese tikka', isVeg: true },
    ],
  },
];

const IMG = {
  fruits: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&q=80&w=400',
  dairy: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&q=80&w=400',
  snacks: 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?auto=format&fit=crop&q=80&w=400',
  beverages: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=400',
  personal: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&q=80&w=400',
};

export const MOCK_PRODUCTS = [
  { productId: 'PRD_001', name: 'Amul Taaza Milk', description: 'Fresh toned milk', price: 56, category: 'Dairy & Breakfast', subCategory: 'Milk', imageUrl: IMG.dairy, stock: 50, unit: '500 ml' },
  { productId: 'PRD_002', name: 'Britannia Brown Bread', description: 'Whole wheat bread', price: 45, category: 'Dairy & Breakfast', subCategory: 'Bread', imageUrl: IMG.dairy, stock: 30, unit: '400 g' },
  { productId: 'PRD_003', name: 'Farm Fresh Eggs', description: 'Grade A white eggs', price: 72, category: 'Dairy & Breakfast', subCategory: 'Eggs', imageUrl: IMG.dairy, stock: 40, unit: '6 pcs' },
  { productId: 'PRD_004', name: 'Amul Butter', description: 'Salted table butter', price: 58, category: 'Dairy & Breakfast', subCategory: 'Butter', imageUrl: IMG.dairy, stock: 25, unit: '100 g' },
  { productId: 'PRD_005', name: 'Fresh Red Apples', description: 'Kashmiri apples', price: 180, category: 'Fruits & Veggies', subCategory: 'Fruits', imageUrl: IMG.fruits, stock: 20, unit: '1 kg' },
  { productId: 'PRD_006', name: 'Organic Bananas', description: 'Ripe yellow bananas', price: 48, category: 'Fruits & Veggies', subCategory: 'Fruits', imageUrl: IMG.fruits, stock: 35, unit: '1 dozen' },
  { productId: 'PRD_007', name: 'Fresh Tomatoes', description: 'Farm-picked tomatoes', price: 32, category: 'Fruits & Veggies', subCategory: 'Vegetables', imageUrl: IMG.fruits, stock: 60, unit: '1 kg' },
  { productId: 'PRD_008', name: 'Onions', description: 'Premium red onions', price: 38, category: 'Fruits & Veggies', subCategory: 'Vegetables', imageUrl: IMG.fruits, stock: 80, unit: '1 kg' },
  { productId: 'PRD_009', name: 'Lays Classic Salted', description: 'Crispy potato chips', price: 20, category: 'Snacks & Munchies', subCategory: 'Chips', imageUrl: IMG.snacks, stock: 100, unit: '52 g' },
  { productId: 'PRD_010', name: 'Haldirams Bhujia', description: 'Spicy namkeen', price: 55, category: 'Snacks & Munchies', subCategory: 'Namkeen', imageUrl: IMG.snacks, stock: 45, unit: '200 g' },
  { productId: 'PRD_011', name: 'Parle-G Biscuits', description: 'Glucose biscuits', price: 10, category: 'Snacks & Munchies', subCategory: 'Biscuits', imageUrl: IMG.snacks, stock: 200, unit: '80 g' },
  { productId: 'PRD_012', name: 'Cadbury Dairy Milk', description: 'Classic milk chocolate', price: 50, category: 'Snacks & Munchies', subCategory: 'Chocolates', imageUrl: IMG.snacks, stock: 8, unit: '55 g' },
  { productId: 'PRD_013', name: 'Coca-Cola', description: 'Chilled soft drink', price: 40, category: 'Beverages', subCategory: 'Soft Drinks', imageUrl: IMG.beverages, stock: 60, unit: '750 ml' },
  { productId: 'PRD_014', name: 'Real Orange Juice', description: 'No added sugar', price: 110, category: 'Beverages', subCategory: 'Juice', imageUrl: IMG.beverages, stock: 25, unit: '1 L' },
  { productId: 'PRD_015', name: 'Bisleri Water', description: 'Packaged drinking water', price: 20, category: 'Beverages', subCategory: 'Water', imageUrl: IMG.beverages, stock: 100, unit: '1 L' },
  { productId: 'PRD_016', name: 'Nescafe Classic', description: 'Instant coffee powder', price: 280, category: 'Beverages', subCategory: 'Coffee', imageUrl: IMG.beverages, stock: 15, unit: '100 g' },
  { productId: 'PRD_017', name: 'Dove Soap', description: 'Moisturising beauty bar', price: 65, category: 'Personal Care', subCategory: 'Soap', imageUrl: IMG.personal, stock: 40, unit: '125 g' },
  { productId: 'PRD_018', name: 'Head & Shoulders Shampoo', description: 'Anti-dandruff shampoo', price: 320, category: 'Personal Care', subCategory: 'Shampoo', imageUrl: IMG.personal, stock: 20, unit: '340 ml' },
  { productId: 'PRD_019', name: 'Colgate MaxFresh', description: 'Cool mint toothpaste', price: 95, category: 'Personal Care', subCategory: 'Oral Care', imageUrl: IMG.personal, stock: 35, unit: '150 g' },
  { productId: 'PRD_020', name: 'Dettol Hand Wash', description: 'Original hand wash', price: 99, category: 'Personal Care', subCategory: 'Hand Wash', imageUrl: IMG.personal, stock: 28, unit: '200 ml' },
];

export const MOCK_CATEGORIES = ['All', 'Fruits & Veggies', 'Dairy & Breakfast', 'Snacks & Munchies', 'Beverages', 'Personal Care'];

export function calculateMetroFare(entry: string, exit: string, stations: string[]): number {
  const startIndex = stations.indexOf(entry);
  const endIndex = stations.indexOf(exit);
  if (startIndex === -1 || endIndex === -1) return 10;
  const travel = Math.abs(endIndex - startIndex);
  if (travel === 1) return 10;
  if (travel === 2) return 15;
  if (travel >= 3 && travel <= 6) return 20;
  if (travel >= 7 && travel <= 9) return 30;
  if (travel >= 10 && travel <= 13) return 40;
  if (travel >= 14 && travel <= 17) return 50;
  return 60;
}

export function getStationsBetween(from: string, to: string, stations: string[]): string[] {
  const start = stations.indexOf(from);
  const end = stations.indexOf(to);
  if (start === -1 || end === -1) return [];
  const slice = start < end ? stations.slice(start, end + 1) : stations.slice(end, start + 1).reverse();
  return slice;
}
