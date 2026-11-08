import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../errors/HttpError';
import type { RequestDbContext } from '../../types/requestContext';
import { FunctionsService } from '../functions.service';

const functionRepositoryMocks = vi.hoisted(() => ({
  insertManagedFunction: vi.fn(async () => undefined),
  updateManagedFunction: vi.fn(async () => undefined),
  findManagedFunctionById: vi.fn(),
  listManagedFunctions: vi.fn(async () => []),
}));

const deleteOwnedEdgeApiForManagedFunction = vi.hoisted(() => vi.fn(() => false));

vi.mock('../../domain/functions/functionRepository', () => ({
  buildManagedFunctionId: (folder: string, name: string) => `${folder}.${name}`,
  insertManagedFunction: functionRepositoryMocks.insertManagedFunction,
  updateManagedFunction: functionRepositoryMocks.updateManagedFunction,
  findManagedFunctionById: functionRepositoryMocks.findManagedFunctionById,
  findManagedFunctionId: vi.fn(),
  listManagedFunctions: functionRepositoryMocks.listManagedFunctions,
  deleteManagedFunction: vi.fn(),
  DuplicateFunctionPathError: class DuplicateFunctionPathError extends Error {},
  DuplicateFunctionIdentityError: class DuplicateFunctionIdentityError extends Error {},
}));

vi.mock('../data-api/edgeCapabilityDeleteCleanup', () => ({
  deleteOwnedEdgeApiForManagedFunction,
}));

vi.mock('../managedFunctionRouteRegistry', () => ({
  managedFunctionRouteRegistry: {
    invalidate: vi.fn(),
  },
}));

const saveAppLoggingMethodConfigs = vi.hoisted(() => vi.fn(async () => ({})));

vi.mock('../settings/appSettings.service', () => ({
  saveAppLoggingMethodConfigs,
}));

vi.mock('../../../core/logging/Logger', () => ({
  logger: {
    getMethodConfigs: vi.fn(() => ({})),
  },
}));

const ctx: RequestDbContext = { headers: {}, query: {}, body: null };
const {
  insertManagedFunction,
  updateManagedFunction,
  findManagedFunctionById,
  listManagedFunctions,
} = functionRepositoryMocks;

const sandboxPayload = {
  name: 'hello',
  folder: 'custom',
  method: 'GET',
  path: '/api/custom/hello',
  code: 'res.json({ ok: true });',
};

describe('FunctionsService', () => {
  const service = new FunctionsService({
    discoverSystemRoutes: vi.fn(async () => []),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates SANDBOX_JS functions with file-store id folder.name', async () => {
    const result = await service.create(ctx, sandboxPayload);

    expect(result.statusCode).toBe(201);
    expect(result.body.id).toBe('custom.hello');
    expect(insertManagedFunction).toHaveBeenCalledWith(
      expect.arrayContaining([
        'custom.hello',
        'hello',
        'custom',
        'GET',
        '/api/custom/hello',
        sandboxPayload.code,
        'ts',
        '{}',
        'v20.x',
        128,
        1500,
        false,
        180000,
        false,
        false,
        'SANDBOX_JS',
        expect.stringMatching(/"derived":\{/),
        true,
        true,
      ]),
    );
  });

  it('updates cache fields on existing managed functions', async () => {
    findManagedFunctionById.mockResolvedValueOnce({
      id: 'custom.cacheable-list',
      name: 'cacheable-list',
      folder: 'custom',
      method: 'GET',
      path: '/api/custom/cacheable-list',
      code: 'res.json({ ok: true });',
      language: 'ts',
      test_payload: '{}',
      runtime_version: 'v20.x',
      memory_limit: 128,
      timeout_ms: 1500,
      cache_enabled: false,
      cache_ttl_ms: 180000,
      cache_by_param: false,
      cache_by_user: false,
      engine_type: 'SANDBOX_JS',
      metadata_json: null,
    });

    await service.update(ctx, 'custom.cacheable-list', {
      cacheEnabled: true,
      cacheTtlMs: 240000,
      cacheByParam: true,
      cacheByUser: true,
    });

    expect(updateManagedFunction).toHaveBeenCalledWith(
      expect.arrayContaining([
        'cacheable-list',
        'custom',
        'GET',
        '/api/custom/cacheable-list',
        'res.json({ ok: true });',
        'ts',
        '{}',
        'v20.x',
        128,
        1500,
        true,
        240000,
        true,
        true,
        'SANDBOX_JS',
        expect.stringMatching(/"derived":\{/),
        'custom.cacheable-list',
        true,
        true,
      ]),
    );
  });

  it('persists full Server Function Settings payload (VM, RAM, timeout, logs, portal tag)', async () => {
    findManagedFunctionById.mockResolvedValueOnce({
      id: 'custom.settings-probe',
      name: 'settings-probe',
      folder: 'custom',
      method: 'GET',
      path: '/api/custom/settings-probe',
      code: 'res.json({ ok: true });',
      language: 'ts',
      test_payload: '{}',
      runtime_version: 'v20.x',
      memory_limit: 128,
      timeout_ms: 1500,
      cache_enabled: false,
      cache_ttl_ms: 180000,
      cache_by_param: false,
      cache_by_user: false,
      engine_type: 'SANDBOX_JS',
      metadata_json: null,
      use_global_config: true,
      enable_logs: true,
    });

    await service.update(ctx, 'custom.settings-probe', {
      language: 'js',
      runtimeVersion: 'v18.x',
      memoryLimit: 256,
      timeoutMs: 5000,
      useGlobalConfig: false,
      enableLogs: false,
      cacheEnabled: true,
      cacheTtlMs: 180000,
      cacheByParam: true,
      cacheByUser: false,
      metadataJson: {
        apiDoc: { tags: ['portal:ops'] },
      },
    });

    const updateCall = updateManagedFunction.mock.calls[0] as unknown[] | undefined;
    expect(updateCall).toBeDefined();
    const updatePayload = updateCall as unknown[];
    expect(updatePayload[5]).toBe('js');
    expect(updatePayload[7]).toBe('v18.x');
    expect(updatePayload[8]).toBe(256);
    expect(updatePayload[9]).toBe(5000);
    expect(updatePayload[10]).toBe(true);
    expect(updatePayload[11]).toBe(180000);
    expect(updatePayload[12]).toBe(true);
    expect(updatePayload[13]).toBe(false);
    expect(JSON.parse(String(updatePayload[15]))).toMatchObject({
      apiDoc: { tags: ['portal:ops'] },
    });
    expect(updatePayload[18]).toBe(false);
    expect(updatePayload[19]).toBe(false);

    expect(saveAppLoggingMethodConfigs).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        'HTTP GET /api/custom/settings-probe': expect.objectContaining({ enabled: false }),
      }),
    );
  });

  it('syncs enableLogs=true into route logging method configs', async () => {
    findManagedFunctionById.mockResolvedValueOnce({
      id: 'custom.settings-probe',
      name: 'settings-probe',
      folder: 'custom',
      method: 'GET',
      path: '/api/custom/settings-probe',
      code: 'res.json({ ok: true });',
      language: 'ts',
      test_payload: '{}',
      runtime_version: 'v20.x',
      memory_limit: 128,
      timeout_ms: 1500,
      cache_enabled: false,
      cache_ttl_ms: 180000,
      cache_by_param: false,
      cache_by_user: false,
      engine_type: 'SANDBOX_JS',
      metadata_json: null,
      enable_logs: false,
    });

    await service.update(ctx, 'custom.settings-probe', { enableLogs: true });

    expect(saveAppLoggingMethodConfigs).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        'HTTP GET /api/custom/settings-probe': expect.objectContaining({ enabled: true }),
      }),
    );
  });

  it('returns 404 when updating a missing function', async () => {
    findManagedFunctionById.mockResolvedValueOnce(null);

    await expect(service.update(ctx, 'missing.fn', { name: 'x' }))
      .rejects.toBeInstanceOf(HttpError);
  });

  it('cascades Data API definition cleanup when deleting a DATA_API function', async () => {
    findManagedFunctionById.mockResolvedValueOnce({
      id: 'data-api.orders-list',
      name: 'orders-list',
      folder: 'data-api',
      method: 'GET',
      path: '/api/orders',
      code: 'return [];',
      language: 'ts',
      runtime_version: 'v20.x',
      engine_type: 'DATA_API',
      metadata_json: JSON.stringify({ edgeApiDefinitionId: 'ea_orders' }),
    });
    deleteOwnedEdgeApiForManagedFunction.mockReturnValueOnce(true);

    const result = await service.remove(ctx, 'data-api.orders-list');

    expect(result.body).toEqual({ success: true });
    expect(deleteOwnedEdgeApiForManagedFunction).toHaveBeenCalledWith({
      engineType: 'DATA_API',
      metadataJson: JSON.stringify({ edgeApiDefinitionId: 'ea_orders' }),
    });
  });
});
