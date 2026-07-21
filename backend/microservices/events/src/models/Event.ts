import mongoose, { Schema, Document } from 'mongoose';

export interface IEvent extends Document {
  eventId: string;
  title: string;
  description: string;
  venue: string;
  city: string;
  date: Date;
  price: number;
  capacity: number;
  ticketsSold: number;
  category: 'MUSIC' | 'SPORTS' | 'COMEDY' | 'THEATER' | 'WORKSHOP';
  imageUrl: string;
  createdAt: Date;
}

const eventSchema = new Schema<IEvent>({
  eventId: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  venue: { type: String, required: true },
  city: { type: String, required: true, default: 'Lucknow' },
  date: { type: Date, required: true },
  price: { type: Number, required: true },
  capacity: { type: Number, required: true },
  ticketsSold: { type: Number, default: 0 },
  category: { type: String, enum: ['MUSIC', 'SPORTS', 'COMEDY', 'THEATER', 'WORKSHOP'], required: true },
  imageUrl: { type: String, required: true }
}, {
  timestamps: true,
});

export const Event = mongoose.model<IEvent>('Event', eventSchema);
