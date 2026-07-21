import mongoose, { Schema, Document } from 'mongoose';

export interface ICanteenOrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  imageUrl?: string;
  category?: string;
}

export interface ICanteenOrder extends Document {
  orderId: string;
  orderNumber: number;
  userId: string;
  cartId?: string;
  items: ICanteenOrderItem[];
  total: number;
  status: 'PREPARING' | 'READY' | 'COLLECTED';
  paidAt: Date;
  readyAt: Date;
  collectedAt?: Date;
  receiptId: string;
  transactionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CanteenOrderSchema = new Schema<ICanteenOrder>(
  {
    orderId: { type: String, required: true, unique: true, index: true },
    orderNumber: { type: Number, required: true, index: true },
    userId: { type: String, required: true, index: true },
    cartId: String,
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
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: ['PREPARING', 'READY', 'COLLECTED'],
      default: 'PREPARING',
      index: true,
    },
    paidAt: { type: Date, required: true },
    readyAt: { type: Date, required: true },
    collectedAt: Date,
    receiptId: { type: String, required: true, unique: true },
    transactionId: String,
  },
  { timestamps: true },
);

CanteenOrderSchema.index({ userId: 1, status: 1, createdAt: -1 });

export const CanteenOrder = mongoose.model<ICanteenOrder>('CanteenOrder', CanteenOrderSchema);
