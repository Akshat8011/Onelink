import dotenv from 'dotenv';
dotenv.config();

export const env = {
  // Server
  PORT: parseInt(process.env.PORT || '5000'),
  NODE_ENV: process.env.NODE_ENV || 'development',

  // MongoDB
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/onelink',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'onelink_dev_secret',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // Keyed HMAC secret for hashing RFID card UIDs at rest (Phase 3). Falls back
  // to JWT_SECRET so existing deployments keep working; set a dedicated value
  // in production so rotating one does not affect the other.
  CARD_UID_HMAC_SECRET: process.env.CARD_UID_HMAC_SECRET || '',

  // MQTT
  MQTT_BROKER_URL: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
  MQTT_PORT: parseInt(process.env.MQTT_PORT || '1883'),
  MQTT_USERNAME: process.env.MQTT_USERNAME || '',
  MQTT_PASSWORD: process.env.MQTT_PASSWORD || '',
  MQTT_CLIENT_ID: process.env.MQTT_CLIENT_ID || 'onelink-cloud-backend',

  // Socket.IO + HTTP CORS (comma-separated origins). Allow-all now requires an
  // EXPLICIT '*'. When unset we fall back to the built-in allowlist (real
  // frontends + localhost/LAN) instead of silently allowing every origin.
  SOCKET_CORS_ALLOW_ALL: (process.env.SOCKET_CORS_ORIGIN || '').trim() === '*',
  SOCKET_CORS_ORIGIN: (() => {
    const raw = (process.env.SOCKET_CORS_ORIGIN || '').trim();
    if (raw === '' || raw === '*') return [] as string[];
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  })(),

  // Business Rules
  PARKING_RATE_PER_MINUTE: parseFloat(process.env.PARKING_RATE_PER_MINUTE || '50'),
  METRO_BASE_FARE: parseFloat(process.env.METRO_BASE_FARE || '10'),
  METRO_PER_KM_RATE: parseFloat(process.env.METRO_PER_KM_RATE || '2.5'),
  INTERNAL_NOTIFY_KEY: process.env.INTERNAL_NOTIFY_KEY || process.env.JWT_SECRET || 'onelink_dev_secret',
  LOYALTY_POINTS_RATIO: parseInt(process.env.LOYALTY_POINTS_RATIO || '10'),
};
