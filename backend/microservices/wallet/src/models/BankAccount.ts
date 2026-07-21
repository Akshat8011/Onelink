import mongoose, { Schema, Document } from 'mongoose';

export interface IBankAccount extends Document {
  accountId: string;
  userId: string;
  bankName: string;
  accountType: 'SAVINGS' | 'CURRENT';
  accountNumberLast4: string;
  ifscCode: string;
  balance: number;
}

const bankAccountSchema = new Schema<IBankAccount>({
  accountId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  bankName: { type: String, required: true },
  accountType: { type: String, enum: ['SAVINGS', 'CURRENT'], required: true },
  accountNumberLast4: { type: String, required: true },
  ifscCode: { type: String, required: true },
  balance: { type: Number, required: true, default: 0 }
}, {
  timestamps: true,
});

export const BankAccount = mongoose.model<IBankAccount>('BankAccount', bankAccountSchema);
