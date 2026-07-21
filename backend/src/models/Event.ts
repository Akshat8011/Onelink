import mongoose, { Schema, Document } from 'mongoose';

export interface IEvent extends Document {
  eventId: string;
  name: string;
  date: Date;
  venue: string;
  city: string;
  category: string;
  type: string;
  pricing: { basePrice: number; currency: string };
  tickets: { total: number; available: number; sold: number };
  popularity: string;
  image: string;
  emoji: string;
  displayTime?: string;
  bookMyShowUrl?: string;
  isActive: boolean;
  createdAt: Date;
}

const eventSchema = new Schema<IEvent>({
  eventId:  { type: String, required: true, unique: true, index: true },
  name:     { type: String, required: true },
  date:     { type: Date, required: true },
  venue:    { type: String, required: true },
  city:     { type: String, default: 'Lucknow' },
  category: { type: String, required: true },
  type:     { type: String, required: true },
  pricing: {
    basePrice: { type: Number, required: true },
    currency:  { type: String, default: 'INR' },
  },
  tickets: {
    total:     { type: Number, required: true },
    available: { type: Number, required: true },
    sold:      { type: Number, default: 0 },
  },
  popularity: { type: String, default: 'NEW' },
  image:      { type: String, default: '' },
  emoji:      { type: String, default: '🎭' },
  displayTime:{ type: String, default: '' },
  bookMyShowUrl:{ type: String, default: '' },
  isActive:   { type: Boolean, default: true },
}, { timestamps: true });

eventSchema.index({ category: 1, date: 1 });

export const Event = mongoose.model<IEvent>('Event', eventSchema);
