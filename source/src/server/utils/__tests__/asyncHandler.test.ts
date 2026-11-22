import { describe, expect, it } from 'vitest';
import type { Request, Response } from 'express';
import { asyncHandler, getAsyncHandlerFallbackMessage, getAsyncHandlerInnerHandler } from '../asyncHandler';

const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

const mockRes = () => {
  const res = {
    headersSent: false,
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return res;
};

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

describe('asyncHandler request errors', () => {
  it('forwards a rejected handler to next and keeps the process alive', async () => {
    const wrapped = asyncHandler(async () => {
      throw new Error('compile failed');
    }, 'Failed to load package UI module.');
    const next = (error: unknown) => {
      seen = error;
    };
    let seen: unknown;
    wrapped({} as Request, mockRes() as unknown as Response, next as never);
    await flush();
    expect(seen).toBeInstanceOf(Error);
    expect((seen as Error).message).toBe('compile failed');
    expect(getAsyncHandlerFallbackMessage(seen)).toBe('Failed to load package UI module.');
  });

  it('responds 500 when next is missing instead of throwing', async () => {
    const wrapped = asyncHandler(async () => {
      throw new Error('compile failed');
    }, 'Failed to load package UI module.');
    const res = mockRes();
    expect(() => wrapped({} as Request, res as unknown as Response, undefined as never)).not.toThrow();
    await flush();
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ success: false, error: 'compile failed' });
  });

  it('reports a synchronous throw when next is missing', async () => {
    const wrapped = asyncHandler(() => {
      throw new Error('sync boom');
    }, 'fallback');
    const res = mockRes();
    wrapped({} as Request, res as unknown as Response, undefined as never);
    await flush();
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ success: false, error: 'sync boom' });
  });
});
