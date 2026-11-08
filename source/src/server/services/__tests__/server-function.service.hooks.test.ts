import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { ServerFunctionService, type EdgeDbQueryFn } from '../server-function.service';

const startWorkflowByName = vi.fn(async () => undefined);
vi.mock('../../domain/workflow/engine/workflowTriggerService', () => ({
  startWorkflowByName: (...args: unknown[]) => startWorkflowByName(...args),
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

describe('ServerFunctionService before/after hooks (p-68 WHOOK Part C)', () => {
  const service = new ServerFunctionService();

  it('fires the before hook with only the configured input fields, fire-and-forget', async () => {
    startWorkflowByName.mockClear();
    let resolveHook: (() => void) | undefined;
    startWorkflowByName.mockImplementation(() => new Promise((resolve) => { resolveHook = () => resolve(undefined); }));

    const req = createRequest({ body: { orderId: 42, secret: 'do-not-forward', note: 'hi' } });
    const res = createMockResponse();
    const dbQuery = vi.fn() as EdgeDbQueryFn;

    await service.execute(req, res, {
      code: 'export default async function handler(req, res) { return res.json({ ok: true }); }',
      engineType: 'SANDBOX_JS',
      managedFunction: { hooks: { before: { workflowName: 'order-hook', fields: ['orderId', 'note'] } } },
    }, dbQuery);

    expect(startWorkflowByName).toHaveBeenCalledTimes(1);
    expect(startWorkflowByName).toHaveBeenCalledWith(
      'order-hook',
      { orderId: 42, note: 'hi' },
      expect.objectContaining({ await: false, startedByType: 'SYSTEM', startType: 'SERVER_FUNCTION_HOOK' }),
    );
    // execute() already resolved above without waiting on the still-pending hook promise.
    resolveHook?.();
  });

  it('fires the after hook with only the configured output fields, once the response is known', async () => {
    startWorkflowByName.mockClear();
    startWorkflowByName.mockResolvedValue(undefined);

    const req = createRequest();
    const res = createMockResponse();
    const dbQuery = vi.fn() as EdgeDbQueryFn;

    await service.execute(req, res, {
      code: 'export default async function handler(req, res) { return res.json({ orderId: 7, total: 19.99, internal: "x" }); }',
      engineType: 'SANDBOX_JS',
      managedFunction: { hooks: { after: { workflowName: 'order-completed', fields: ['orderId', 'total'] } } },
    }, dbQuery);

    expect(startWorkflowByName).toHaveBeenCalledTimes(1);
    expect(startWorkflowByName).toHaveBeenCalledWith(
      'order-completed',
      { orderId: 7, total: 19.99 },
      expect.objectContaining({ await: false }),
    );
  });

  it('never calls the hook when none is configured', async () => {
    startWorkflowByName.mockClear();

    const req = createRequest();
    const res = createMockResponse();
    const dbQuery = vi.fn() as EdgeDbQueryFn;

    await service.execute(req, res, {
      code: 'export default async function handler(req, res) { return res.json({ ok: true }); }',
      engineType: 'SANDBOX_JS',
    }, dbQuery);

    expect(startWorkflowByName).not.toHaveBeenCalled();
  });
});
