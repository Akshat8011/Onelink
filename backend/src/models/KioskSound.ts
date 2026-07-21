import mongoose, { Schema, Document } from 'mongoose';

/**
 * Admin-uploaded kiosk sound. One document per sound key (home, tap, success…).
 * The audio bytes are stored inline as a base64 data URI so no external object
 * storage is required. The kiosk fetches a manifest and streams each sound from
 * GET /api/v1/kiosk/sounds/:key.
 */
export interface IKioskSound extends Document {
  key: string;
  mimeType: string;
  fileName: string;
  size: number;
  dataUri: string;
  updatedBy: string;
  updatedAt: Date;
  createdAt: Date;
}

const kioskSoundSchema = new Schema<IKioskSound>({
  key:       { type: String, required: true, unique: true, index: true },
  mimeType:  { type: String, default: 'audio/mpeg' },
  fileName:  { type: String, default: '' },
  size:      { type: Number, default: 0 },
  dataUri:   { type: String, required: true },
  updatedBy: { type: String, default: '' },
}, {
  timestamps: true,
});

export const KioskSound = mongoose.model<IKioskSound>('KioskSound', kioskSoundSchema);

// Sound keys the admin can customize. Kept in sync with the kiosk player.
export const SOUND_KEYS = [
  'home',      // homepage / services background loop
  'services',  // chime when the services screen opens
  'tap',       // generic tap
  'press',     // button press
  'back',      // back navigation
  'cardTap',   // card presented to reader
  'transit',   // opening Transit
  'shop',      // opening Shop
  'parking',   // opening Parking
  'success',   // payment / action success
  'denied',    // decline / access denied / failure
] as const;

export type SoundKey = typeof SOUND_KEYS[number];
