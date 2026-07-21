import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
  productId: string;
  name: string;
  description: string;
  price: number;
  category: string;
  subCategory: string;
  imageUrl: string;
  stock: number;
  unit: string;
}

const productSchema = new Schema<IProduct>({
  productId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, required: true, index: true },
  subCategory: { type: String, required: true },
  imageUrl: { type: String, required: true },
  stock: { type: Number, required: true, default: 100 },
  unit: { type: String, required: true }
}, {
  timestamps: true,
});

export const Product = mongoose.model<IProduct>('Product', productSchema);
