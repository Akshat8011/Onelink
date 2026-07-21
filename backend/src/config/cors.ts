import type { CorsOptions } from 'cors';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

/** Hostnames always allowed (web app + local dev). */
const BUILTIN_ALLOWED_HOSTS = [
  'my.digitalzen.app',
  'www.my.digitalzen.app',
  'digitalzen.app',
  'www.digitalzen.app',
  'onelink-wine-psi.vercel.app', // deployed web app
  'localhost',
  '127.0.0.1',
];

function hostnameFromOrigin(origin: string): string | null {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Private/LAN hosts so a Pi-served kiosk on the local network is allowed. */
function isLanHost(host: string): boolean {
  return (
    host === '0.0.0.0' ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host.endsWith('.local')
  );
}

export function isOriginAllowed(origin: string): boolean {
  if (env.SOCKET_CORS_ALLOW_ALL) return true;
  if (env.SOCKET_CORS_ORIGIN.includes(origin)) return true;

  const host = hostnameFromOrigin(origin);
  if (!host) return false;

  if (BUILTIN_ALLOWED_HOSTS.includes(host)) return true;
  if (host.endsWith('.digitalzen.app')) return true;
  // Vercel preview deploys of this project (e.g. onelink-wine-psi-<hash>.vercel.app)
  if (host.startsWith('onelink') && host.endsWith('.vercel.app')) return true;
  if (isLanHost(host)) return true;

  return false;
}

export const httpCorsOptions: CorsOptions = {
  origin(origin, callback) {
    // Mobile apps, curl, server-to-server — no Origin header
    if (!origin) {
      callback(null, true);
      return;
    }
    if (isOriginAllowed(origin)) {
      callback(null, true);
      return;
    }
    logger.warn(`CORS blocked origin: ${origin}`);
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  // 'Idempotency-Key' MUST be here: the kiosk sends it on every money-moving
  // POST (parking/transit/shop) so a retry can't double-charge. Omitting it
  // makes the browser's CORS preflight reject the request, which surfaces in the
  // UI as "Could not reach the server" even though the backend is perfectly up.
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Idempotency-Key'],
  optionsSuccessStatus: 204,
};

type SocketOriginFn = (
  origin: string | undefined,
  cb: (err: Error | null, allow?: boolean) => void,
) => void;

/**
 * Socket.IO origin setting. `true` when explicitly allow-all, otherwise a
 * validator that reuses the same allowlist as HTTP CORS (instead of a static
 * array, which would wrongly reject LAN/preview origins).
 */
export function socketCorsOrigin(): boolean | SocketOriginFn {
  if (env.SOCKET_CORS_ALLOW_ALL) return true;
  return (origin, cb) => {
    if (!origin || isOriginAllowed(origin)) {
      cb(null, true);
      return;
    }
    logger.warn(`Socket.IO CORS blocked origin: ${origin}`);
    cb(null, false);
  };
}
