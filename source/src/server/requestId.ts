import crypto from 'crypto';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** SEC-3-3 — echo only a bounded token; otherwise mint a UUID. */
export const resolveRequestId = (incoming: unknown): string => {
  const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
  if (typeof candidate === 'string') {
    const trimmed = candidate.trim();
    if (REQUEST_ID_PATTERN.test(trimmed)) {
      return trimmed;
    }
  }
  return crypto.randomUUID();
};
