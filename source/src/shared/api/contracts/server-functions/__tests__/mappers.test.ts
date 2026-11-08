import { describe, expect, it } from 'vitest';
import { INITIAL_FUNCTIONS } from '../initialFunctions';
import {
  buildManagedFunctionPayload,
  mapApiFunction,
  mapSystemFunction,
  mergeFunctionsCatalog,
} from '../mappers';
import type { ServerFunctionItem } from '../types';

describe('mergeFunctionsCatalog', () => {
  it('prefers curated INITIAL_FUNCTIONS code over discovered system preview code', () => {
    const loginCurated = INITIAL_FUNCTIONS.find((fn) => fn.path === '/api/auth/login');
    expect(loginCurated).toBeTruthy();

    const discovered: ServerFunctionItem[] = [
      mapSystemFunction({
        id: 'sys-post-api-auth-login',
        name: 'login',
        folder: 'auth',
        method: 'POST',
        path: '/api/auth/login',
        code: '// generic discovered preview for every route',
      }),
    ];

    const merged = mergeFunctionsCatalog(discovered, []);
    const login = merged.find((fn) => fn.path === '/api/auth/login' && fn.method === 'POST');

    expect(login?.id).toBe(loginCurated?.id);
    expect(login?.code).toBe(loginCurated?.code);
    expect(login?.code).toContain('base_users');
    expect(login?.code).not.toContain('generic discovered preview');
  });

  it('keeps discovered-only routes when no curated definition exists', () => {
    const discovered: ServerFunctionItem[] = [
      mapSystemFunction({
        id: 'sys-get-api-custom-only',
        name: 'custom-only',
        folder: 'custom',
        method: 'GET',
        path: '/api/custom/only-here',
        code: '// discovered-only route body',
      }),
    ];

    const merged = mergeFunctionsCatalog(discovered, []);
    const route = merged.find((fn) => fn.path === '/api/custom/only-here');

    expect(route?.code).toContain('discovered-only route body');
  });

  it('drops custom managed functions when a system route already owns the same path', () => {
    const discovered: ServerFunctionItem[] = [
      mapSystemFunction({
        id: 'pkg-api-pkg-test-get-test',
        name: 'test',
        folder: 'test',
        method: 'GET',
        path: '/api/test/test',
        code: '// package runtime handler',
        isBuiltIn: false,
      }),
    ];
    const custom: ServerFunctionItem[] = [
      mapApiFunction({
        id: 'test.test',
        name: 'test',
        folder: 'test',
        method: 'GET',
        path: '/api/test/test',
        code: '// managed function source',
      }),
    ];

    const merged = mergeFunctionsCatalog(discovered, custom);
    const routes = merged.filter((fn) => fn.path === '/api/test/test' && fn.method === 'GET');

    expect(routes).toHaveLength(1);
    expect(routes[0]?.id).toBe('pkg-api-pkg-test-get-test');
  });

  it('preserves audit metadata when merging curated built-in routes', () => {
    const discovered: ServerFunctionItem[] = [
      mapSystemFunction({
        id: 'fn-users-list',
        name: 'list',
        folder: 'users',
        method: 'GET',
        path: '/api/users',
        code: '// discovered preview',
        created_at: '2026-03-01T00:00:00.000Z',
        created_by: 'system',
        updated_at: '2026-04-01T00:00:00.000Z',
        updated_by: 'admin@append.os',
      }),
    ];

    const merged = mergeFunctionsCatalog(discovered, []);
    const route = merged.find((fn) => fn.id === 'fn-users-list');

    expect(route?.created_at).toBe('2026-03-01T00:00:00.000Z');
    expect(route?.created_by).toBe('system');
    expect(route?.updated_at).toBe('2026-04-01T00:00:00.000Z');
    expect(route?.updated_by).toBe('admin@append.os');
  });
});

describe('mapApiFunction', () => {
  it('maps file-store snake_case rows with DATA_API metadata', () => {
    const metadata = {
      origin: 'data-api',
      edgeApiDefinitionId: 'api_products',
      edgeApiOperationId: 'op_list',
    };

    const mapped = mapApiFunction({
      id: 'demo.products-list',
      name: 'products-list',
      folder: 'demo',
      method: 'GET',
      path: '/api/demo/products',
      code: '',
      engine_type: 'DATA_API',
      metadata_json: JSON.stringify(metadata),
      cache_enabled: true,
      cache_ttl_ms: 240000,
      cache_by_param: true,
      cache_by_user: false,
      created_at: '2026-01-01T00:00:00.000Z',
      created_by: 'admin@example.com',
      updated_at: '2026-02-01T00:00:00.000Z',
      updated_by: 'editor@example.com',
      access_control: {
        allowRoles: ['USER'],
        allowUsers: [],
        denyRoles: [],
        denyUsers: [],
      },
    });

    expect(mapped.id).toBe('demo.products-list');
    expect(mapped.engineType).toBe('DATA_API');
    expect(mapped.metadataJson).toMatchObject(metadata);
    expect(mapped.cacheEnabled).toBe(true);
    expect(mapped.cacheTtlMs).toBe(240000);
    expect(mapped.cacheByParam).toBe(true);
    expect(mapped.isBuiltIn).toBe(false);
    expect(mapped.accessControl).toEqual({
      accessMode: 'specific',
      allowRoles: ['USER'],
      allowUsers: [],
      denyRoles: [],
      denyUsers: [],
    });
    expect(mapped.created_at).toBe('2026-01-01T00:00:00.000Z');
    expect(mapped.created_by).toBe('admin@example.com');
    expect(mapped.updated_at).toBe('2026-02-01T00:00:00.000Z');
    expect(mapped.updated_by).toBe('editor@example.com');
  });
});

describe('buildManagedFunctionPayload', () => {
  it('serializes DATA_API create/update payloads', () => {
    const fn: ServerFunctionItem = {
      id: 'demo.products-list',
      name: 'products-list',
      folder: 'demo',
      method: 'GET',
      path: '/api/demo/products',
      code: '',
      language: 'ts',
      testPayload: '{}',
      runtimeVersion: 'v20.x',
      memoryLimit: 128,
      timeoutMs: 1500,
      useGlobalConfig: true,
      enableLogs: true,
      isBuiltIn: false,
      cacheEnabled: false,
      cacheTtlMs: 180000,
      cacheByParam: false,
      cacheByUser: false,
      engineType: 'DATA_API',
      metadataJson: {
        origin: 'data-api',
        edgeApiDefinitionId: 'api_products',
        edgeApiOperationId: 'op_list',
      } as ServerFunctionItem['metadataJson'],
      accessControl: { allowRoles: ['ADMIN'], allowUsers: [], denyRoles: [], denyUsers: [] },
    };

    expect(buildManagedFunctionPayload(fn)).toEqual({
      name: 'products-list',
      folder: 'demo',
      method: 'GET',
      path: '/api/demo/products',
      code: '',
      language: 'ts',
      testPayload: '{}',
      runtimeVersion: 'v20.x',
      memoryLimit: 128,
      timeoutMs: 1500,
      useGlobalConfig: true,
      enableLogs: true,
      cacheEnabled: false,
      cacheTtlMs: 180000,
      cacheByParam: false,
      cacheByUser: false,
      engineType: 'DATA_API',
      metadataJson: fn.metadataJson,
      accessControl: fn.accessControl,
      hooks: undefined,
    });
  });
});
