import mongoose, { Schema, Document } from 'mongoose';

export interface ICanteenCartItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  imageUrl?: string;
  category?: string;
}

export interface ICanteenCart extends Document {
  cartId: string;
  userId: string;
  items: ICanteenCartItem[];
  subtotal: number;
  total: number;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  createdAt: Date;
  updatedAt: Date;
  paidAt?: Date;
  orderId?: string;
}

const CanteenCartSchema = new Schema<ICanteenCart>(
  {
    cartId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    items: [
      {
        productId: String,
        name: String,
        quantity: Number,
        price: Number,
        imageUrl: String,
        category: String,
      },
    ],
    subtotal: { type: Number, required: true },
    total: { type: Number, required: true },
    status: { type: String, enum: ['PENDING', 'PAID', 'CANCELLED'], default: 'PENDING' },
    paidAt: Date,
    orderId: String,
  },
  { timestamps: true },
);

export const CanteenCart = mongoose.model<ICanteenCart>('CanteenCart', CanteenCartSchema);
