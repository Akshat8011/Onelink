import mongoose, { Schema, Document } from 'mongoose';

export interface IShoppingItem extends Document {
  itemId: string;
  name: string;
  price: number;
  currency: string;
  category: string;
  popularity: string;
  image: string;
  emoji: string;
  inStock: boolean;
  stockQuantity: number;
  merchantId: string;
}

const shoppingItemSchema = new Schema<IShoppingItem>({
  itemId:        { type: String, required: true, unique: true },
  name:          { type: String, required: true },
  price:         { type: Number, required: true },
  currency:      { type: String, default: 'INR' },
  category:      { type: String, required: true, index: true },
  popularity:    { type: String, default: 'NEW' },
  image:         { type: String, default: '' },
  emoji:         { type: String, default: '📦' },
  inStock:       { type: Boolean, default: true },
  stockQuantity: { type: Number, default: 100 },
  merchantId:    { type: String, default: 'SMART_HUB_MART' },
}, { timestamps: true });

export const ShoppingItem = mongoose.model<IShoppingItem>('ShoppingItem', shoppingItemSchema);

// ─── Bill Model ───
export interface IBill extends Document {
  billId: string;
  userId: string;
  name: string;
  amount: number;
  dueDate: Date;
  provider: string;
  category: string;
  isPaid: boolean;
  paidAt: Date | null;
  transactionId: string | null;
}

const billSchema = new Schema<IBill>({
  billId:        { type: String, required: true, unique: true },
  userId:        { type: String, required: true, index: true },
  name:          { type: String, required: true },
  amount:        { type: Number, required: true },
  dueDate:       { type: Date, required: true },
  provider:      { type: String, default: '' },
  category:      { type: String, default: 'UTILITY' },
  isPaid:        { type: Boolean, default: false },
  paidAt:        { type: Date, default: null },
  transactionId: { type: String, default: null },
}, { timestamps: true });

billSchema.index({ userId: 1, isPaid: 1 });

export const Bill = mongoose.model<IBill>('Bill', billSchema);
