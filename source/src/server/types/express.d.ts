import type { AuthRequestContext } from '../middleware/auth.middleware';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthRequestContext;
      requestId?: string;
      /** PDK-7 — set when `auth` was temporarily swapped to an impersonated actor for this request. */
      impersonatorId?: number;
    }
  }
}

export {};
