import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

/**
 * Minimal in-memory fixed-window rate limiter (Phase 3, dependency-free).
 *
 * Protects unauthenticated, abuse-prone endpoints (card lookup, card pairing)
 * from brute-force / enumeration. Scope note: state is per-process, so on a
 * multi-instance deployment each instance limits independently. For the current
 * single-instance Render setup that is sufficient; a shared store (Redis) would
 * be the next step if the backend is horizontally scaled.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

function clientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  if (Array.isArray(fwd) && fwd.length) return fwd[0];
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  name: string;
}

export function rateLimit({ windowMs, max, name }: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();

  // Periodically drop expired buckets so the map can't grow unbounded.
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(key);
    }
  }, windowMs);
  cleanup.unref?.();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `${clientIp(req)}`;
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    const remaining = Math.max(0, max - bucket.count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      logger.warn(`⛔ Rate limit hit on ${name} by ${key} (${bucket.count}/${max})`);
      res.status(429).json({
        success: false,
        error: 'Too many requests. Please slow down and try again shortly.',
        retryAfter,
      });
      return;
    }

    next();
  };
}
