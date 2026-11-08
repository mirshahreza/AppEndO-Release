import type { Request, Response } from 'express';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { ServerFunctionService, type EdgeDbQueryFn } from '../server-function.service';
import { resetSandboxWorkerPoolForTests } from '../../../core/api/sandboxWorkerPool';

const findHttpConnectionRecordByName = vi.fn();
const callHttpConnection = vi.fn();
vi.mock('../http-connections/httpConnectionStore', () => ({
  findHttpConnectionRecordByName: (...args: Parameters<typeof findHttpConnectionRecordByName>) => findHttpConnectionRecordByName(...args),
}));
vi.mock('../http-connections/httpConnectionExecutor', () => ({
  callHttpConnection: (...args: Parameters<typeof callHttpConnection>) => callHttpConnection(...args),
}));

const createMockResponse = () => {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as Response & { statusCode: number; body: unknown };
};

const createRequest = (overrides: Partial<Request> = {}): Request => ({
  method: 'POST',
  path: '/api/core/server-functions/execute',
  body: {},
  params: {},
  query: {},
  ...overrides,
} as Request);

describe('sandboxEnv.connectors bridge (PDK-8, calling an HTTP Connection from Server Function code)', () => {
  const service = new ServerFunctionService();

  afterAll(async () => {
    await resetSandboxWorkerPoolForTests();
  });

  it('connectors.call() resolves inside the sandbox with the real executor result', async () => {
    findHttpConnectionRecordByName.mockReturnValue({ id: 'conn-1', name: 'GitHub' });
    callHttpConnection.mockResolvedValue({ status: 200, headers: {}, body: { login: 'octocat' }, truncated: false });

    const req = createRequest();
    const res = createMockResponse();
    const dbQuery = vi.fn() as EdgeDbQueryFn;

    await service.execute(req, res, {
      code: `export default async function handler(req, res) {
        const result = await connectors.call('GitHub', 'getUser', { pathParams: { username: 'octocat' } });
        return res.json({ login: result.body.login });
      }`,
      engineType: 'SANDBOX_JS',
    }, dbQuery);

    expect(res.body).toEqual({ login: 'octocat' });
    expect(findHttpConnectionRecordByName).toHaveBeenCalledWith('GitHub');
    expect(callHttpConnection).toHaveBeenCalledWith(
      { id: 'conn-1', name: 'GitHub' },
      { operationId: 'getUser', pathParams: { username: 'octocat' } },
    );
  });

  it('rejects inside the sandbox when the connection name is unknown', async () => {
    findHttpConnectionRecordByName.mockReturnValue(null);

    const req = createRequest();
    const res = createMockResponse();
    const dbQuery = vi.fn() as EdgeDbQueryFn;

    await service.execute(req, res, {
      code: `export default async function handler(req, res) {
        try {
          await connectors.call('DoesNotExist', 'op', {});
          return res.json({ ok: true });
        } catch (error) {
          return res.status(500).json({ ok: false, message: error.message });
        }
      }`,
      engineType: 'SANDBOX_JS',
    }, dbQuery);

    expect(res.statusCode).toBe(500);
    expect((res.body as { message: string }).message).toMatch(/No HTTP Connection named "DoesNotExist"/);
  });

  it('rejects inside the sandbox when no connector capability is wired at all', async () => {
    const req = createRequest();
    const res = createMockResponse();
    const { executeServerFunction } = await import('../../../core/api/sandbox');
    await executeServerFunction(
      `export default async function handler(req, res) {
        try {
          await connectors.call('anything', 'op', {});
          return res.json({ ok: true });
        } catch (error) {
          return res.status(500).json({ ok: false, message: error.message });
        }
      }`,
      req,
      res,
      {},
    );

    expect(res.statusCode).toBe(500);
    expect((res.body as { message: string }).message).toMatch(/HTTP Connections capability/i);
  });
});
