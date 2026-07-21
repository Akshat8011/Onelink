import mongoose, { Schema, Document } from 'mongoose';

export interface IKioskCart extends Document {
  cartId: string;
  userId: string;
  items: Array<{
    productId: string;
    name: string;
    brand?: string;
    quantity: number;
    unit?: string;
    price: number;
  }>;
  subtotal: number;
  total: number;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  createdAt: Date;
  updatedAt: Date;
  paidAt?: Date;
  orderId?: string;
}

const KioskCartSchema = new Schema<IKioskCart>(
  {
    cartId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    items: [
      {
        productId: String,
        name: String,
        brand: String,
        quantity: Number,
        unit: String,
        price: Number,
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

export const KioskCart = mongoose.model<IKioskCart>('KioskCart', KioskCartSchema);
