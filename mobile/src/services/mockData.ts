// Mock Data for OneLink Frontend to run completely without a backend (Demo Mode)

export const MOCK_MOBILITY = {
  parkingSpots: [
    { spotId: 'A1', zone: 'A', status: 'FREE', ratePerMinute: 2, ledColor: 'GREEN' },
    { spotId: 'A2', zone: 'A', status: 'OCCUPIED', ratePerMinute: 2, ledColor: 'RED' },
    { spotId: 'A3', zone: 'A', status: 'FREE', ratePerMinute: 2, ledColor: 'GREEN' },
    { spotId: 'B1', zone: 'B', status: 'RESERVED', ratePerMinute: 3, ledColor: 'YELLOW' },
    { spotId: 'B2', zone: 'B', status: 'FREE', ratePerMinute: 3, ledColor: 'GREEN' },
    { spotId: 'B3', zone: 'B', status: 'OCCUPIED', ratePerMinute: 3, ledColor: 'RED' }
  ],
  evStations: [
    {
      stationId: 'EV_HUB_LKO_1',
      type: 'FAST_CHARGER',
      location: { address: 'Hazratganj Multi-Level Parking' },
      connectors: [
        { connectorId: 'C1', type: 'CCS2', powerKw: 50, status: 'AVAILABLE' },
        { connectorId: 'C2', type: 'CHAdeMO', powerKw: 50, status: 'CHARGING' }
      ],
      parkingStatus: 'AVAILABLE',
      ratePerMinute: 15
    },
    {
      stationId: 'EV_HUB_LKO_2',
      type: 'AC_CHARGER',
      location: { address: 'Gomti Nagar Extension' },
      connectors: [
        { connectorId: 'C3', type: 'Type 2', powerKw: 22, status: 'AVAILABLE' }
      ],
      parkingStatus: 'AVAILABLE',
      ratePerMinute: 5
    }
  ]
};

export const MOCK_TRANSIT_STATIONS = [
  { stationId: 'ST_001', name: 'Munshi Pulia', line: 'RED', isInterchange: false },
  { stationId: 'ST_002', name: 'Indira Nagar', line: 'RED', isInterchange: false },
  { stationId: 'ST_003', name: 'Hazratganj', line: 'RED', isInterchange: true },
  { stationId: 'ST_004', name: 'Charbagh', line: 'RED', isInterchange: true },
  { stationId: 'ST_005', name: 'Transport Nagar', line: 'RED', isInterchange: false }
];

export const MOCK_TRANSIT_HISTORY = [
  {
    ticketId: 'TKT_1001',
    status: 'COMPLETED',
    sourceStation: 'Munshi Pulia',
    destinationStation: 'Hazratganj',
    fare: 30,
    entryTime: new Date(Date.now() - 86400000).toISOString(),
    exitTime: new Date(Date.now() - 84400000).toISOString()
  },
  {
    ticketId: 'TKT_1002',
    status: 'ACTIVE',
    sourceStation: 'Charbagh',
    destinationStation: 'Indira Nagar',
    fare: 40,
    entryTime: new Date().toISOString()
  }
];

export const MOCK_CITY_EVENTS = [
  {
    eventId: 'EVT_001',
    title: 'Arijit Singh Live in Concert',
    description: 'Experience the magic of Arijit Singh live.',
    venue: 'Ekana Stadium, Lucknow',
    city: 'Lucknow',
    date: new Date(Date.now() + 86400000 * 5).toISOString(),
    price: 1500,
    capacity: 25000,
    ticketsSold: 12000,
    category: 'MUSIC',
    imageUrl: 'https://images.unsplash.com/photo-1540039155732-68ee14e12781?w=800'
  },
  {
    eventId: 'EVT_002',
    title: 'UP Yoddhas vs Patna Pirates',
    description: 'Pro Kabaddi League action.',
    venue: 'BBD UP Badminton Academy',
    city: 'Lucknow',
    date: new Date(Date.now() + 86400000 * 2).toISOString(),
    price: 500,
    capacity: 5000,
    ticketsSold: 4900,
    category: 'SPORTS',
    imageUrl: 'https://images.unsplash.com/photo-1552667466-07770ae110d0?w=800'
  },
  {
    eventId: 'EVT_003',
    title: 'Zakir Khan: Tathastu',
    description: 'Zakir Khan brings his newest standup special.',
    venue: 'Sangeet Natak Akademi',
    city: 'Lucknow',
    date: new Date(Date.now() + 86400000 * 12).toISOString(),
    price: 999,
    capacity: 800,
    ticketsSold: 750,
    category: 'COMEDY',
    imageUrl: 'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=800'
  }
];

export const MOCK_CITY_DINING = [
  {
    restaurantId: 'DIN_001',
    name: 'Tunday Kababi',
    description: 'The legendary Galauti Kababs.',
    address: 'Aminabad, Lucknow',
    city: 'Lucknow',
    cuisine: ['Awadhi', 'Mughlai'],
    rating: 4.8,
    costForTwo: 600,
    imageUrl: 'https://images.unsplash.com/photo-1599487405902-1bef759c26be?w=800',
    menu: [
      { name: 'Galauti Kabab', price: 160, description: 'Melt in mouth', isVeg: false },
      { name: 'Mutton Biryani', price: 220, description: 'Awadhi dum', isVeg: false }
    ]
  },
  {
    restaurantId: 'DIN_002',
    name: 'Royal Sky',
    description: 'Fine dining in Hazratganj.',
    address: 'Hazratganj, Lucknow',
    city: 'Lucknow',
    cuisine: ['Continental', 'Italian'],
    rating: 4.5,
    costForTwo: 1200,
    imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
    menu: [
      { name: 'Arrabbiata Pasta', price: 350, description: 'Spicy red sauce', isVeg: true },
      { name: 'Paneer Tikka', price: 290, description: 'Grilled', isVeg: true }
    ]
  }
];

// Generate 50 mock retail items
export const MOCK_RETAIL_CATALOG = Array.from({ length: 50 }, (_, i) => {
  const categories = ['GROCERY', 'ELECTRONICS', 'CLOTHING', 'PHARMACY'];
  const cat = categories[i % 4];
  const images = {
    GROCERY: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=300',
    ELECTRONICS: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=300',
    CLOTHING: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=300',
    PHARMACY: 'https://images.unsplash.com/photo-1584308666744-24d5e4b2d35c?w=300'
  };
  return {
    productId: `PROD_${i}`,
    name: `Premium ${cat} Item ${i + 1}`,
    description: `High quality ${cat.toLowerCase()} product delivered in 10 minutes.`,
    category: cat,
    price: Math.floor(Math.random() * 900) + 50,
    stockQuantity: Math.floor(Math.random() * 50) + 5,
    imageUrl: images[cat as keyof typeof images],
    isActive: true
  };
});

export const MOCK_WALLET = {
  wallet: {
    walletId: 'WAL_123',
    userId: 'USER_123',
    balance: 45600.50,
    currency: 'INR'
  },
  banks: [
    { accountId: 'BANK_1', bankName: 'HDFC Bank', accountType: 'SAVINGS', accountNumberLast4: '4567', balance: 125000 },
    { accountId: 'BANK_2', bankName: 'State Bank of India', accountType: 'CURRENT', accountNumberLast4: '9876', balance: 450000 }
  ],
  cards: [
    { cardId: 'CARD_1', bankName: 'HDFC Bank', cardType: 'CREDIT', network: 'VISA', cardNumberLast4: '4321', expiryMonth: 12, expiryYear: 28, cardholderName: 'AKSHAT', colorHex: '#1E3A8A', isBlocked: false, internationalPayments: true, onlineTransactions: true, dailyLimit: 100000 },
    { cardId: 'CARD_2', bankName: 'ICICI Bank', cardType: 'DEBIT', network: 'MASTERCARD', cardNumberLast4: '8765', expiryMonth: 9, expiryYear: 27, cardholderName: 'AKSHAT', colorHex: '#991B1B', isBlocked: true, internationalPayments: false, onlineTransactions: false, dailyLimit: 50000 }
  ],
  transactions: [
    { transactionId: 'TXN_1', type: 'DEBIT', amount: 350, category: 'FOOD', description: 'Tunday Kababi', date: new Date().toISOString() },
    { transactionId: 'TXN_2', type: 'CREDIT', amount: 5000, category: 'TOPUP', description: 'Added from HDFC Bank', date: new Date(Date.now() - 86400000).toISOString() },
    { transactionId: 'TXN_3', type: 'DEBIT', amount: 1500, category: 'ENTERTAINMENT', description: 'Arijit Singh Concert', date: new Date(Date.now() - 172800000).toISOString() }
  ],
  analytics: [
    { _id: 'FOOD', total: 350 },
    { _id: 'ENTERTAINMENT', total: 1500 },
    { _id: 'TOPUP', total: 5000 }
  ]
};
