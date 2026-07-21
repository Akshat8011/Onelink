import mongoose, { Schema, Document } from 'mongoose';

export interface ITransaction extends Document {
  transactionId: string;
  userId: string;
  cardUid: string;
  type: 'DEBIT' | 'CREDIT' | 'REFUND';
  category:
    | 'METRO' | 'PARKING' | 'SHOPPING' | 'BILL_PAY' | 'EVENT' | 'TOP_UP' | 'REWARD_REDEEM'
    | 'INVEST' | 'INSURANCE' | 'LOAN' | 'WITHDRAW' | 'RECHARGE' | 'UPI' | 'MOBILITY' | 'OTHER';
  amount: number;
  currency: string;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  merchantId: string;
  paymentMethod: 'NFC' | 'WALLET' | 'POINTS' | 'BANK_TRANSFER';
  rewardPoints: number;
  metadata: {
    items?: string[];
    station?: string;
    parkingSpot?: string;
    eventName?: string;
    billName?: string;
    duration?: number;
  };
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  createdAt: Date;
}

const transactionSchema = new Schema<ITransaction>({
  transactionId: { type: String, required: true, unique: true, index: true },
  userId:        { type: String, required: true, index: true },
  cardUid:       { type: String, required: true, index: true },
  type:          { type: String, enum: ['DEBIT', 'CREDIT', 'REFUND'], required: true },
  category:      { type: String, enum: ['METRO', 'PARKING', 'SHOPPING', 'BILL_PAY', 'EVENT', 'TOP_UP', 'REWARD_REDEEM', 'INVEST', 'INSURANCE', 'LOAN', 'WITHDRAW', 'RECHARGE', 'UPI', 'MOBILITY', 'OTHER'], required: true },
  amount:        { type: Number, required: true },
  currency:      { type: String, default: 'INR' },
  balanceBefore: { type: Number, required: true },
  balanceAfter:  { type: Number, required: true },
  description:   { type: String, default: '' },
  merchantId:    { type: String, default: 'ONELINK' },
  paymentMethod: { type: String, enum: ['NFC', 'WALLET', 'POINTS', 'BANK_TRANSFER'], default: 'WALLET' },
  rewardPoints:  { type: Number, default: 0 },
  metadata: {
    items:       [{ type: String }],
    station:     { type: String },
    parkingSpot: { type: String },
    eventName:   { type: String },
    billName:    { type: String },
    duration:    { type: Number },
  },
  status: { type: String, enum: ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'], default: 'COMPLETED' },
}, {
  timestamps: true,
});

// Index for efficient user transaction queries
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ category: 1, createdAt: -1 });

export const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);
