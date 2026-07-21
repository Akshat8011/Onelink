import mongoose, { Schema, Document } from 'mongoose';

export interface IMetroJourney extends Document {
  journeyId: string;
  userId: string;
  cardUid: string;
  entryStation: string;
  exitStation: string | null;
  entryGateId: string;
  exitGateId: string | null;
  entryTime: Date;
  exitTime: Date | null;
  durationMinutes: number | null;
  fare: number | null;
  fareCalculation: {
    baseFare: number;
    perKmRate: number;
    distance: number | null;
    surcharge: number;
  };
  status: 'IN_PROGRESS' | 'COMPLETED' | 'PENALTY';
  createdAt: Date;
}

const metroJourneySchema = new Schema<IMetroJourney>({
  journeyId:    { type: String, required: true, unique: true, index: true },
  userId:       { type: String, required: true, index: true },
  cardUid:      { type: String, required: true, index: true },
  entryStation: { type: String, required: true },
  exitStation:  { type: String, default: null },
  entryGateId:  { type: String, required: true },
  exitGateId:   { type: String, default: null },
  entryTime:    { type: Date, required: true },
  exitTime:     { type: Date, default: null },
  durationMinutes: { type: Number, default: null },
  fare:         { type: Number, default: null },
  fareCalculation: {
    baseFare:   { type: Number, default: 10 },
    perKmRate:  { type: Number, default: 2.5 },
    distance:   { type: Number, default: null },
    surcharge:  { type: Number, default: 0 },
  },
  status: { type: String, enum: ['IN_PROGRESS', 'COMPLETED', 'PENALTY'], default: 'IN_PROGRESS' },
}, {
  timestamps: true,
});

// Index for finding active journeys quickly
metroJourneySchema.index({ userId: 1, status: 1 });

export const MetroJourney = mongoose.model<IMetroJourney>('MetroJourney', metroJourneySchema);
