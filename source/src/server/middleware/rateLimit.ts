import type { NextFunction, Request, Response } from 'express';

type RateBucket = {
  count: number;
  windowStartMs: number;
};

const buckets = new Map<string, RateBucket>();

const SWEEP_INTERVAL_MS = 5 * 60_000;
const BUCKET_WINDOW_MS = 60_000;

const sweepExpiredBuckets = (): void => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStartMs >= BUCKET_WINDOW_MS) {
      buckets.delete(key);
    }
  }
};

const sweepTimer = setInterval(sweepExpiredBuckets, SWEEP_INTERVAL_MS);
sweepTimer.unref?.();

export type UserRateLimitOptions = {
  keyPrefix: string;
  maxPerMinute: number;
};

const consumeBucket = (key: string, limit: number, windowMs: number): boolean => {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStartMs >= windowMs) {
    bucket = { count: 0, windowStartMs: now };
    buckets.set(key, bucket);
  }

  bucket.count += 1;
  return bucket.count <= limit;
};

/**
 * Fixed-window per-user rate limiter (in-memory). Suitable for single-node dev/small deployments.
 */
export const createUserRateLimiter = ({ keyPrefix, maxPerMinute }: UserRateLimitOptions) => {
  const limit = Math.max(1, Math.floor(maxPerMinute));
  const windowMs = BUCKET_WINDOW_MS;

  return (req: Request, res: Response, next: NextFunction) => {
    const userId = req.auth?.userId;
    if (!userId) {
      next();
      return;
    }

    if (!consumeBucket(`${keyPrefix}:${userId}`, limit, windowMs)) {
      res.status(429).json({
        success: false,
        error: 'Too many requests. Please try again later.',
      });
      return;
    }

    next();
  };
};

/**
 * Fixed-window rate limiter keyed by an arbitrary string derived from the request (e.g. the
 * webhook token itself, or the caller's IP for routes with no per-caller identity) — for public,
 * unauthenticated endpoints where `createUserRateLimiter` is a no-op (it only keys on
 * `req.auth?.userId`, which anonymous callers never have).
 */
export const createKeyedRateLimiter = ({
  keyPrefix,
  maxPerMinute,
  keyFor,
}: {
  keyPrefix: string;
  maxPerMinute: number;
  keyFor: (req: Request) => string;
}) => {
  const limit = Math.max(1, Math.floor(maxPerMinute));
  const windowMs = BUCKET_WINDOW_MS;

  return (req: Request, res: Response, next: NextFunction) => {
    if (!consumeBucket(`${keyPrefix}:${keyFor(req)}`, limit, windowMs)) {
      res.status(429).json({
        success: false,
        error: 'Too many requests. Please try again later.',
      });
      return;
    }

    next();
  };
};
