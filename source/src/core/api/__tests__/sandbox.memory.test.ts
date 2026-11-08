import { afterEach, describe, expect, it } from 'vitest';
import { executeServerFunction } from '../sandbox';
import { resetSandboxWorkerPoolForTests } from '../sandboxWorkerPool';

type FakeReq = {
  body: Record<string, unknown>;
  query: Record<string, unknown>;
  params: Record<string, string>;
  method: string;
  headers: Record<string, string>;
};

const createFakeReq = (overrides: Partial<FakeReq> = {}): FakeReq => ({
  body: {},
  query: {},
  params: {},
  method: 'GET',
  headers: {},
  ...overrides,
});

const createFakeRes = () => {
  const state = {
    statusCode: 200,
    jsonBody: undefined as unknown,
    headersSent: false,
  };

  const res = {
    status: (statusCode: number) => {
      state.statusCode = statusCode;
      return res;
    },
    json: (payload: unknown) => {
      state.jsonBody = payload;
      state.headersSent = true;
      return payload;
    },
    send: (payload: unknown) => {
      state.jsonBody = payload;
      state.headersSent = true;
      return payload;
    },
    get headersSent() {
      return state.headersSent;
    },
  };

  return { res, state };
};

describe('executeServerFunction memory limits', () => {
  afterEach(async () => {
    await resetSandboxWorkerPoolForTests();
  });

  it('returns a graceful memory-limit failure when allocation exceeds the worker cap', async () => {
    const req = createFakeReq();
    const { res, state } = createFakeRes();

    await executeServerFunction(
      `
        const blocks = [];
        while (true) {
          blocks.push(new Array(1024 * 1024).fill(0));
        }
      `,
      req,
      res,
      {
        language: 'js',
        memoryLimit: 64,
        timeoutMs: 3000,
      },
    );

    expect(state.statusCode).toBe(500);
    expect(state.jsonBody).toMatchObject({
      error: expect.stringMatching(/Memory limit exceeded \(64MB\)|heap|resource limits|Worker exited/i),
    });
  }, 20000);

  it('still executes lightweight sandbox code within the configured memory cap', async () => {
    const req = createFakeReq();
    const { res, state } = createFakeRes();

    await executeServerFunction(
      'res.json({ ok: true, value: 1 + 1 });',
      req,
      res,
      {
        language: 'js',
        memoryLimit: 64,
        timeoutMs: 3000,
      },
    );

    expect(state.statusCode).toBe(200);
    expect(state.jsonBody).toEqual({ ok: true, value: 2 });
  });
});
