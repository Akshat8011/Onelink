import mongoose, { Schema, Document } from 'mongoose';

export interface ICanteenQueue extends Document {
  key: string;
  nowServing: number;
  nextOrderNumber: number;
  updatedAt: Date;
}

const CanteenQueueSchema = new Schema<ICanteenQueue>(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    nowServing: { type: Number, required: true, default: 0 },
    nextOrderNumber: { type: Number, required: true, default: 1 },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

export const CanteenQueue = mongoose.model<ICanteenQueue>('CanteenQueue', CanteenQueueSchema);
