import mongoose, { Schema, Document } from 'mongoose';

export interface IMetroTicket extends Document {
  ticketId: string;
  userId: string;
  cardUid?: string;
  type: 'METRO' | 'BUS';
  from: string;
  to: string;
  fare: number;
  qrPayload: string;
  status: 'ACTIVE' | 'ENTRY_USED' | 'COMPLETED' | 'EXPIRED' | 'USED';
  entryStation?: string;
  exitStation?: string;
  entryTime?: Date;
  exitTime?: Date;
  validUntil: Date;
  bookedAt: Date;
}

const MetroTicketSchema = new Schema<IMetroTicket>({
  ticketId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  cardUid: { type: String, index: true },
  type: { type: String, enum: ['METRO', 'BUS'], default: 'METRO' },
  from: { type: String, required: true },
  to: { type: String, required: true },
  fare: { type: Number, required: true },
  qrPayload: { type: String, required: true },
  status: {
    type: String,
    enum: ['ACTIVE', 'ENTRY_USED', 'COMPLETED', 'EXPIRED', 'USED'],
    default: 'ACTIVE',
  },
  entryStation: String,
  exitStation: String,
  entryTime: Date,
  exitTime: Date,
  validUntil: { type: Date, required: true },
  bookedAt: { type: Date, default: Date.now },
});

export const MetroTicket = mongoose.model<IMetroTicket>('MetroTicket', MetroTicketSchema);
