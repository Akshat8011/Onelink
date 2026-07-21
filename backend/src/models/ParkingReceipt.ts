import mongoose, { Schema, Document } from 'mongoose';

export interface IParkingReceipt extends Document {
  receiptId: string;
  userId: string;
  spotId: string;
  zone: string;
  entryTime: Date;
  exitTime: Date;
  durationMinutes: number;
  ratePerMinute: number;
  totalCharge: number;
  createdAt: Date;
}

const ParkingReceiptSchema = new Schema<IParkingReceipt>({
  receiptId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  spotId: { type: String, required: true },
  zone: { type: String, required: true },
  entryTime: { type: Date, required: true },
  exitTime: { type: Date, required: true },
  durationMinutes: { type: Number, required: true },
  ratePerMinute: { type: Number, required: true },
  totalCharge: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const ParkingReceipt = mongoose.model<IParkingReceipt>('ParkingReceipt', ParkingReceiptSchema);
