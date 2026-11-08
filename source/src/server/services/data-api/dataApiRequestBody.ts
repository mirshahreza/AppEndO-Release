const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

const ENVELOPE_KEYS = new Set(['body', 'params']);

/**
 * Managed-function proxy may wrap JSON as `{ body, params }` or pass a flat write payload.
 * Merge nested `body` with any other top-level write fields (excluding route params).
 */
export const unwrapDataApiWriteRequestBody = (raw: unknown): Record<string, unknown> => {
  const envelope = asRecord(raw);
  const nested = asRecord(envelope.body);
  const topLevel = Object.fromEntries(
    Object.entries(envelope).filter(([key]) => !ENVELOPE_KEYS.has(key)),
  );
  return { ...nested, ...topLevel };
};
