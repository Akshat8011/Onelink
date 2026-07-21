import mongoose, { Schema, Document } from 'mongoose';

export interface IOrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface IOrder extends Document {
  orderId: string;
  userId: string;
  items: IOrderItem[];
  totalAmount: number;
  status: 'PENDING' | 'CONFIRMED' | 'DELIVERED' | 'CANCELLED';
  deliveryAddress: string;
}

const orderItemSchema = new Schema<IOrderItem>({
  productId: { type: String, required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true }
});

const orderSchema = new Schema<IOrder>({
  orderId: { type: String, required: true, unique: true },
  userId: { type: String, required: true, default: 'mock-user' },
  items: [orderItemSchema],
  totalAmount: { type: Number, required: true },
  status: { type: String, enum: ['PENDING', 'CONFIRMED', 'DELIVERED', 'CANCELLED'], default: 'CONFIRMED' },
  deliveryAddress: { type: String, required: true, default: 'Lucknow' }
}, {
  timestamps: true,
});

export const Order = mongoose.model<IOrder>('Order', orderSchema);
