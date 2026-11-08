import { describe, expect, it, vi } from 'vitest';
import { mergeFunctionsCatalog, mapSystemFunction } from '../../../shared/api/contracts/server-functions/mappers';

const discoveredRoutes = [
  {
    id: 'sys-get-api-health',
    name: 'health',
    folder: 'health',
    method: 'GET' as const,
    path: '/api/health',
    code: '// health',
    language: 'ts' as const,
    testPayload: '{}',
    isBuiltIn: true,
  },
  {
    id: 'sys-get-api-custom-reports',
    name: 'custom reports',
    folder: 'reports',
    method: 'GET' as const,
    path: '/api/custom-reports',
    code: '// reports',
    language: 'ts' as const,
    testPayload: '{}',
    isBuiltIn: true,
  },
];

vi.mock('../../domain/functions/functionRepository', () => ({
  listManagedFunctions: vi.fn(async () => []),
}));

vi.mock('../builtinFunctionRegistry.service', () => ({
  builtinFunctionRegistry: {
    ensureLoaded: vi.fn(async () => {}),
    listMergedRecords: vi.fn(() => []),
  },
}));

vi.mock('../package-runtime/packageApiCatalog.service', () => ({
  listInstalledPackageApiRoutes: vi.fn(() => []),
}));

vi.mock('../../utils/methodLogConfig', () => ({
  readRouteLoggingEnabled: vi.fn(() => true),
}));

describe('serverFunctionsCatalog.service', () => {
  it('builds the same merged catalog as the Server Functions client query', async () => {
    const { buildListSystemCatalogItems, buildMergedServerFunctionsCatalog } = await import('../serverFunctionsCatalog.service');

    const deps = {
      discoverSystemRoutes: async () => discoveredRoutes,
    };

    const listSystemItems = await buildListSystemCatalogItems(deps);
    const serverCatalog = await buildMergedServerFunctionsCatalog(deps);
    const clientCatalog = mergeFunctionsCatalog(
      listSystemItems.map((item) => mapSystemFunction(item)),
      [],
    );

    expect(serverCatalog.map((item) => item.id).sort()).toEqual(clientCatalog.map((item) => item.id).sort());
    expect(serverCatalog.length).toBeGreaterThan(discoveredRoutes.length);
  });
});
