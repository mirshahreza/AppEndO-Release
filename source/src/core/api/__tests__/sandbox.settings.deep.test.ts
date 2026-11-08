import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeServerFunction } from '../sandbox';
import { resetSandboxWorkerPoolForTests } from '../sandboxWorkerPool';
import { cacheManager } from '../../cache/CacheManager';
import { buildEdgeResponseCacheKey } from '../../../shared/lib/cacheKeyFormat';

type FakeReq = {
  body: Record<string, unknown>;
  query: Record<string, unknown>;
  params: Record<string, string>;
  method: string;
  headers: Record<string, string>;
};

type FakeResState = {
  statusCode: number;
  jsonBody: unknown;
  headersSent: boolean;
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
  const state: FakeResState = {
    statusCode: 200,
    jsonBody: undefined,
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

describe('Server Function settings — deep runtime behavior', () => {
  beforeEach(async () => {
    await cacheManager.updateSettings({
      isEnabled: true,
      driver: 'memory',
      defaultTtl: 60,
    });
    await cacheManager.clearAll();
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    await resetSandboxWorkerPoolForTests();
  });

  describe('timeoutMs', () => {
    it('fails when sandbox work exceeds the configured timeout', async () => {
      const req = createFakeReq();
      const { res, state } = createFakeRes();

      await executeServerFunction(
        'while (true) {}',
        req,
        res,
        {
          language: 'js',
          timeoutMs: 100,
          memoryLimit: 64,
        },
      );

      expect(state.statusCode).toBe(500);
      expect(state.jsonBody).toMatchObject({
        error: expect.stringMatching(/timed out|timeout|Script execution/i),
      });
    }, 20000);

    it('succeeds when work finishes within the configured timeout', async () => {
      const req = createFakeReq();
      const { res, state } = createFakeRes();

      await executeServerFunction(
        'res.json({ ok: true, sum: 2 + 2 });',
        req,
        res,
        {
          language: 'js',
          timeoutMs: 1000,
          memoryLimit: 64,
        },
      );

      expect(state.statusCode).toBe(200);
      expect(state.jsonBody).toEqual({ ok: true, sum: 4 });
    });
  });

  describe('edge response caching', () => {
    const runCached = async (
      marker: string,
      cache: {
        enabled: boolean;
        ttlMs?: number;
        byParam?: boolean;
        byUser?: boolean;
        actorId?: string;
      },
      query: Record<string, unknown> = { token: 'same' },
    ) => {
      const req = createFakeReq({
        query,
        headers: { 'x-run-marker': marker },
      });
      const { res, state } = createFakeRes();

      await executeServerFunction(
        `res.json({ marker: req.headers['x-run-marker'], token: req.query?.token ?? null });`,
        req,
        res,
        {
          language: 'js',
          timeoutMs: 3000,
          memoryLimit: 64,
          cache: {
            enabled: cache.enabled,
            requestMethod: 'GET',
            ttlMs: cache.ttlMs ?? 180000,
            byParam: cache.byParam ?? false,
            byUser: cache.byUser ?? false,
            keyNamespace: 'GET:/api/settings-deep',
            actorId: cache.actorId,
            requestParams: req.params,
            requestQuery: req.query,
          },
        },
      );

      return state;
    };

    it('does not reuse responses when cache is disabled', async () => {
      const first = await runCached('run-1', { enabled: false });
      const second = await runCached('run-2', { enabled: false });

      expect(first.jsonBody).toEqual({ marker: 'run-1', token: 'same' });
      expect(second.jsonBody).toEqual({ marker: 'run-2', token: 'same' });
    });

    it('persists successful GET responses with TTL derived from cacheTtlMs seconds', async () => {
      const setSpy = vi.spyOn(cacheManager, 'set');

      const first = await runCached('run-1', { enabled: true, ttlMs: 240000 });
      expect(first.jsonBody).toEqual({ marker: 'run-1', token: 'same' });
      expect(setSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          statusCode: 200,
          body: { marker: 'run-1', token: 'same' },
        }),
        240,
      );

      const second = await runCached('run-2', { enabled: true, ttlMs: 240000 });
      expect(second.jsonBody).toEqual({ marker: 'run-1', token: 'same' });
    });

    it('expires cached responses after TTL elapses', async () => {
      const first = await runCached('before-expiry', { enabled: true, ttlMs: 1000 });
      expect(first.jsonBody).toEqual({ marker: 'before-expiry', token: 'same' });

      const cacheKey = buildEdgeResponseCacheKey({
        keyNamespace: 'GET:/api/settings-deep',
        byParam: false,
        byUser: false,
        requestParams: {},
        requestQuery: { token: 'same' },
      });

      expect(await cacheManager.get(cacheKey)).not.toBeNull();

      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 1500);
      expect(await cacheManager.get(cacheKey)).toBeNull();
      vi.useRealTimers();

      const second = await runCached('after-expiry', { enabled: true, ttlMs: 1000 });
      expect(second.jsonBody).toEqual({ marker: 'after-expiry', token: 'same' });
    });

    it('does not cache non-2xx responses', async () => {
      const setSpy = vi.spyOn(cacheManager, 'set');
      const req = createFakeReq();
      const { res, state } = createFakeRes();

      await executeServerFunction(
        'res.status(500).json({ error: "boom" });',
        req,
        res,
        {
          language: 'js',
          timeoutMs: 3000,
          memoryLimit: 64,
          cache: {
            enabled: true,
            requestMethod: 'GET',
            ttlMs: 180000,
            keyNamespace: 'GET:/api/settings-deep-error',
          },
        },
      );

      expect(state.statusCode).toBe(500);
      expect(setSpy).not.toHaveBeenCalled();
    });
  });

  describe('source language', () => {
    it('compiles and executes TypeScript source when language is ts', async () => {
      const req = createFakeReq();
      const { res, state } = createFakeRes();

      await executeServerFunction(
        `
          const value: number = 21;
          res.json({ doubled: value * 2 });
        `,
        req,
        res,
        {
          language: 'ts',
          runtimeVersion: 'v20.x',
          timeoutMs: 3000,
          memoryLimit: 64,
        },
      );

      expect(state.statusCode).toBe(200);
      expect(state.jsonBody).toEqual({ doubled: 42 });
    });
  });

  describe('memoryLimit', () => {
    it('allows lightweight work under a 64MB cap', async () => {
      const req = createFakeReq();
      const { res, state } = createFakeRes();

      await executeServerFunction(
        'res.json({ ok: true });',
        req,
        res,
        {
          language: 'js',
          memoryLimit: 64,
          timeoutMs: 3000,
        },
      );

      expect(state.statusCode).toBe(200);
      expect(state.jsonBody).toEqual({ ok: true });
    });
  });
});
