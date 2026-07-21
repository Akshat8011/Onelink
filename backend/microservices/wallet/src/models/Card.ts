import mongoose, { Schema, Document } from 'mongoose';

export interface ICard extends Document {
  cardId: string;
  userId: string;
  bankName: string;
  cardType: 'CREDIT' | 'DEBIT';
  network: 'VISA' | 'MASTERCARD' | 'RUPAY';
  cardNumberLast4: string;
  expiryMonth: number;
  expiryYear: number;
  cvv: string;
  cardholderName: string;
  colorHex: string;
  // Settings
  isBlocked: boolean;
  internationalPayments: boolean;
  onlineTransactions: boolean;
  dailyLimit: number;
}

const cardSchema = new Schema<ICard>({
  cardId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  bankName: { type: String, required: true },
  cardType: { type: String, enum: ['CREDIT', 'DEBIT'], required: true },
  network: { type: String, enum: ['VISA', 'MASTERCARD', 'RUPAY'], required: true },
  cardNumberLast4: { type: String, required: true },
  expiryMonth: { type: Number, required: true },
  expiryYear: { type: Number, required: true },
  cvv: { type: String, required: true },
  cardholderName: { type: String, required: true },
  colorHex: { type: String, required: true },
  
  // Settings
  isBlocked: { type: Boolean, default: false },
  internationalPayments: { type: Boolean, default: false },
  onlineTransactions: { type: Boolean, default: true },
  dailyLimit: { type: Number, default: 50000 }
}, {
  timestamps: true,
});

export const Card = mongoose.model<ICard>('Card', cardSchema);
