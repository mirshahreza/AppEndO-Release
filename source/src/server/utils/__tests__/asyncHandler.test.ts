import { describe, expect, it } from 'vitest';
import { asyncHandler, getAsyncHandlerInnerHandler } from '../asyncHandler';

describe('getAsyncHandlerInnerHandler', () => {
  it('recovers the real handler wrapped by asyncHandler', async () => {
    const realHandler = async (_req: unknown, res: { json: (v: unknown) => void }) => {
      res.json({ marker: 'real-handler-ran' });
    };
    const wrapped = asyncHandler(realHandler as never, 'fallback message');

    expect(getAsyncHandlerInnerHandler(wrapped)).toBe(realHandler);
  });

  it('returns null for a plain function that was never wrapped by asyncHandler', () => {
    const plain = (_req: unknown, res: unknown) => undefined;
    expect(getAsyncHandlerInnerHandler(plain)).toBeNull();
  });

  it('returns null for non-function input', () => {
    expect(getAsyncHandlerInnerHandler(null)).toBeNull();
    expect(getAsyncHandlerInnerHandler(undefined)).toBeNull();
    expect(getAsyncHandlerInnerHandler({})).toBeNull();
  });
});
