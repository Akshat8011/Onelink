import mongoose, { Schema, Document } from 'mongoose';

export interface IEVStation extends Document {
  stationId: string;
  type: 'PARKING_ONLY' | 'EV_CHARGING';
  location: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
    address: string;
  };
  connectors?: Array<{
    connectorId: string;
    type: 'Type2' | 'CCS2' | 'CHAdeMO';
    powerKw: number;
    status: 'AVAILABLE' | 'OCCUPIED' | 'FAULTED';
  }>;
  parkingStatus: 'AVAILABLE' | 'RESERVED' | 'OCCUPIED';
  currentReservation: {
    userId: string | null;
    reservedAt: Date | null;
    expiresAt: Date | null;
  };
  ratePerMinute: number;
  lastTelemetryUpdate: Date;
}

const evStationSchema = new Schema<IEVStation>({
  stationId: { type: String, required: true, unique: true, index: true },
  type: { type: String, enum: ['PARKING_ONLY', 'EV_CHARGING'], required: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },
    address: { type: String, required: true }
  },
  connectors: [{
    connectorId: { type: String, required: true },
    type: { type: String, enum: ['Type2', 'CCS2', 'CHAdeMO'], required: true },
    powerKw: { type: Number, required: true },
    status: { type: String, enum: ['AVAILABLE', 'OCCUPIED', 'FAULTED'], default: 'AVAILABLE' }
  }],
  parkingStatus: { type: String, enum: ['AVAILABLE', 'RESERVED', 'OCCUPIED'], default: 'AVAILABLE' },
  currentReservation: {
    userId: { type: String, default: null },
    reservedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null }
  },
  ratePerMinute: { type: Number, required: true },
  lastTelemetryUpdate: { type: Date, default: Date.now }
}, { timestamps: true });

evStationSchema.index({ location: '2dsphere' });

export const EVStation = mongoose.model<IEVStation>('EVStation', evStationSchema);
