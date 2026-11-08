import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../errors/HttpError';
import {
  ServerFunctionService,
  type EdgeDbQueryFn,
  type ManagedFunctionExecutionRecord,
} from '../server-function.service';

const createMockResponse = () => {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    headersSent: false,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      this.headersSent = true;
      return this;
    },
    send(payload: unknown) {
      this.body = payload;
      this.headersSent = true;
      return this;
    },
  };
  return res as Response & { statusCode: number; body: unknown; headersSent: boolean };
};

const createAuthRequest = (overrides: Partial<Request> = {}): Request => ({
  method: 'POST',
  path: '/api/demo/products',
  body: {},
  params: {},
  query: {},
  headers: {},
  auth: {
    userId: 1,
    email: 'admin@append.os',
    role: 'ADMIN',
    roles: ['ADMIN'],
  },
  ...overrides,
} as Request);

describe('Server Functions — comprehensive server suite', () => {
  const service = new ServerFunctionService();

  describe('engine routing', () => {
    it('routes SANDBOX_JS to sandbox VM execution', async () => {
      const req = createAuthRequest({
        method: 'GET',
        query: { hello: 'world' },
        body: { sample: true },
      });
      const res = createMockResponse();
      const dbQuery = vi.fn() as EdgeDbQueryFn;

      const code = `
        res.status(200).json({
          ok: true,
          query: req.query,
          body: req.body,
        });
      `;

      await service.execute(req, res, {
        code,
        engineType: 'SANDBOX_JS',
        language: 'js',
      }, dbQuery);

      expect(dbQuery).not.toHaveBeenCalled();
      expect(res.body).toEqual({
        ok: true,
        query: { hello: 'world' },
        body: { sample: true },
      });
    });

    it('executeManagedFunction dispatches SANDBOX_JS managed records', async () => {
      const req = createAuthRequest({ method: 'GET' });
      const res = createMockResponse();
      const dbQuery = vi.fn() as EdgeDbQueryFn;

      const managed: ManagedFunctionExecutionRecord = {
        id: 'fn-2',
        engine_type: 'SANDBOX_JS',
        code: 'res.json({ sandbox: true });',
        language: 'js',
      };

      await service.executeManagedFunction(req, res, managed, dbQuery);

      expect(dbQuery).not.toHaveBeenCalled();
      expect(res.body).toEqual({ sandbox: true });
    });
  });

  describe('SANDBOX_JS capabilities', () => {
    it('exposes db.query to sandbox code', async () => {
      const req = createAuthRequest();
      const res = createMockResponse();
      const dbQuery = vi.fn(async () => ({
        data: [{ value: 42 }],
        count: 1,
      })) as EdgeDbQueryFn;

      const code = `
        async function handler() {
          const result = await db.query('SELECT 42 AS value', []);
          res.json({ rows: result.data, count: result.count });
        }
        handler();
      `;

      await service.executeSandbox(req, res, {
        code,
        language: 'js',
      }, dbQuery);

      expect(dbQuery).toHaveBeenCalledWith('SELECT 42 AS value', [], expect.any(Object));
      expect(res.body).toEqual({ rows: [{ value: 42 }], count: 1 });
    });

    it('returns compile error for invalid TypeScript source', async () => {
      const req = createAuthRequest();
      const res = createMockResponse();
      const dbQuery = vi.fn() as EdgeDbQueryFn;

      await service.executeSandbox(req, res, {
        code: 'export type Broken = ;',
        language: 'ts',
      }, dbQuery);

      expect(res.statusCode).toBe(400);
      expect(res.body).toMatchObject({
        error: expect.stringContaining('Compile error'),
      });
    });

    it('returns runtime error for invalid JavaScript execution', async () => {
      const req = createAuthRequest();
      const res = createMockResponse();
      const dbQuery = vi.fn() as EdgeDbQueryFn;

      await service.executeSandbox(req, res, {
        code: 'throw new Error("sandbox failure");',
        language: 'js',
      }, dbQuery);

      expect(res.statusCode).toBe(500);
      expect(res.body).toMatchObject({
        error: expect.stringContaining('sandbox failure'),
      });
    });

    it('prepareExecute rejects missing code', () => {
      expect(() => service.prepareExecute({}, vi.fn() as EdgeDbQueryFn))
        .toThrow(HttpError);
    });

    it('prepareExecute applies managed settings (timeout, RAM, cache, inherit off)', () => {
      const prepared = service.prepareExecute({
        managedFunction: {
          id: 'custom.settings-probe',
          method: 'GET',
          path: '/api/custom/settings-probe',
          code: 'res.json({ ok: true });',
          language: 'js',
          runtime_version: 'v18.x',
          memory_limit: 256,
          timeout_ms: 5000,
          use_global_config: false,
          cache_enabled: true,
          cache_ttl_ms: 180000,
          cache_by_param: true,
          cache_by_user: false,
        },
      }, vi.fn() as EdgeDbQueryFn);

      expect(prepared.timeoutMs).toBe(5000);
      expect(prepared.memoryLimit).toBe(256);
      expect(prepared.runtimeVersion).toBe('v18.x');
      expect(prepared.language).toBe('js');
      expect(prepared.cache).toEqual(expect.objectContaining({
        enabled: true,
        ttlMs: 180000,
        byParam: true,
        byUser: false,
        requestMethod: 'GET',
        keyNamespace: 'GET:/api/custom/settings-probe',
      }));
    });
  });
});
