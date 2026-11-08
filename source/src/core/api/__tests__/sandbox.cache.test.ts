import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { executeServerFunction } from '../sandbox';
import { resetSandboxWorkerPoolForTests } from '../sandboxWorkerPool';
import { cacheManager } from '../../cache/CacheManager';

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
  sendBody: unknown;
  headersSent: boolean;
};

const createFakeReq = (overrides: Partial<FakeReq> = {}): FakeReq => ({
  body: {},
  query: {},
  params: {},
  method: 'POST',
  headers: {},
  ...overrides,
});

const createFakeRes = () => {
  const state: FakeResState = {
    statusCode: 200,
    jsonBody: undefined,
    sendBody: undefined,
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
      state.sendBody = payload;
      state.headersSent = true;
      return payload;
    },
    get headersSent() {
      return state.headersSent;
    },
  };

  return { res, state };
};

const EDGE_CODE = `
res.status(200).json({
  token: req.query?.token ?? null,
  requestMarker: req.headers?.['x-run-marker'] ?? null,
});
`;

const executeOnce = async (
  token: string,
  cacheOptions: {
    enabled: boolean;
    requestMethod: string;
    ttlMs?: number;
    byParam?: boolean;
    byUser?: boolean;
    keyNamespace: string;
    actorId?: string;
  },
  marker: string,
) => {
  const req = createFakeReq({
    query: { token },
    method: 'POST',
    headers: { 'x-run-marker': marker },
  });
  const { res, state } = createFakeRes();

  await executeServerFunction(EDGE_CODE, req, res, {
    language: 'js',
    cache: {
      enabled: cacheOptions.enabled,
      requestMethod: cacheOptions.requestMethod,
      ttlMs: cacheOptions.ttlMs ?? 180000,
      byParam: cacheOptions.byParam,
      byUser: cacheOptions.byUser,
      keyNamespace: cacheOptions.keyNamespace,
      actorId: cacheOptions.actorId,
      requestParams: req.params,
      requestQuery: req.query,
    },
  });

  return state;
};

describe('executeServerFunction cache policy', () => {
  beforeEach(async () => {
    await cacheManager.updateSettings({
      isEnabled: true,
      driver: 'memory',
      defaultTtl: 60,
    });
    await cacheManager.clearAll();
  });

  afterEach(async () => {
    await resetSandboxWorkerPoolForTests();
  });

  it('reuses cached response when cache is enabled and byParam is false', async () => {
    const first = await executeOnce('alpha', {
      enabled: true,
      requestMethod: 'GET',
      byParam: false,
      byUser: false,
      keyNamespace: 'fn:get-items',
    }, 'run-1');

    const second = await executeOnce('beta', {
      enabled: true,
      requestMethod: 'GET',
      byParam: false,
      byUser: false,
      keyNamespace: 'fn:get-items',
    }, 'run-2');

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(first.jsonBody).toEqual({ token: 'alpha', requestMarker: 'run-1' });
    expect(second.jsonBody).toEqual({ token: 'alpha', requestMarker: 'run-1' });
  });

  it('creates separate cache entries when byParam is true', async () => {
    const first = await executeOnce('alpha', {
      enabled: true,
      requestMethod: 'GET',
      byParam: true,
      byUser: false,
      keyNamespace: 'fn:get-items',
    }, 'run-1');

    const second = await executeOnce('beta', {
      enabled: true,
      requestMethod: 'GET',
      byParam: true,
      byUser: false,
      keyNamespace: 'fn:get-items',
    }, 'run-2');

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(first.jsonBody).toEqual({ token: 'alpha', requestMarker: 'run-1' });
    expect(second.jsonBody).toEqual({ token: 'beta', requestMarker: 'run-2' });
  });

  it('creates separate cache entries when byUser is true', async () => {
    const userAFirst = await executeOnce('same-token', {
      enabled: true,
      requestMethod: 'GET',
      byParam: false,
      byUser: true,
      keyNamespace: 'fn:get-items',
      actorId: 'user-a',
    }, 'user-a-first');

    const userB = await executeOnce('same-token', {
      enabled: true,
      requestMethod: 'GET',
      byParam: false,
      byUser: true,
      keyNamespace: 'fn:get-items',
      actorId: 'user-b',
    }, 'user-b-first');

    const userASecond = await executeOnce('same-token', {
      enabled: true,
      requestMethod: 'GET',
      byParam: false,
      byUser: true,
      keyNamespace: 'fn:get-items',
      actorId: 'user-a',
    }, 'user-a-second');

    expect(userAFirst.jsonBody).toEqual({ token: 'same-token', requestMarker: 'user-a-first' });
    expect(userB.jsonBody).toEqual({ token: 'same-token', requestMarker: 'user-b-first' });
    expect(userASecond.jsonBody).toEqual({ token: 'same-token', requestMarker: 'user-a-first' });
  });

  it('does not cache non-GET edge methods even when enabled', async () => {
    const first = await executeOnce('alpha', {
      enabled: true,
      requestMethod: 'POST',
      byParam: false,
      byUser: false,
      keyNamespace: 'fn:post-items',
    }, 'post-run-1');

    const second = await executeOnce('beta', {
      enabled: true,
      requestMethod: 'POST',
      byParam: false,
      byUser: false,
      keyNamespace: 'fn:post-items',
    }, 'post-run-2');

    expect(first.jsonBody).toEqual({ token: 'alpha', requestMarker: 'post-run-1' });
    expect(second.jsonBody).toEqual({ token: 'beta', requestMarker: 'post-run-2' });
  });
});
