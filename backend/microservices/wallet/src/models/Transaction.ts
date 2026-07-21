import mongoose, { Schema, Document } from 'mongoose';

export interface ITransaction extends Document {
  transactionId: string;
  userId: string;
  type: 'DEBIT' | 'CREDIT';
  amount: number;
  category: 'MOBILITY' | 'TRANSIT' | 'RETAIL' | 'CITY' | 'ADD_FUNDS' | 'MISC';
  description: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  date: Date;
}

const transactionSchema = new Schema<ITransaction>({
  transactionId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  type: { type: String, enum: ['DEBIT', 'CREDIT'], required: true },
  amount: { type: Number, required: true },
  category: { type: String, enum: ['MOBILITY', 'TRANSIT', 'RETAIL', 'CITY', 'ADD_FUNDS', 'MISC'], required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ['SUCCESS', 'FAILED', 'PENDING'], default: 'SUCCESS' },
  date: { type: Date, default: Date.now }
}, {
  timestamps: true,
});

export const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);
