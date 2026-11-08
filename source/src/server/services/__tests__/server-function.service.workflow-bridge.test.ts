import type { Request, Response } from 'express';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { ServerFunctionService, type EdgeDbQueryFn } from '../server-function.service';
import { resetSandboxWorkerPoolForTests } from '../../../core/api/sandboxWorkerPool';

const startWorkflowByName = vi.fn(async (_name: string, _input: unknown, options: { await: boolean }) => (
  options.await ? { instance: { id: 99 } } : undefined
));
vi.mock('../../domain/workflow/engine/workflowTriggerService', () => ({
  startWorkflowByName: (...args: Parameters<typeof startWorkflowByName>) => startWorkflowByName(...args),
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

describe('sandboxEnv.workflow bridge (p-68 WHOOK Part B, direct-call utility inside Server Function code)', () => {
  const service = new ServerFunctionService();

  afterAll(async () => {
    await resetSandboxWorkerPoolForTests();
  });

  it('workflow.startAndWait() resolves inside the sandbox with the real started instance', async () => {
    startWorkflowByName.mockClear();
    const req = createRequest();
    const res = createMockResponse();
    const dbQuery = vi.fn() as EdgeDbQueryFn;

    await service.execute(req, res, {
      code: `export default async function handler(req, res) {
        const result = await workflow.startAndWait('order-completed', { orderId: 1 });
        return res.json({ instanceId: result.instance.id });
      }`,
      engineType: 'SANDBOX_JS',
    }, dbQuery);

    expect(res.body).toEqual({ instanceId: 99 });
    expect(startWorkflowByName).toHaveBeenCalledWith('order-completed', { orderId: 1 }, { await: true, startedByType: 'SYSTEM', startType: 'SERVER_FUNCTION_DIRECT_CALL' });
  });

  it('workflow.start() is fire-and-forget and does not block the sandbox response', async () => {
    startWorkflowByName.mockClear();
    const req = createRequest();
    const res = createMockResponse();
    const dbQuery = vi.fn() as EdgeDbQueryFn;

    await service.execute(req, res, {
      code: `export default async function handler(req, res) {
        await workflow.start('notify-ops', { level: 'info' });
        return res.json({ ok: true });
      }`,
      engineType: 'SANDBOX_JS',
    }, dbQuery);

    expect(res.body).toEqual({ ok: true });
    expect(startWorkflowByName).toHaveBeenCalledWith('notify-ops', { level: 'info' }, { await: false, startedByType: 'SYSTEM', startType: 'SERVER_FUNCTION_DIRECT_CALL' });
  });

  it('rejects inside the sandbox when the workflow-trigger capability is not wired (no silent mock)', async () => {
    const req = createRequest();
    const res = createMockResponse();
    // No `dbQuery`/`startWorkflow` bridge is threaded through this raw sandbox.ts call — simulates
    // an execution path that never wires the workflow capability at all.
    const { executeServerFunction } = await import('../../../core/api/sandbox');
    await executeServerFunction(
      `export default async function handler(req, res) {
        try {
          await workflow.start('whatever', {});
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
    expect((res.body as { ok: boolean }).ok).toBe(false);
    expect((res.body as { message: string }).message).toMatch(/workflow-trigger capability/i);
  });
});
