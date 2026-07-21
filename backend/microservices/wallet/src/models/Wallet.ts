import mongoose, { Schema, Document } from 'mongoose';

export interface IWallet extends Document {
  userId: string;
  balance: number;
  currency: string;
}

const walletSchema = new Schema<IWallet>({
  userId: { type: String, required: true, unique: true, index: true },
  balance: { type: Number, required: true, default: 0 },
  currency: { type: String, required: true, default: 'INR' }
}, {
  timestamps: true,
});

export const Wallet = mongoose.model<IWallet>('Wallet', walletSchema);
