import mongoose, { Schema, Document } from 'mongoose';

export interface IMenuItem {
  name: string;
  price: number;
  description: string;
  isVeg: boolean;
}

export interface IDiningPlace extends Document {
  restaurantId: string;
  name: string;
  description: string;
  address: string;
  city: string;
  cuisine: string[];
  rating: number;
  costForTwo: number;
  imageUrl: string;
  menu: IMenuItem[];
  createdAt: Date;
}

const menuItemSchema = new Schema<IMenuItem>({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  description: { type: String },
  isVeg: { type: Boolean, required: true, default: true }
});

const diningPlaceSchema = new Schema<IDiningPlace>({
  restaurantId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  address: { type: String, required: true },
  city: { type: String, required: true, default: 'Lucknow' },
  cuisine: [{ type: String }],
  rating: { type: Number, default: 0 },
  costForTwo: { type: Number, required: true },
  imageUrl: { type: String, required: true },
  menu: [menuItemSchema]
}, {
  timestamps: true,
});

export const DiningPlace = mongoose.model<IDiningPlace>('DiningPlace', diningPlaceSchema);
