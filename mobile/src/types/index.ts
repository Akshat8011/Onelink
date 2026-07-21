// ═══════════════════════════════════════
// OneLink Super App — TypeScript Interfaces
// ═══════════════════════════════════════

// ─── User & Auth ───
export interface User {
  userId: string;
  username?: string;
  cardUid: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  wallet: Wallet;
  card: NfcCard;
  linkedBanks: BankAccount[];
  loyaltyPoints: number;
  transactionCount: number;
  memberTier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  language: 'EN' | 'HI';
  theme: 'DARK' | 'LIGHT';
  isCardPaired?: boolean;
  isAdmin?: boolean;
  pairingToken?: string | null;
  hasPairingCode?: boolean;
  activeMetroJourney: string | null;
  activeParkingSpot: string | null;
}

export interface Wallet {
  balance: number;
  currency: string;
  dailyLimit: number;
  contactlessLimit: number;
  lastTopUp: string | null;
}

export interface NfcCard {
  cardNumber: string;
  cardType: string;
  expiry: string;
  isBlocked: boolean;
  domesticUsage: boolean;
  internationalUsage: boolean;
}

export interface BankAccount {
  bankName: string;
  accountNumber: string;
  balance: number;
  ifsc: string;
  isPrimary: boolean;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// ─── Transactions ───
export interface Transaction {
  transactionId: string;
  userId: string;
  type: 'DEBIT' | 'CREDIT' | 'REFUND';
  category: 'METRO' | 'PARKING' | 'SHOPPING' | 'BILL_PAY' | 'EVENT' | 'TOP_UP' | 'REWARD_REDEEM';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  paymentMethod: string;
  rewardPoints: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  createdAt: string;
}

// ─── Metro/Transit ───
export interface MetroJourney {
  journeyId: string;
  entryStation: string;
  exitStation: string | null;
  entryTime: string;
  exitTime: string | null;
  durationMinutes: number | null;
  fare: number | null;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'PENALTY';
}

export interface ActiveJourney {
  journeyId: string;
  entryStation: string;
  entryTime: string;
  durationMinutes: number;
  estimatedFare: number;
}

// ─── Parking ───
export interface ParkingSpot {
  spotId: string;
  zone: string;
  spotNumber: number;
  status: 'FREE' | 'OCCUPIED' | 'RESERVED';
  occupiedBy: string | null;
  occupantName?: string | null;
  entryTime: string | null;
  reservedUntil?: string | null;
  ratePerMinute: number;
  ledColor: 'GREEN' | 'RED' | 'YELLOW';
}

// ─── Shopping/Retail ───
export interface ShoppingItem {
  itemId: string;
  name: string;
  price: number;
  category: string;
  popularity: string;
  emoji: string;
  inStock: boolean;
}

export interface CartItem {
  item: ShoppingItem;
  quantity: number;
}

// ─── Events ───
export interface CityEvent {
  eventId: string;
  name: string;
  date: string;
  venue: string;
  city: string;
  category: string;
  pricing: { basePrice: number; currency: string };
  tickets: { total: number; available: number; sold: number };
  popularity: string;
  emoji: string;
}

// ─── Bills ───
export interface Bill {
  billId: string;
  name: string;
  amount: number;
  dueDate: string;
  provider: string;
  category: string;
  isPaid: boolean;
  paidAt: string | null;
}

// ─── API Response ───
export interface ApiResponse<T = any> {
  success?: boolean;
  message?: string;
  error?: string;
  data?: T;
}

// ─── Socket Events ───
export interface TransitEntryEvent {
  station: string;
  entryTime: string;
  journeyId: string;
  message: string;
}

export interface TransitExitEvent {
  station: string;
  fare: number;
  duration: number;
  newBalance: number;
  message: string;
}

export interface ParkingUpdateEvent {
  spots: ParkingSpot[];
}

export interface PaymentReceiptEvent {
  transactionId: string;
  amount: number;
  newBalance: number;
  rewardPoints: number;
  status: string;
}
