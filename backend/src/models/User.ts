import mongoose, { Schema, Document } from 'mongoose';

// ─── Linked Bank Sub-Schema ───
const linkedBankSchema = new Schema({
  bankName:      { type: String, required: true },
  accountNumber: { type: String, required: true },
  balance:       { type: Number, default: 0 },
  ifsc:          { type: String, default: '' },
  isPrimary:     { type: Boolean, default: false },
}, { _id: false });

// ─── NFC Card Sub-Schema ───
const cardSchema = new Schema({
  cardNumber:       { type: String, required: true },
  cardType:         { type: String, default: 'NFC Smart Card' },
  expiry:           { type: String, required: true },
  isBlocked:        { type: Boolean, default: false },
  domesticUsage:    { type: Boolean, default: true },
  internationalUsage: { type: Boolean, default: false },
  dailyLimit:       { type: Number, default: 50000 },
  contactlessLimit: { type: Number, default: 2000 },
  cvvHash:          { type: String, required: true },
}, { _id: false });

// ─── User Interface ───
export interface IUser extends Document {
  userId: string;
  username: string;
  cardUid: string;
  cardUidHash: string | null;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  isAdmin: boolean;
  avatar: string;
  pairingToken: string | null;
  pairingTokenExpiresAt: Date | null;
  isCardPaired: boolean;
  wallet: {
    balance: number;
    currency: string;
    dailyLimit: number;
    contactlessLimit: number;
    lastTopUp: Date | null;
  };
  card: {
    cardNumber: string;
    cardType: string;
    expiry: string;
    isBlocked: boolean;
    domesticUsage: boolean;
    internationalUsage: boolean;
    dailyLimit: number;
    contactlessLimit: number;
    cvvHash: string;
  };
  linkedBanks: Array<{
    bankName: string;
    accountNumber: string;
    balance: number;
    ifsc: string;
    isPrimary: boolean;
  }>;
  loyaltyPoints: number;
  transactionCount: number;
  memberTier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  language: 'EN' | 'HI';
  theme: 'DARK' | 'LIGHT';
  notificationsEnabled: boolean;
  activeMetroJourney: mongoose.Types.ObjectId | null;
  activeParkingSpot: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── User Schema ───
const userSchema = new Schema<IUser>({
  userId:   { type: String, required: true, unique: true, index: true },
  username: { type: String, required: true, unique: true, index: true },
  cardUid:  { type: String, required: true, unique: true, index: true },
  // HMAC of the card UID (Phase 3). Sparse+unique so legacy rows without it
  // (null) don't collide during the dual-read migration window.
  cardUidHash: { type: String, default: null },
  name:     { type: String, required: true },
  email:    { type: String, required: true, unique: true },
  phone:    { type: String, default: '' },
  passwordHash: { type: String, required: true },
  isAdmin:  { type: Boolean, default: false },
  avatar:   { type: String, default: '' },
  pairingToken: { type: String, default: null },
  pairingTokenExpiresAt: { type: Date, default: null },
  isCardPaired: { type: Boolean, default: false },

  wallet: {
    balance:          { type: Number, default: 0 },
    currency:         { type: String, default: 'INR' },
    dailyLimit:       { type: Number, default: 50000 },
    contactlessLimit: { type: Number, default: 2000 },
    lastTopUp:        { type: Date, default: null },
  },

  card: cardSchema,
  linkedBanks: [linkedBankSchema],

  loyaltyPoints:    { type: Number, default: 0 },
  transactionCount: { type: Number, default: 0 },
  memberTier:       { type: String, enum: ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'], default: 'BRONZE' },

  language:              { type: String, enum: ['EN', 'HI'], default: 'EN' },
  theme:                 { type: String, enum: ['DARK', 'LIGHT'], default: 'DARK' },
  notificationsEnabled:  { type: Boolean, default: true },

  activeMetroJourney: { type: Schema.Types.ObjectId, ref: 'MetroJourney', default: null },
  activeParkingSpot:  { type: String, default: null },
}, {
  timestamps: true,
});

// Each pairing token is a unique 10-digit code. A PARTIAL index (only string
// values) is used instead of `sparse` because sparse still indexes explicit
// `null`s — and every unpaired/cleared row stores null — so multiple nulls
// would collide (E11000). Partial + $type:'string' ignores nulls entirely.
userSchema.index(
  { pairingToken: 1 },
  { unique: true, partialFilterExpression: { pairingToken: { $type: 'string' } } },
);

// Card-UID hash: unique per card. Same reasoning as above — legacy/unpaired
// rows keep cardUidHash:null, so we must NOT index nulls or new registrations
// (which default cardUidHash to null) collide on the second insert.
userSchema.index(
  { cardUidHash: 1 },
  { unique: true, partialFilterExpression: { cardUidHash: { $type: 'string' } } },
);

// Calculate member tier based on loyalty points
userSchema.methods.calculateTier = function(): string {
  if (this.loyaltyPoints >= 1000) return 'PLATINUM';
  if (this.loyaltyPoints >= 500) return 'GOLD';
  if (this.loyaltyPoints >= 200) return 'SILVER';
  return 'BRONZE';
};

export const User = mongoose.model<IUser>('User', userSchema);
