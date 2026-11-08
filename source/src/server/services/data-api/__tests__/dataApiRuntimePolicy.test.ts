import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../core/cache/CacheManager', () => ({
  cacheManager: {
    get: vi.fn(),
    set: vi.fn(),
    invalidateByPrefix: vi.fn(),
  },
}));

vi.mock('../../resolveServerFunctionRuntimeConfig', () => ({
  resolveServerFunctionRuntimeConfig: vi.fn(() => ({
    timeoutMs: 30_000,
    memoryLimit: 128,
    runtimeVersion: 'v20.x',
    language: 'ts',
    enableLogs: false,
    cache: {
      enabled: false,
      ttlMs: 300_000,
      byParam: true,
      byUser: false,
    },
  })),
  runtimeConfigInputFromManagedRecord: vi.fn((record: Record<string, unknown>) => record),
}));

vi.mock('../../workflow/workflowHookFiring', () => ({
  fireServerFunctionHook: vi.fn(),
}));

vi.mock('../edgeApiStore', () => ({
  listEdgeApiDefinitions: vi.fn(() => []),
}));

vi.mock('../edgeModelStore', () => ({
  listEdgeModels: vi.fn(() => []),
}));

vi.mock('../../record-policy/recordPolicyBindingStore', () => ({
  getRecordPolicyBindingOrDefault: vi.fn(() => ({ recordScope: 'optional' })),
}));

vi.mock('../../record-policy/recordPolicyStore', () => ({
  listRecordPoliciesForModel: vi.fn(() => []),
  listEnabledRecordPoliciesForModel: vi.fn(() => []),
}));

vi.mock('../../record-policy/sessionScope.service', () => ({
  resolveSessionScope: vi.fn(),
}));

vi.mock('../../attributes/sessionContext.service', () => ({
  getSessionContextForUser: vi.fn(),
}));

import type { Request, Response } from 'express';
import * as cacheKeyFormat from '../../../../shared/lib/cacheKeyFormat';
const { buildEdgeResponseCacheKey } = cacheKeyFormat;
import { cacheManager } from '../../../../core/cache/CacheManager';
import {
  finalizeDataApiRuntime,
  invalidateDataApiCachesForSchemaObject,
  invalidateDataApiDefinitionCache,
  prepareDataApiRuntime,
} from '../dataApiRuntimePolicy';
import type { EdgeApiDefinition } from '../../../../shared/api/contracts/data-api';
import type { ManagedFunctionExecutionRecord } from '../../server-function.service';
import { listEdgeApiDefinitions } from '../edgeApiStore';
import { listEdgeModels } from '../edgeModelStore';
import { resolveServerFunctionRuntimeConfig } from '../../resolveServerFunctionRuntimeConfig';
import { fireServerFunctionHook } from '../../workflow/workflowHookFiring';

const definition = {
  id: 'ea_ed1387bd0113b3ca',
  edgeModelId: 'em_orders',
  runtime: { hooks: {} },
} as EdgeApiDefinition;

const record = {
  id: 'cms-contents.cms-contents-delete',
  hooks: {},
} as ManagedFunctionExecutionRecord;

describe('invalidateDataApiDefinitionCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cacheManager.invalidateByPrefix).mockResolvedValue(2);
  });

  it('invalidates the data-api definition key prefix', async () => {
    const prefix = buildEdgeResponseCacheKey({
      keyNamespace: `data-api:${definition.id}`,
    });

    await invalidateDataApiDefinitionCache(definition.id);

    expect(cacheManager.invalidateByPrefix).toHaveBeenCalledWith(prefix);
  });

  it('no-ops for an empty definition id', async () => {
    await invalidateDataApiDefinitionCache('  ');
    expect(cacheManager.invalidateByPrefix).not.toHaveBeenCalled();
  });
});

describe('invalidateDataApiCachesForSchemaObject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cacheManager.invalidateByPrefix).mockResolvedValue(1);
    vi.mocked(listEdgeModels).mockReturnValue([
      {
        id: 'em_cms',
        dataSourceId: 'ds_1',
        objectName: 'cms_contents',
      } as never,
      {
        id: 'em_other',
        dataSourceId: 'ds_1',
        objectName: 'other_table',
      } as never,
    ]);
    vi.mocked(listEdgeApiDefinitions).mockReturnValue([
      { id: 'ea_cms', edgeModelId: 'em_cms' } as never,
      { id: 'ea_other', edgeModelId: 'em_other' } as never,
    ]);
  });

  it('invalidates only APIs bound to the truncated model', async () => {
    await invalidateDataApiCachesForSchemaObject({
      dataSourceId: 'ds_1',
      objectName: 'cms_contents',
    });

    expect(cacheManager.invalidateByPrefix).toHaveBeenCalledTimes(1);
    expect(cacheManager.invalidateByPrefix).toHaveBeenCalledWith(
      buildEdgeResponseCacheKey({ keyNamespace: 'data-api:ea_cms' }),
    );
  });

  it('no-ops when no edge model matches', async () => {
    await invalidateDataApiCachesForSchemaObject({
      dataSourceId: 'ds_missing',
      objectName: 'cms_contents',
    });
    expect(cacheManager.invalidateByPrefix).not.toHaveBeenCalled();
  });
});

describe('finalizeDataApiRuntime write invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cacheManager.invalidateByPrefix).mockResolvedValue(1);
  });

  it('clears definition GET cache after a successful DELETE even when write is uncached', async () => {
    const req = { method: 'DELETE' } as never;
    const res = { statusCode: 200 } as never;

    await finalizeDataApiRuntime(req, res, {
      definition,
      record,
      timeoutMs: 30_000,
      cacheEnabled: false,
    }, { success: true, data: { deleted: 1 } });

    expect(cacheManager.invalidateByPrefix).toHaveBeenCalledWith(
      buildEdgeResponseCacheKey({ keyNamespace: `data-api:${definition.id}` }),
    );
    expect(cacheManager.set).not.toHaveBeenCalled();
  });

  it('does not invalidate on GET', async () => {
    const req = { method: 'GET' } as never;
    const res = { statusCode: 200 } as never;

    await finalizeDataApiRuntime(req, res, {
      definition,
      record,
      timeoutMs: 30_000,
      cacheEnabled: false,
    }, { success: true, data: [] });

    expect(cacheManager.invalidateByPrefix).not.toHaveBeenCalled();
  });

  it('does not invalidate on failed mutation status', async () => {
    const req = { method: 'DELETE' } as never;
    const res = { statusCode: 404 } as never;

    await finalizeDataApiRuntime(req, res, {
      definition,
      record,
      timeoutMs: 30_000,
      cacheEnabled: false,
    }, { success: false, error: 'Record not found.' });

    expect(cacheManager.invalidateByPrefix).not.toHaveBeenCalled();
  });
});

const createRuntimeResponse = () => {
  const listeners = new Map<string, Array<() => void>>();
  const res = {
    headersSent: false,
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      this.headersSent = true;
      return this;
    },
    on(event: string, handler: () => void) {
      const bucket = listeners.get(event) ?? [];
      bucket.push(handler);
      listeners.set(event, bucket);
      return this;
    },
  };
  return res as Response & { statusCode: number; body: unknown; headersSent: boolean };
};

describe('prepareDataApiRuntime / finalizeDataApiRuntime parity (SEA-4.8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveServerFunctionRuntimeConfig).mockReturnValue({
      timeoutMs: 30_000,
      memoryLimit: 128,
      runtimeVersion: 'v20.x',
      language: 'ts',
      enableLogs: false,
      cache: {
        enabled: false,
        ttlMs: 300_000,
        byParam: true,
        byUser: false,
      },
    } as never);
  });

  it('fires hooks.before without blocking the request', async () => {
    const hookedDefinition = {
      ...definition,
      runtime: {
        hooks: {
          before: { workflowName: 'orders-before', fields: ['orderId'] },
        },
      },
    } as EdgeApiDefinition;

    const req = {
      method: 'GET',
      body: { orderId: 42, secret: 'x' },
      params: {},
      query: {},
      auth: { userId: 7, email: 'a@b.c' },
    } as Request;
    const res = createRuntimeResponse();

    const context = await prepareDataApiRuntime(req, res, hookedDefinition, record);

    expect(context).not.toBeNull();
    expect(fireServerFunctionHook).toHaveBeenCalledWith(
      { workflowName: 'orders-before', fields: ['orderId'] },
      { orderId: 42, secret: 'x' },
    );
  });

  it('returns cached GET body on cache hit and skips executor context', async () => {
    vi.mocked(resolveServerFunctionRuntimeConfig).mockReturnValue({
      timeoutMs: 30_000,
      memoryLimit: 128,
      runtimeVersion: 'v20.x',
      language: 'ts',
      enableLogs: false,
      cache: {
        enabled: true,
        ttlMs: 60_000,
        byParam: true,
        byUser: true,
      },
    } as never);
    vi.mocked(cacheManager.get).mockResolvedValue({
      statusCode: 200,
      body: { success: true, data: [{ id: 1 }], cached: true },
    });

    const req = {
      method: 'GET',
      body: {},
      params: {},
      query: { page: '1' },
      auth: { userId: 7, email: 'a@b.c' },
    } as Request;
    const res = createRuntimeResponse();

    const context = await prepareDataApiRuntime(req, res, definition, record);

    expect(context).toBeNull();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, data: [{ id: 1 }], cached: true });
    expect(cacheManager.get).toHaveBeenCalledOnce();
  });

  it('skips cached GET body when noCache=1 but still returns cache context for write-through', async () => {
    vi.mocked(resolveServerFunctionRuntimeConfig).mockReturnValue({
      timeoutMs: 30_000,
      memoryLimit: 128,
      runtimeVersion: 'v20.x',
      language: 'ts',
      enableLogs: false,
      cache: {
        enabled: true,
        ttlMs: 60_000,
        byParam: true,
        byUser: true,
      },
    } as never);
    vi.mocked(cacheManager.get).mockResolvedValue({
      statusCode: 200,
      body: { success: true, data: [{ id: 1 }], cached: true },
    });

    const req = {
      method: 'GET',
      body: {},
      params: {},
      query: { page: '1', noCache: '1' },
      auth: { userId: 7, email: 'a@b.c' },
    } as Request;
    const res = createRuntimeResponse();

    const context = await prepareDataApiRuntime(req, res, definition, record);

    expect(context).toEqual(expect.objectContaining({ cacheEnabled: true }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toBeFalsy();
    expect(cacheManager.get).toHaveBeenCalledOnce();
  });

  it('builds a cache key on miss when cacheByUser/cacheByParam are enabled', async () => {
    vi.mocked(resolveServerFunctionRuntimeConfig).mockReturnValue({
      timeoutMs: 30_000,
      memoryLimit: 128,
      runtimeVersion: 'v20.x',
      language: 'ts',
      enableLogs: false,
      cache: {
        enabled: true,
        ttlMs: 60_000,
        byParam: true,
        byUser: true,
      },
    } as never);
    vi.mocked(cacheManager.get).mockResolvedValue(null);

    const req = {
      method: 'GET',
      body: {},
      params: {},
      query: { page: '2' },
      auth: { userId: 7, email: 'a@b.c' },
    } as Request;
    const res = createRuntimeResponse();

    const context = await prepareDataApiRuntime(req, res, definition, record);

    expect(context).toEqual(expect.objectContaining({
      cacheEnabled: true,
      cacheKey: expect.any(String),
      cacheTtlSeconds: 60,
    }));
    expect(cacheManager.get).toHaveBeenCalledOnce();
  });

  it('stores successful GET responses in cache during finalize', async () => {
    const req = { method: 'GET', params: {}, query: {} } as Request;
    const res = { statusCode: 200 } as Response;
    const cacheKey = buildEdgeResponseCacheKey({
      keyNamespace: `data-api:${definition.id}`,
      byUser: true,
      actorId: '7',
    });

    await finalizeDataApiRuntime(req, res, {
      definition,
      record,
      timeoutMs: 30_000,
      cacheEnabled: true,
      cacheKey,
      cacheTtlSeconds: 60,
    }, { success: true, data: [] });

    expect(cacheManager.set).toHaveBeenCalledWith(
      cacheKey,
      { statusCode: 200, body: { success: true, data: [] } },
      60,
    );
  });

  it('fires hooks.after during finalize', async () => {
    const hookedDefinition = {
      ...definition,
      runtime: {
        hooks: {
          after: { workflowName: 'orders-after', fields: ['count'] },
        },
      },
    } as EdgeApiDefinition;

    await finalizeDataApiRuntime(
      { method: 'GET' } as Request,
      { statusCode: 200 } as Response,
      {
        definition: hookedDefinition,
        record,
        timeoutMs: 30_000,
        cacheEnabled: false,
      },
      { success: true, data: [], count: 3 },
    );

    expect(fireServerFunctionHook).toHaveBeenCalledWith(
      { workflowName: 'orders-after', fields: ['count'] },
      { success: true, data: [], count: 3 },
    );
  });

  it('forces per-user GET cache for HWY member directory list (viewer-specific identity masks)', async () => {
    const cacheKeySpy = vi.spyOn(cacheKeyFormat, 'buildEdgeResponseCacheKey');
    vi.mocked(resolveServerFunctionRuntimeConfig).mockReturnValue({
      timeoutMs: 30_000,
      memoryLimit: 128,
      runtimeVersion: 'v20.x',
      language: 'ts',
      enableLogs: false,
      cache: {
        enabled: true,
        ttlMs: 60_000,
        byParam: true,
        byUser: false,
      },
    } as never);
    vi.mocked(cacheManager.get).mockResolvedValue(null);

    const req = {
      method: 'GET',
      body: {},
      params: {},
      query: { page: '1' },
      auth: { userId: 42, email: 'viewer@example.com' },
    } as Request;
    const res = createRuntimeResponse();
    const listRecord = {
      ...record,
      id: 'vw-hwy-members.hwy-member-directory-list',
    } as ManagedFunctionExecutionRecord;

    await prepareDataApiRuntime(req, res, definition, listRecord);

    expect(cacheKeySpy).toHaveBeenCalledWith(
      expect.objectContaining({ byUser: true }),
    );
    cacheKeySpy.mockRestore();
  });

  it('extends Data API timeout for member-directory getOne when global runtime is 1.5s', async () => {
    vi.useFakeTimers();
    vi.mocked(resolveServerFunctionRuntimeConfig).mockReturnValue({
      timeoutMs: 1500,
      memoryLimit: 128,
      runtimeVersion: 'v20.x',
      language: 'ts',
      enableLogs: false,
      cache: {
        enabled: false,
        ttlMs: 300_000,
        byParam: false,
        byUser: false,
      },
    } as never);

    const req = {
      method: 'GET',
      body: {},
      params: {},
      query: {},
    } as Request;
    const res = createRuntimeResponse();
    const getOneRecord = {
      ...record,
      id: 'vw-hwy-members.hwy-member-directory-getone',
    } as ManagedFunctionExecutionRecord;

    await prepareDataApiRuntime(req, res, definition, getOneRecord);
    await vi.advanceTimersByTimeAsync(1500);
    expect(res.statusCode).not.toBe(504);

    await vi.advanceTimersByTimeAsync(15_000 - 1500);
    expect(res.statusCode).toBe(504);

    vi.useRealTimers();
  });

  it('responds 504 with standard timeout message when the timer fires', async () => {
    vi.useFakeTimers();
    vi.mocked(resolveServerFunctionRuntimeConfig).mockReturnValue({
      timeoutMs: 25,
      memoryLimit: 128,
      runtimeVersion: 'v20.x',
      language: 'ts',
      enableLogs: false,
      cache: {
        enabled: false,
        ttlMs: 300_000,
        byParam: false,
        byUser: false,
      },
    } as never);

    const req = {
      method: 'POST',
      body: {},
      params: {},
      query: {},
    } as Request;
    const res = createRuntimeResponse();

    await prepareDataApiRuntime(req, res, definition, record);
    await vi.advanceTimersByTimeAsync(25);

    expect(res.statusCode).toBe(504);
    expect(res.body).toEqual({
      success: false,
      error: 'Data API execution timed out.',
    });

    vi.useRealTimers();
  });
});
