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

describe('executeServerFunction async handler', () => {
  afterEach(async () => {
    await resetSandboxWorkerPoolForTests();
  });

  it('passes authenticated actor userId into sandbox req.auth for audit mutations', async () => {
    const code = `
async function handler(): Promise<void> {
  const actorUserId = Number(req.auth?.userId || 0);
  if (!actorUserId) {
    res.status(401).json({ success: false, error: 'Authentication required.' });
    return;
  }
  res.json({ success: true, userId: actorUserId });
}

(async () => {
  await handler();
})();
`;

    const { res, state } = createFakeRes();

    await executeServerFunction(code, createFakeReq({ method: 'POST', body: { title: 'Test' } }), res, {
      language: 'ts',
      sessionUserId: 7,
      authRoles: ['ADMIN'],
      timeoutMs: 5000,
    });

    expect(state.statusCode).toBe(200);
    expect(state.jsonBody).toEqual({ success: true, userId: 7 });
  });

  it('waits for awaited async handler before completing the response', async () => {
    const code = `
async function handler(): Promise<void> {
  const result = await db.query('SELECT 1 AS value', []);
  res.json({ success: true, data: result });
}

(async () => {
  await handler();
})();
`;

    const { res, state } = createFakeRes();
    const dbQuery = async () => ({
      data: [{ value: 1 }],
      count: 1,
      source: { id: 'ds_test', name: 'Test', type: 'SQLite' },
    });

    await executeServerFunction(code, createFakeReq(), res, {
      language: 'ts',
      dbQuery,
      timeoutMs: 5000,
    });

    expect(state.headersSent).toBe(true);
    expect(state.jsonBody).toEqual({
      success: true,
      data: {
        data: [{ value: 1 }],
        count: 1,
        source: { id: 'ds_test', name: 'Test', type: 'SQLite' },
      },
    });
  });
});
