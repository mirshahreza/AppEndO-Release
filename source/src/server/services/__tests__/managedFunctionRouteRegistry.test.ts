import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ManagedFunctionRouteRegistry } from '../managedFunctionRouteRegistry';
import { getManagedFunctionIndexUpdatedAt } from '../../../core/functions/FunctionFileStore';

vi.mock('../../../core/functions/FunctionFileStore', () => ({
  getManagedFunctionIndexUpdatedAt: vi.fn(() => '2026-06-17T12:00:00.000Z'),
}));

vi.mock('../../domain/functions/functionRepository', () => ({
  listManagedFunctionRouteRows: vi.fn(async () => ([
    {
      id: 'fn_products',
      name: 'products',
      folder: 'general',
      method: 'GET',
      path: '/api/general/products',
      code: '',
      engine_type: 'DATA_API',
      metadata_json: '{"origin":"data-api","edgeApiDefinitionId":"api_products","edgeApiOperationId":"op_list"}',
    },
    {
      id: 'fn_user',
      name: 'user',
      folder: 'users',
      method: 'GET',
      path: '/api/users/:id',
      code: '',
      engine_type: 'SANDBOX_JS',
      metadata_json: null,
    },
  ])),
}));

describe('ManagedFunctionRouteRegistry', () => {
  let registry: ManagedFunctionRouteRegistry;

  beforeEach(async () => {
    registry = new ManagedFunctionRouteRegistry();
    await registry.reload();
  });

  it('pins managed routes to their declared HTTP method', async () => {
    const getMatch = registry.resolve('GET', '/api/general/products');
    const postMatch = registry.resolve('POST', '/api/general/products');

    expect(getMatch?.function.id).toBe('fn_products');
    expect(postMatch).toBeNull();
  });

  it('uses L1 resolve cache for repeated lookups', async () => {
    const first = registry.resolve('GET', '/api/general/products');
    const second = registry.resolve('GET', '/api/general/products');
    expect(first).toBe(second);
  });

  it('pins method for regular SANDBOX routes', () => {
    expect(registry.resolve('POST', '/api/users/42')).toBeNull();
  });

  it('extracts route params for sandbox routes', () => {
    const match = registry.resolve('GET', '/api/users/42');
    expect(match?.function.id).toBe('fn_user');
    expect(match?.params).toEqual({ id: '42' });
  });

  it('skips reserved platform paths', () => {
    expect(registry.isReservedApiPath('/api/logs')).toBe(true);
    expect(registry.isReservedApiPath('/api/retention')).toBe(true);
    expect(registry.isReservedApiPath('/api/record-events')).toBe(true);
    expect(registry.isReservedApiPath('/api/record-events/export')).toBe(true);
    expect(registry.isReservedApiPath('/api/cms-site')).toBe(true);
    expect(registry.isReservedApiPath('/api/idea-foundry')).toBe(true);
    expect(registry.isReservedApiPath('/api/idea-foundry/idea-1')).toBe(true);
    expect(registry.isReservedApiPath('/api/workbooks')).toBe(true);
    expect(registry.isReservedApiPath('/api/workbooks/wb-1/access')).toBe(true);
    expect(registry.isReservedApiPath('/api/db-enrichment/questions/1/draft')).toBe(true);
    expect(registry.isReservedApiPath('/api/hwy/targhin-requests')).toBe(true);
    expect(registry.isReservedApiPath('/api/hwy/etl-console/status')).toBe(true);
    expect(registry.isReservedApiPath('/api/hwy/business-rules/docs')).toBe(true);
    expect(registry.isReservedApiPath('/api/hwy/targhin-requests/members/42/nego-notes')).toBe(true);
    expect(registry.isReservedApiPath('/api/general/products')).toBe(false);
  });

  it('parses metadata_json string into metadataJson object on route records', async () => {
    const match = registry.resolve('GET', '/api/general/products');
    expect(match?.function.metadataJson).toMatchObject({
      origin: 'data-api',
      edgeApiDefinitionId: 'api_products',
    });
    expect(typeof match?.function.metadata_json).toBe('string');
  });

  it('carries Server Function hooks onto the resolved route record', async () => {
    const { listManagedFunctionRouteRows } = await import('../../domain/functions/functionRepository');
    vi.mocked(listManagedFunctionRouteRows).mockResolvedValueOnce([
      {
        id: 'fn_cms_create',
        name: 'cms-contents-create',
        folder: 'cms-contents',
        method: 'POST',
        path: '/api/cms/contents',
        code: '',
        engine_type: 'DATA_API',
        metadata_json: null,
        hooks: {
          after: { workflowName: 'cms-content-auto-comment', fields: ['data'] },
        },
      },
    ] as never);
    await registry.reload();
    const match = registry.resolve('POST', '/api/cms/contents');
    expect(match?.function.hooks).toEqual({
      after: { workflowName: 'cms-content-auto-comment', fields: ['data'] },
    });
  });

  it('awaits reload after invalidate before serving new routes', async () => {
    const { listManagedFunctionRouteRows } = await import('../../domain/functions/functionRepository');
    const mockedList = vi.mocked(listManagedFunctionRouteRows);

    const first = registry.resolve('GET', '/api/users/42');
    expect(first?.function.id).toBe('fn_user');

    mockedList.mockResolvedValueOnce([
      {
        id: 'fn_products',
        name: 'products',
        folder: 'general',
        method: 'GET',
        path: '/api/general/products',
        code: 'res.json({ ok: true });',
        engine_type: 'SANDBOX_JS',
        metadata_json: null,
      },
      {
        id: 'fn_user',
        name: 'user',
        folder: 'users',
        method: 'GET',
        path: '/api/users/:id',
        code: '',
        engine_type: 'SANDBOX_JS',
        metadata_json: null,
      },
    ]);

    registry.invalidate();
    await registry.ensureLoaded();

    const second = registry.resolve('GET', '/api/users/42');
    expect(second?.function.id).toBe('fn_user');
  });

  it('reloads on ensureLoaded() when another process bumps the function index (cross-process staleness)', async () => {
    const { listManagedFunctionRouteRows } = await import('../../domain/functions/functionRepository');
    const mockedList = vi.mocked(listManagedFunctionRouteRows);
    const mockedIndex = vi.mocked(getManagedFunctionIndexUpdatedAt);

    await registry.ensureLoaded();
    const callsAfterFirstLoad = mockedList.mock.calls.length;

    // Same index value: ensureLoaded() should be a no-op (no extra reload).
    await registry.ensureLoaded();
    expect(mockedList.mock.calls.length).toBe(callsAfterFirstLoad);

    // Simulate a write from another process: index bumped, no in-process invalidate() call.
    mockedIndex.mockReturnValue('2026-06-17T13:00:00.000Z');
    await registry.ensureLoaded();
    expect(mockedList.mock.calls.length).toBe(callsAfterFirstLoad + 1);
  });
});
