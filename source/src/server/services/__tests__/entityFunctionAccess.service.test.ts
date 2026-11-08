import { beforeEach, describe, expect, it, vi } from 'vitest';

const listManagedFunctions = vi.fn(async () => []);
const listMergedRecords = vi.fn(() => ([
  {
    id: 'fn-auth-login',
    name: 'login',
    method: 'POST',
    path: '/api/auth/login',
    folder: 'auth',
    accessControl: {
      accessMode: 'public',
      allowRoles: [],
      allowUsers: [],
      denyRoles: [],
      denyUsers: [],
    },
  },
]));
const ensureLoaded = vi.fn(async () => {});
const reload = vi.fn(async () => {});
const readBuiltinFunctionMetadata = vi.fn(() => null);
const listInstalledPackageApiRoutes = vi.fn(() => []);

vi.mock('../../domain/functions/functionRepository', () => ({
  listManagedFunctions,
  findManagedFunctionById: vi.fn(),
  updateManagedFunction: vi.fn(),
}));

vi.mock('../../domain/users/userRepository', () => ({
  findUserIdEmailUsername: vi.fn(async () => ({
    id: 2,
    email: 'dev@example.com',
    username: 'dev',
  })),
}));

vi.mock('../../domain/users/userRoleRepository', () => ({
  getUserRolesForRequest: vi.fn(async () => ['DEVELOPER']),
}));

vi.mock('../../domain/users/roleRepository', () => ({
  findRoleIdByName: vi.fn(),
}));

vi.mock('../builtinFunctionRegistry.service', () => ({
  builtinFunctionRegistry: {
    ensureLoaded,
    listMergedRecords,
    reload,
  },
}));

vi.mock('../../../core/functions/BuiltinFunctionMetadataStore', () => ({
  readBuiltinFunctionMetadata,
  writeBuiltinFunctionMetadata: vi.fn(),
}));

vi.mock('../package-runtime/packageApiCatalog.service', () => ({
  listInstalledPackageApiRoutes,
}));

vi.mock('../openApiDocRefresh', () => ({
  refreshOpenApiDocumentationCaches: vi.fn(),
}));

describe('entityFunctionAccess.service catalog', () => {
  beforeEach(() => {
    listManagedFunctions.mockClear();
    listMergedRecords.mockClear();
    ensureLoaded.mockClear();
    readBuiltinFunctionMetadata.mockReset();
    readBuiltinFunctionMetadata.mockReturnValue(null);
    listInstalledPackageApiRoutes.mockReset();
    listInstalledPackageApiRoutes.mockReturnValue([]);
  });

  it('includes discovered system routes alongside curated built-ins', async () => {
    const { getEntityFunctionAccess } = await import('../entityFunctionAccess.service');

    const result = await getEntityFunctionAccess(
      {
        discoverSystemRoutes: async () => ([
          {
            id: 'sys-get-api-custom-reports',
            name: 'custom reports',
            folder: 'reports',
            method: 'GET',
            path: '/api/custom-reports',
            code: '// reports',
            language: 'ts',
            testPayload: '{}',
            isBuiltIn: true,
          },
          {
            id: 'fn-auth-login',
            name: 'login discovered',
            folder: 'auth',
            method: 'POST',
            path: '/api/auth/login',
            code: '// login',
            language: 'ts',
            testPayload: '{}',
            isBuiltIn: true,
          },
        ]),
      },
      'user',
      '2',
    );

    expect(result.entries.map((entry) => entry.id)).toEqual(
      expect.arrayContaining(['fn-auth-login', 'sys-get-api-custom-reports']),
    );
    expect(result.entries.length).toBeGreaterThan(2);
  });

  it('includes curated built-ins even when route discovery returns none', async () => {
    const { getEntityFunctionAccess } = await import('../entityFunctionAccess.service');
    const { INITIAL_FUNCTIONS } = await import('../../../shared/api/contracts/server-functions/initialFunctions');

    const result = await getEntityFunctionAccess(
      {
        discoverSystemRoutes: async () => [],
      },
      'user',
      '2',
    );

    expect(result.entries.length).toBe(INITIAL_FUNCTIONS.length);
  });

  it('includes published DATA_API managed functions in the Entity Access catalog (SEA-6.5)', async () => {
    listManagedFunctions.mockResolvedValueOnce([
      {
        id: 'orders.orders-list',
        name: 'orders-list',
        method: 'GET',
        path: '/api/orders',
        folder: 'data-api',
        engine_type: 'DATA_API',
        access_control: {
          accessMode: 'specific',
          allowRoles: ['DEVELOPER'],
          allowUsers: [],
          denyRoles: [],
          denyUsers: [],
        },
        metadata_json: JSON.stringify({ origin: 'data-api', routeKind: 'data-api' }),
      },
    ]);

    const { getEntityFunctionAccess } = await import('../entityFunctionAccess.service');

    const result = await getEntityFunctionAccess(
      {
        discoverSystemRoutes: async () => [],
      },
      'user',
      '2',
    );

    expect(result.entries.map((entry) => entry.id)).toEqual(
      expect.arrayContaining(['orders.orders-list']),
    );
    const dataApiEntry = result.entries.find((entry) => entry.id === 'orders.orders-list');
    expect(dataApiEntry?.path).toBe('/api/orders');
    expect(dataApiEntry?.folder).toBe('data-api');
  });

  it('returns every function from the merged catalog, not only curated seeds', async () => {
    const { getEntityFunctionAccess } = await import('../entityFunctionAccess.service');
    const { buildMergedServerFunctionsCatalog } = await import('../serverFunctionsCatalog.service');

    const discovered = Array.from({ length: 120 }, (_, index) => ({
      id: `sys-get-api-route-${index}`,
      name: `route-${index}`,
      folder: `folder-${index % 5}`,
      method: 'GET' as const,
      path: `/api/generated/route-${index}`,
      code: '// generated',
      language: 'ts' as const,
      testPayload: '{}',
      isBuiltIn: true,
    }));

    const deps = { discoverSystemRoutes: async () => discovered };
    const merged = await buildMergedServerFunctionsCatalog(deps);
    const result = await getEntityFunctionAccess(deps, 'user', '2');

    expect(result.entries.length).toBe(merged.length);
    expect(result.entries.length).toBeGreaterThan(120);
  });

  it('reports allow and deny decisions independently', async () => {
    const { getEntityFunctionAccess } = await import('../entityFunctionAccess.service');

    listMergedRecords.mockReturnValue([
      {
        id: 'fn-allowed',
        name: 'allowed-fn',
        method: 'GET',
        path: '/api/allowed',
        folder: 'demo',
        accessControl: {
          accessMode: 'specific',
          allowRoles: [],
          allowUsers: ['dev@example.com'],
          denyRoles: [],
          denyUsers: [],
        },
      },
      {
        id: 'fn-denied',
        name: 'denied-fn',
        method: 'GET',
        path: '/api/denied',
        folder: 'demo',
        accessControl: {
          accessMode: 'specific',
          allowRoles: [],
          allowUsers: [],
          denyRoles: [],
          denyUsers: ['dev@example.com'],
        },
      },
    ]);

    const result = await getEntityFunctionAccess(
      {
        discoverSystemRoutes: async () => ([
          {
            id: 'fn-allowed',
            name: 'allowed-fn',
            folder: 'demo',
            method: 'GET',
            path: '/api/allowed',
            code: '// allowed',
            language: 'ts',
            testPayload: '{}',
            isBuiltIn: true,
          },
          {
            id: 'fn-denied',
            name: 'denied-fn',
            folder: 'demo',
            method: 'GET',
            path: '/api/denied',
            code: '// denied',
            language: 'ts',
            testPayload: '{}',
            isBuiltIn: true,
          },
        ]),
      },
      'user',
      '2',
    );

    expect(result.entries.find((entry) => entry.id === 'fn-allowed')?.decision).toBe('allow');
    expect(result.entries.find((entry) => entry.id === 'fn-denied')?.decision).toBe('deny');
  });
});
