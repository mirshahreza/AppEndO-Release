import type { Request } from 'express';

/** SEC-2-1 — do not trust client-supplied forwarding headers without `trust proxy`. */
export const resolveAuthRateLimitKey = (req: Request): string => (
  req.ip || req.socket.remoteAddress || 'unknown'
);
