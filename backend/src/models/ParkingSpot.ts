import mongoose, { Schema, Document } from 'mongoose';

export interface IParkingSpot extends Document {
  spotId: string;
  zone: string;
  spotNumber: number;
  status: 'FREE' | 'OCCUPIED' | 'RESERVED';
  occupiedBy: string | null;
  cardUid: string | null;
  entryTime: Date | null;
  reservedUntil: Date | null;
  irSensorValue: number;
  ledColor: 'GREEN' | 'RED' | 'YELLOW';
  barrierState: 'OPEN' | 'CLOSED';
  ratePerMinute: number;
  currentSession: {
    userId: string | null;
    startTime: Date | null;
    endTime: Date | null;
    totalMinutes: number;
    totalCharge: number;
  };
  updatedAt: Date;
}

const parkingSpotSchema = new Schema<IParkingSpot>({
  spotId:     { type: String, required: true, unique: true, index: true },
  zone:       { type: String, required: true },
  spotNumber: { type: Number, required: true },
  status:     { type: String, enum: ['FREE', 'OCCUPIED', 'RESERVED'], default: 'FREE' },
  occupiedBy: { type: String, default: null },
  cardUid:    { type: String, default: null },
  entryTime:  { type: Date, default: null },
  reservedUntil: { type: Date, default: null },
  irSensorValue: { type: Number, default: 0 },
  ledColor:      { type: String, enum: ['GREEN', 'RED', 'YELLOW'], default: 'GREEN' },
  barrierState:  { type: String, enum: ['OPEN', 'CLOSED'], default: 'CLOSED' },
  ratePerMinute: { type: Number, default: 50 }, // ₹50/min from existing system
  currentSession: {
    userId:       { type: String, default: null },
    startTime:    { type: Date, default: null },
    endTime:      { type: Date, default: null },
    totalMinutes: { type: Number, default: 0 },
    totalCharge:  { type: Number, default: 0 },
  },
}, {
  timestamps: true,
});

export const ParkingSpot = mongoose.model<IParkingSpot>('ParkingSpot', parkingSpotSchema);
