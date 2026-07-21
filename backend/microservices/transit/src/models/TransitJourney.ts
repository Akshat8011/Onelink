import mongoose, { Schema, Document } from 'mongoose';

export interface ITransitJourney extends Document {
  journeyId: string;
  userId: string;
  mode: 'METRO' | 'BUS';
  entryStation: string;
  exitStation: string | null;
  entryTime: Date;
  exitTime: Date | null;
  durationMinutes: number | null;
  fare: number | null;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'PENALTY';
  ticketType: 'RFID_CARD' | 'JWT_QR';
  jwtToken?: string;
  createdAt: Date;
}

const transitJourneySchema = new Schema<ITransitJourney>({
  journeyId:    { type: String, required: true, unique: true, index: true },
  userId:       { type: String, required: true, index: true },
  mode:         { type: String, enum: ['METRO', 'BUS'], default: 'METRO' },
  entryStation: { type: String, required: true },
  exitStation:  { type: String, default: null },
  entryTime:    { type: Date, required: true },
  exitTime:     { type: Date, default: null },
  durationMinutes: { type: Number, default: null },
  fare:         { type: Number, default: null },
  status:       { type: String, enum: ['IN_PROGRESS', 'COMPLETED', 'PENALTY'], default: 'IN_PROGRESS' },
  ticketType:   { type: String, enum: ['RFID_CARD', 'JWT_QR'], default: 'JWT_QR' },
  jwtToken:     { type: String },
}, {
  timestamps: true,
});

transitJourneySchema.index({ userId: 1, status: 1 });

export const TransitJourney = mongoose.model<ITransitJourney>('TransitJourney', transitJourneySchema);
