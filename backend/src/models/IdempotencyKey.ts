import mongoose, { Schema, Document } from 'mongoose';

/**
 * Stores the outcome of a money-moving request keyed by a client-supplied
 * Idempotency-Key. A replayed request (double-tap, network retry) with the same
 * key returns the stored result instead of charging the wallet a second time.
 */
export interface IIdempotencyKey extends Document {
  key: string; // `${scope}:${rawKey}`
  scope: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  response: unknown;
  createdAt: Date;
}

const idempotencyKeySchema = new Schema<IIdempotencyKey>(
  {
    key: { type: String, required: true, unique: true, index: true },
    scope: { type: String, required: true },
    status: { type: String, enum: ['IN_PROGRESS', 'COMPLETED'], default: 'IN_PROGRESS' },
    response: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

// Auto-expire stored keys after 24h so the collection stays small.
idempotencyKeySchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

export const IdempotencyKey = mongoose.model<IIdempotencyKey>(
  'IdempotencyKey',
  idempotencyKeySchema,
);
