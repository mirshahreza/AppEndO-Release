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
  const state = { statusCode: 200, jsonBody: undefined as unknown, headersSent: false };
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

describe('Server Function sandbox util global', () => {
  afterEach(async () => {
    await resetSandboxWorkerPoolForTests();
  });

  it('util.regexMatch is available and matches against a pattern', async () => {
    const { res, state } = createFakeRes();
    await executeServerFunction(
      "res.json(util.regexMatch('(\\\\w+)@(\\\\w+)', 'contact: ada@example', { flags: 'i' }));",
      createFakeReq(),
      res,
      { language: 'js', timeoutMs: 3000 },
    );
    expect(state.statusCode).toBe(200);
    expect(state.jsonBody).toMatchObject({
      ok: true,
      matched: true,
      matches: [{ match: 'ada@example', groups: ['ada', 'example'] }],
    });
  });

  it('util.regexMatch never hangs on a catastrophic-backtracking pattern (RE2-backed)', async () => {
    const { res, state } = createFakeRes();
    const start = Date.now();
    await executeServerFunction(
      "res.json(util.regexMatch('(a+)+b', 'a'.repeat(64) + 'c'));",
      createFakeReq(),
      res,
      { language: 'js', timeoutMs: 3000 },
    );
    expect(Date.now() - start).toBeLessThan(3000);
    expect(state.jsonBody).toEqual({ ok: true, matched: false, matches: [] });
  });

  it('util.validateSchema validates a value against a JSON Schema', async () => {
    const { res, state } = createFakeRes();
    await executeServerFunction(
      `
        const schema = { type: 'object', properties: { a: { type: 'number' } }, required: ['a'] };
        res.json({
          valid: util.validateSchema(schema, { a: 1 }),
          invalid: util.validateSchema(schema, { a: 'x' }),
        });
      `,
      createFakeReq(),
      res,
      { language: 'js', timeoutMs: 3000 },
    );
    expect(state.statusCode).toBe(200);
    expect((state.jsonBody as { valid: unknown }).valid).toEqual({ valid: true });
    expect((state.jsonBody as { invalid: { valid: boolean } }).invalid.valid).toBe(false);
  });

  it('sandbox require() is available for developer libraries', async () => {
    const { res, state } = createFakeRes();
    await executeServerFunction(
      "res.json({ hasRequire: typeof require === 'function' });",
      createFakeReq(),
      res,
      { language: 'js', timeoutMs: 3000 },
    );
    expect(state.jsonBody).toEqual({ hasRequire: true });
  });
});
