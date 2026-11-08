import { describe, expect, it } from 'vitest';
import {
  buildAggregatedManagedFunctionsOpenApiDocument,
  buildManagedFunctionOpenApiDocument,
  buildManagedFunctionOpenApiPaths,
  canAccessFunctionDoc,
  filterFunctionsForDocAccess,
  OPENAPI_VERSION,
  resolveManagedFunctionDocRoles,
  toOpenApiPath,
} from '../buildManagedFunctionOpenApi';

describe('buildManagedFunctionOpenApi', () => {
  it('converts express-style path params to OpenAPI templates', () => {
    expect(toOpenApiPath('/api/products/:id')).toBe('/api/products/{id}');
  });

  it('builds Data API operations from metadata', () => {
    const paths = buildManagedFunctionOpenApiPaths({
      id: 'fn_users_list',
      name: 'users-list-get',
      folder: 'data-api',
      method: 'GET',
      path: '/api/users',
      metadata_json: JSON.stringify({
        origin: 'data-api',
        routeKind: 'data-api',
        operation: {
          kind: 'list',
          method: 'GET',
          pathPattern: '/api/users',
          query: {
            allowFilter: true,
            allowSort: true,
            maxPageSize: 100,
            defaultPageSize: 20,
          },
        },
      }),
      test_payload: null,
      engine_type: 'DATA_API',
    });

    const getOperation = paths['/api/users']?.get as Record<string, unknown>;
    expect(getOperation).toBeTruthy();
    expect((getOperation.responses as Record<string, unknown>)['200']).toBeTruthy();
  });

  it('falls back to sandbox apiDoc and test payload for manual functions', () => {
    const spec = buildManagedFunctionOpenApiDocument({
      id: 'fn_custom',
      name: 'hello',
      folder: 'general',
      method: 'POST',
      path: '/api/general/hello/:name',
      metadata_json: JSON.stringify({
        apiDoc: {
          summary: 'Say hello',
          description: 'Returns a greeting payload.',
          tags: ['Greetings'],
        },
      }),
      test_payload: JSON.stringify({
        params: { name: 'world' },
        body: { loud: true },
      }),
      engine_type: 'SANDBOX_JS',
    });

    const operation = (spec.paths as Record<string, Record<string, unknown>>)['/api/general/hello/{name}']?.post as Record<string, unknown>;
    expect(operation.summary).toBe('Say hello');
    expect(operation.tags).toEqual(['Greetings']);
    expect((spec.components as Record<string, unknown>).securitySchemes).toBeTruthy();
  });

  it('aggregates multiple managed functions into one spec', () => {
    const spec = buildAggregatedManagedFunctionsOpenApiDocument([
      {
        id: 'fn_a',
        name: 'a',
        folder: 'alpha',
        method: 'GET',
        path: '/api/alpha/a',
        metadata_json: null,
        test_payload: null,
      },
      {
        id: 'fn_b',
        name: 'b',
        folder: 'beta',
        method: 'POST',
        path: '/api/beta/b',
        metadata_json: null,
        test_payload: null,
      },
    ]);

    expect(Object.keys(spec.paths as Record<string, unknown>)).toEqual([
      '/api/alpha/a',
      '/api/beta/b',
    ]);
  });

  it('resolves allowed roles from metadata methods when present', () => {
    const roles = resolveManagedFunctionDocRoles({
      id: 'fn_roles',
      name: 'roles',
      folder: 'general',
      method: 'GET',
      path: '/api/general/roles',
      metadata_json: JSON.stringify({
        objectType: 'TABLE',
        objectName: 'roles',
        methods: {
          GET: { enabled: true, allowedRoles: ['ADMIN', 'USER'] },
          POST: { enabled: false, allowedRoles: ['ADMIN'] },
        },
      }),
      test_payload: null,
    });

    expect(roles).toEqual(['ADMIN', 'USER']);
  });

  it('allows ADMIN to access any function doc', () => {
    expect(canAccessFunctionDoc(
      { isAdmin: true, roles: ['ADMIN'] },
      {
        id: 'fn_dev',
        name: 'dev-only',
        folder: 'general',
        method: 'GET',
        path: '/api/general/dev-only',
        access_control: { allowRoles: ['DEVELOPER'] },
      },
    )).toBe(true);
  });

  it('restricts function docs to configured allowRoles', () => {
    const input = {
      id: 'fn_dev',
      name: 'dev-only',
      folder: 'general',
      method: 'GET',
      path: '/api/general/dev-only',
      access_control: { allowRoles: ['DEVELOPER'] },
    };

    expect(canAccessFunctionDoc({ isAdmin: false, roles: ['USER'] }, input)).toBe(false);
    expect(canAccessFunctionDoc({ isAdmin: false, roles: ['DEVELOPER'] }, input)).toBe(true);
  });

  it('allows any authenticated principal when allow lists are empty', () => {
    const input = {
      id: 'fn_public',
      name: 'profile',
      folder: 'auth',
      method: 'GET',
      path: '/api/profile',
      access_control: { allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
    };

    expect(canAccessFunctionDoc({ isAdmin: false, roles: ['USER'] }, input)).toBe(true);
  });

  it('filters aggregated function inputs by principal access', () => {
    const functions = [
      {
        id: 'fn_a',
        name: 'a',
        folder: 'alpha',
        method: 'GET',
        path: '/api/alpha/a',
        access_control: { allowRoles: ['DEVELOPER'] },
      },
      {
        id: 'fn_b',
        name: 'b',
        folder: 'beta',
        method: 'GET',
        path: '/api/beta/b',
        access_control: { allowRoles: [] },
      },
    ];

    const visible = filterFunctionsForDocAccess(functions, { isAdmin: false, roles: ['USER'] });
    expect(visible.map((fn) => fn.id)).toEqual(['fn_b']);

    const adminVisible = filterFunctionsForDocAccess(functions, { isAdmin: true, roles: ['ADMIN'] });
    expect(adminVisible.map((fn) => fn.id)).toEqual(['fn_a', 'fn_b']);
  });

  it('builds aggregated spec from access-filtered functions only', () => {
    const spec = buildAggregatedManagedFunctionsOpenApiDocument(
      filterFunctionsForDocAccess([
        {
          id: 'fn_a',
          name: 'a',
          folder: 'alpha',
          method: 'GET',
          path: '/api/alpha/a',
          metadata_json: null,
          test_payload: null,
          access_control: { allowRoles: ['DEVELOPER'] },
        },
        {
          id: 'fn_b',
          name: 'b',
          folder: 'beta',
          method: 'POST',
          path: '/api/beta/b',
          metadata_json: null,
          test_payload: null,
          access_control: { allowRoles: [] },
        },
      ], { isAdmin: false, roles: ['USER'] }),
    );

    expect(Object.keys(spec.paths as Record<string, unknown>)).toEqual(['/api/beta/b']);
  });

  it('includes published DATA_API routes in aggregate and hides them when ACL denies (SEA-6.2)', () => {
    const dataApiFn = {
      id: 'orders.orders-list',
      name: 'orders-list',
      folder: 'data-api',
      method: 'GET',
      path: '/api/orders',
      engine_type: 'DATA_API' as const,
      metadata_json: JSON.stringify({
        origin: 'data-api',
        routeKind: 'data-api',
        operation: {
          kind: 'list',
          method: 'GET',
          pathPattern: '/api/orders',
          query: {
            allowFilter: true,
            allowSort: true,
            maxPageSize: 100,
            defaultPageSize: 20,
          },
        },
      }),
      test_payload: null,
      access_control: {
        accessMode: 'specific',
        allowRoles: ['DEVELOPER'],
        allowUsers: [],
        denyRoles: [],
        denyUsers: [],
      },
    };

    const denied = buildAggregatedManagedFunctionsOpenApiDocument(
      filterFunctionsForDocAccess([dataApiFn], { isAdmin: false, roles: ['USER'] }),
    );
    expect(Object.keys(denied.paths as Record<string, unknown>)).toEqual([]);

    const allowed = buildAggregatedManagedFunctionsOpenApiDocument(
      filterFunctionsForDocAccess([dataApiFn], { isAdmin: false, roles: ['DEVELOPER'] }),
    );
    const getOperation = (allowed.paths as Record<string, Record<string, unknown>>)['/api/orders']?.get;
    expect(getOperation).toBeTruthy();
    expect((getOperation as Record<string, unknown>).responses).toBeTruthy();
  });
});
