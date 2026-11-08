import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createPhase1ToolRegistry } from '../../../../../../core/ai/tools/ToolRegistry';
import { getAiCapabilityPack } from '../../../../../../shared/api/contracts/ai/capabilityPacks';
import type { ManagedFunctionOpenApiInput } from '../../../../../../shared/api/openapi/buildManagedFunctionOpenApi';
import {
  canAccessFunctionDoc,
  type FunctionDocAccessPrincipal,
} from '../../../../../../shared/api/openapi/buildManagedFunctionOpenApi';
import type { ToolExecutionContext } from '../../../../../../core/ai/agent/types';
import { registerBuiltinCapabilityPacks } from '../index';
import {
  executeGetOpenapiSpec,
  executeListOpenapiRoutes,
  GET_OPENAPI_SPEC_TOOL_NAME,
  limitOpenApiSpecSize,
  LIST_OPENAPI_ROUTES_TOOL_NAME,
} from '../openapiTools';

const openapiToolContext = (
  docAccessPrincipal: FunctionDocAccessPrincipal,
): ToolExecutionContext => ({
  mode: 'agent',
  allowedGroups: ['openapi'],
  docAccessPrincipal,
});

const mockRoutes: ManagedFunctionOpenApiInput[] = [
  {
    id: 'fn_users_list',
    name: 'List Users',
    folder: 'users',
    method: 'GET',
    path: '/api/users',
    engine_type: 'SANDBOX_JS',
    code: '// route',
    metadata_json: null,
    test_payload: '{}',
    updated_at: '2026-01-01T00:00:00.000Z',
    is_built_in: false,
    access_control: { allowRoles: ['ADMIN'] },
  },
  {
    id: 'fn_health',
    name: 'Health',
    folder: 'system',
    method: 'GET',
    path: '/api/health',
    engine_type: 'SANDBOX_JS',
    code: '// route',
    metadata_json: null,
    test_payload: '{}',
    updated_at: '2026-01-01T00:00:00.000Z',
    is_built_in: true,
  },
];

const aggregatedSpec = {
  openapi: '3.1.2',
  info: { title: 'AppEndO API', version: '1.0.0' },
  paths: {
    '/api/users': { get: { summary: 'List users' } },
    '/api/health': { get: { summary: 'Health' } },
  },
};

const routeSpec = {
  openapi: '3.1.2',
  info: { title: 'List Users', version: '1.0.0' },
  paths: {
    '/api/users': { get: { summary: 'List users' } },
  },
};

vi.mock('../../../../openApiSpec.service', () => ({
  openApiSpecService: {
    listAccessibleRoutesForPrincipal: vi.fn(async (principal: FunctionDocAccessPrincipal) => (
      mockRoutes.filter((route) => canAccessFunctionDoc(principal, route))
    )),
    getAggregatedSpecForPrincipal: vi.fn(async (principal: FunctionDocAccessPrincipal) => {
      const visiblePaths = Object.fromEntries(
        mockRoutes
          .filter((route) => canAccessFunctionDoc(principal, route))
          .map((route) => [route.path, aggregatedSpec.paths[route.path as keyof typeof aggregatedSpec.paths]]),
      );
      return {
        ...aggregatedSpec,
        paths: visiblePaths,
      };
    }),
    findFunctionInput: vi.fn(async (functionId: string) => (
      mockRoutes.find((route) => route.id === functionId) ?? null
    )),
    getFunctionSpec: vi.fn(async (functionId: string) => (
      functionId === 'fn_users_list' ? routeSpec : null
    )),
  },
}));

describe('appendo-openapi pack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers openapi pack tools when appendo-openapi is enabled', () => {
    const registry = createPhase1ToolRegistry('agent', ['openapi']);
    registerBuiltinCapabilityPacks(registry, ['appendo-openapi']);

    const names = registry.listDefinitions().map((tool) => tool.name);
    getAiCapabilityPack('appendo-openapi').toolNames.forEach((name) => {
      expect(names).toContain(name);
    });
  });

  it('blocks openapi tools in plan mode', () => {
    const registry = createPhase1ToolRegistry('plan', ['openapi']);
    registerBuiltinCapabilityPacks(registry, ['appendo-openapi']);

    const names = registry.listDefinitions().map((tool) => tool.name);
    getAiCapabilityPack('appendo-openapi').toolNames.forEach((name) => {
      expect(names).not.toContain(name);
    });
  });

  it('lists accessible routes with optional filters', async () => {
    const adminResult = await executeListOpenapiRoutes({}, openapiToolContext({
      isAdmin: true,
      roles: ['ADMIN'],
    }));
    expect(adminResult.ok).toBe(true);
    if (adminResult.ok) {
      expect(adminResult.data?.totalCount).toBe(2);
      expect(adminResult.data?.items[0]?.testPayload).toBeDefined();
    }

    const filtered = await executeListOpenapiRoutes(
      { pathContains: '/users', method: 'GET' },
      openapiToolContext({ isAdmin: true, roles: ['ADMIN'] }),
    );
    expect(filtered.ok).toBe(true);
    if (filtered.ok) {
      expect(filtered.data?.totalCount).toBe(1);
      expect(filtered.data?.items[0]?.id).toBe('fn_users_list');
    }

    const restricted = await executeListOpenapiRoutes({}, openapiToolContext({
      isAdmin: false,
      roles: [],
    }));
    expect(restricted.ok).toBe(true);
    if (restricted.ok) {
      expect(restricted.data?.totalCount).toBe(1);
      expect(restricted.data?.items[0]?.id).toBe('fn_health');
    }
  });

  it('returns aggregated spec when functionId is omitted', async () => {
    const result = await executeGetOpenapiSpec({}, openapiToolContext({
      isAdmin: true,
      roles: ['ADMIN'],
    }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.scope).toBe('aggregated');
      expect(result.data?.spec).toEqual(aggregatedSpec);
    }
  });

  it('returns route spec for accessible function id', async () => {
    const result = await executeGetOpenapiSpec(
      { functionId: 'fn_users_list' },
      openapiToolContext({ isAdmin: true, roles: ['ADMIN'] }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.scope).toBe('route');
      expect(result.data?.functionId).toBe('fn_users_list');
      expect(result.data?.spec).toEqual(routeSpec);
    }
  });

  it('rejects forbidden route spec for non-admin without role', async () => {
    const result = await executeGetOpenapiSpec(
      { functionId: 'fn_users_list' },
      openapiToolContext({ isAdmin: false, roles: [] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('route_forbidden');
    }
  });

  it('returns not found for unknown function id', async () => {
    const result = await executeGetOpenapiSpec(
      { functionId: 'missing' },
      openapiToolContext({ isAdmin: true, roles: ['ADMIN'] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('route_not_found');
    }
  });

  it('truncates oversized OpenAPI specs', () => {
    const hugePaths = Object.fromEntries(
      Array.from({ length: 200 }, (_, index) => [
        `/api/route-${index}`,
        { get: { summary: 'x'.repeat(4000) } },
      ]),
    );

    const limited = limitOpenApiSpecSize({
      openapi: '3.1.2',
      info: { title: 'Huge' },
      paths: hugePaths,
    });

    expect(limited.truncated).toBe(true);
    expect(limited.totalPaths).toBe(200);
    expect(Object.keys(limited.spec.paths as object).length).toBeLessThan(200);
  });

  it('exposes tool names matching catalog contract', () => {
    expect(LIST_OPENAPI_ROUTES_TOOL_NAME).toBe('list_openapi_routes');
    expect(GET_OPENAPI_SPEC_TOOL_NAME).toBe('get_openapi_spec');
  });
});
