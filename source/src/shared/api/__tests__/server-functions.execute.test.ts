import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../authSession';
import { executeServerFunctionRequest } from '../queries/server-functions';
import type { ServerFunctionItem } from '../contracts/server-functions/types';

vi.mock('../authSession', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../authSession')>();
  return {
    ...actual,
    apiFetch: vi.fn(),
  };
});

const apiFetchMock = vi.mocked(apiFetch);

const createJsonResponse = (status: number, payload: unknown): Response => (
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
);

const sandboxFunction = (overrides: Partial<ServerFunctionItem> = {}): ServerFunctionItem => ({
  id: 'edge-sandbox-1',
  name: 'hello',
  folder: 'demo',
  method: 'GET',
  path: '/api/demo/hello',
  engineType: 'SANDBOX_JS',
  code: 'res.json({ mode: "sandbox", query: req.query });',
  language: 'js',
  runtimeVersion: 'v20.x',
  memoryLimit: 128,
  timeoutMs: 3000,
  useGlobalConfig: false,
  enableLogs: true,
  cacheEnabled: false,
  cacheTtlMs: 180000,
  cacheByParam: false,
  cacheByUser: false,
  accessControl: { allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
  testPayload: '{}',
  metadataJson: null,
  isBuiltIn: false,
  ...overrides,
});

const dataApiFunction = (overrides: Partial<ServerFunctionItem> = {}): ServerFunctionItem => (
  sandboxFunction({
    id: 'edge-data-api-1',
    name: 'testtest-list-get',
    path: '/api/testtest',
    engineType: 'DATA_API',
    code: 'import { QueryTypes } from "sequelize";',
    metadataJson: {
      origin: 'data-api',
      edgeApiDefinitionId: 'api_test',
      edgeApiOperationId: 'op_list',
    } as ServerFunctionItem['metadataJson'],
    ...overrides,
  })
);

describe('executeServerFunctionRequest', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('invokes managed route for Data API functions without sandbox execute', async () => {
    apiFetchMock.mockResolvedValue(createJsonResponse(200, {
      success: true,
      data: [{ id: 1 }],
      count: 1,
      meta: { page: 1, pageSize: 10 },
    }));

    const { data, response } = await executeServerFunctionRequest({
      activeFn: dataApiFunction(),
      parsedPayload: { query: { page: 1, pageSize: 10 } },
      vmMode: 'v20.x',
      runRam: 128,
      runTimeout: 3000,
      requestMethod: 'GET',
    });

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(apiFetchMock).toHaveBeenCalledOnce();

    const [url, init] = apiFetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain('/api/testtest?page=1&pageSize=10');
    expect(String(url)).not.toContain('/api/core/server-functions/execute');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect((init.headers as Record<string, string> | undefined)?.['x-append-datasource-id']).toBeUndefined();
    expect((init.headers as Record<string, string> | undefined)?.['x-append-database']).toBeUndefined();
  });

  it('posts to /api/core/server-functions/execute for SANDBOX_JS functions', async () => {
    apiFetchMock.mockResolvedValue(createJsonResponse(200, {
      success: true,
      ok: true,
    }));

    const { data, response } = await executeServerFunctionRequest({
      activeFn: sandboxFunction(),
      parsedPayload: { query: { name: 'world' } },
      vmMode: 'v20.x',
      runRam: 128,
      runTimeout: 3000,
      requestMethod: 'GET',
    });

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    const [url, init] = apiFetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain('/api/core/server-functions/execute');
    expect(init.method).toBe('POST');

    const body = JSON.parse(String(init.body));
    expect(body.engineType).toBe('SANDBOX_JS');
    expect(body.code).toContain('sandbox');
    expect(body.query).toEqual({ name: 'world' });
    expect(body.dbContext).toBeUndefined();
  });

  it('posts Data API mutation body to the managed route', async () => {
    apiFetchMock.mockResolvedValue(createJsonResponse(200, { success: true, data: [], count: 0 }));

    await executeServerFunctionRequest({
      activeFn: dataApiFunction({
        path: '/api/demo/create-product',
        method: 'POST',
      }),
      parsedPayload: {
        body: { sku: 'EL-1', name: 'Gadget' },
      },
      vmMode: 'v20.x',
      runRam: 128,
      runTimeout: 3000,
      requestMethod: 'POST',
    });

    const [, init] = apiFetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      sku: 'EL-1',
      name: 'Gadget',
    });
  });

  it('surfaces HTTP errors from managed routes', async () => {
    apiFetchMock.mockResolvedValue(createJsonResponse(400, {
      success: false,
      error: 'Function argument validation failed.',
    }));

    const { data } = await executeServerFunctionRequest({
      activeFn: dataApiFunction(),
      parsedPayload: { query: {} },
      vmMode: 'v20.x',
      runRam: 128,
      runTimeout: 3000,
      requestMethod: 'GET',
    });

    expect(data.success).toBe(false);
    expect(data.error).toContain('validation failed');
    expect(data._httpStatus).toBe(400);
  });
});
