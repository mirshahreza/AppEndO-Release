/**
 * Bug found (gap analysis #31 / Phase 46): DataSourceDefinition had no connectorType — every
 * binding assumed AppEndO internal REST. External REST / GraphQL / static-file had no adapters.
 * Fixed in restExternalAdapter.ts / staticFileAdapter.ts / dataConnectorMapping.ts: adapters
 * apply responseMapping and return the normalized `{ data, total }` contract.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mapConnectorPayloadToQueryResult } from '../../../../../domain/component-designer/dataConnectorMapping';
import type { WorkspaceDataConnector } from '../../../../../domain/component-designer/dataConnectorTypes';
import { runRestExternalAdapter } from '../restExternalAdapter';
import { runStaticFileAdapter } from '../staticFileAdapter';
import {
  designerConnectorsPaths,
  resolveConnectorFilesDir,
  saveConnectorStaticFile,
  upsertWorkspaceDataConnector,
  deleteWorkspaceDataConnector,
} from '../connectorsStore';

const makeConnector = (
  overrides: Partial<WorkspaceDataConnector> & Pick<WorkspaceDataConnector, 'id' | 'connectorType'>,
): WorkspaceDataConnector => ({
  id: overrides.id,
  name: overrides.name ?? overrides.id,
  connectorType: overrides.connectorType,
  baseUrl: overrides.baseUrl,
  headers: overrides.headers,
  auth: overrides.auth,
  defaultPath: overrides.defaultPath,
  graphqlPath: overrides.graphqlPath,
  graphqlQuery: overrides.graphqlQuery,
  staticFilePath: overrides.staticFilePath,
  staticFileFormat: overrides.staticFileFormat,
  responseMapping: overrides.responseMapping,
  createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
  updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00.000Z',
});

describe('Phase 46 - graphql adapter', () => {
  it('POSTs query/variables and maps data.dataPath via responseMapping', async () => {
    const { runGraphqlAdapter } = await import('../graphqlAdapter');

    const fetchImpl = vi.fn(async (_url: URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { query?: string; variables?: Record<string, unknown> };
      expect(body.query).toContain('orders');
      expect(body.variables).toEqual({ limit: 10 });
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          data: {
            orders: [{ id: 'o1' }, { id: 'o2' }],
            pageInfo: { total: 2 },
          },
        }),
      };
    }) as unknown as typeof fetch;

    const result = await runGraphqlAdapter({
      connector: makeConnector({
        id: 'gql-demo',
        connectorType: 'graphql',
        baseUrl: 'https://api.example.com',
        graphqlPath: '/graphql',
        graphqlQuery: 'query { orders { id } }',
        responseMapping: { arrayPath: 'data.orders', totalPath: 'data.pageInfo.total' },
      }),
      variables: { limit: 10 },
      fetchImpl,
      validateUrl: async (url) => new URL(url),
    });

    expect(result.data).toEqual([{ id: 'o1' }, { id: 'o2' }]);
    expect(result.total).toBe(2);
  });
});

describe('Phase 46 - rest-external adapter', () => {
  it('maps a differently shaped external payload to { data, total } via responseMapping', async () => {
    const remotePayload = {
      results: {
        items: [
          { id: 'a', label: 'Alpha' },
          { id: 'b', label: 'Beta' },
        ],
      },
      meta: { count: 2 },
    };

    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => remotePayload,
    })) as unknown as typeof fetch;

    const validateUrl = vi.fn(async (url: string) => new URL(url));

    const result = await runRestExternalAdapter({
      connector: makeConnector({
        id: 'ext-demo',
        connectorType: 'rest-external',
        baseUrl: 'https://example.com',
        defaultPath: '/v1/things',
        responseMapping: { arrayPath: 'results.items', totalPath: 'meta.count' },
      }),
      fetchImpl,
      validateUrl,
    });

    expect(validateUrl).toHaveBeenCalledWith('https://example.com/v1/things');
    expect(result.data).toEqual(remotePayload.results.items);
    expect(result.total).toBe(2);
  });

  it('honors path override and query params on the outbound URL', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ data: [{ id: 1 }], total: 1 }),
    })) as unknown as typeof fetch;

    const validateUrl = vi.fn(async (url: string) => new URL(url));

    await runRestExternalAdapter({
      connector: makeConnector({
        id: 'ext-query',
        connectorType: 'rest-external',
        baseUrl: 'https://api.example.com',
        responseMapping: { arrayPath: 'data', totalPath: 'total' },
      }),
      path: '/customers',
      query: { page: '2' },
      fetchImpl,
      validateUrl,
    });

    expect(validateUrl).toHaveBeenCalledWith('https://api.example.com/customers?page=2');
  });
});

describe('Phase 46 - static-file adapter', () => {
  const createdIds: string[] = [];

  afterEach(() => {
    for (const id of createdIds.splice(0)) {
      try {
        deleteWorkspaceDataConnector(id);
      } catch {
        // ignore
      }
    }
  });

  it('loads a JSON array file as a list Data Source with detail-by-primaryKey', () => {
    const connector = upsertWorkspaceDataConnector({
      id: `static_json_${Date.now().toString(36)}`,
      name: 'Static JSON demo',
      connectorType: 'static-file',
    });
    createdIds.push(connector.id);

    saveConnectorStaticFile(
      connector.id,
      'rows.json',
      JSON.stringify([
        { id: 'u1', name: 'Ada' },
        { id: 'u2', name: 'Grace' },
      ]),
    );

    const withFile = upsertWorkspaceDataConnector({
      ...connector,
      staticFilePath: 'rows.json',
      staticFileFormat: 'json',
    });

    const list = runStaticFileAdapter({ connector: withFile });
    expect(Array.isArray(list.data)).toBe(true);
    expect((list.data as unknown[]).length).toBe(2);
    expect(list.total).toBe(2);

    const detail = runStaticFileAdapter({
      connector: withFile,
      op: 'detail',
      primaryKey: 'id',
      id: 'u2',
    });
    expect(detail.data).toEqual({ id: 'u2', name: 'Grace' });
    expect(detail.total).toBe(1);
  });

  it('parses CSV into row objects usable as list data', () => {
    const connector = upsertWorkspaceDataConnector({
      id: `static_csv_${Date.now().toString(36)}`,
      name: 'Static CSV demo',
      connectorType: 'static-file',
    });
    createdIds.push(connector.id);

    saveConnectorStaticFile(
      connector.id,
      'rows.csv',
      'id,name\n1,Alpha\n2,Beta\n',
    );

    const withFile = upsertWorkspaceDataConnector({
      ...connector,
      staticFilePath: 'rows.csv',
      staticFileFormat: 'csv',
    });

    const list = runStaticFileAdapter({ connector: withFile });
    expect(list.data).toEqual([
      { id: '1', name: 'Alpha' },
      { id: '2', name: 'Beta' },
    ]);
    expect(list.total).toBe(2);
  });
});

describe('Phase 46 - response mapping helper', () => {
  it('normalizes nested remote envelopes to { data, total }', () => {
    const result = mapConnectorPayloadToQueryResult(
      { payload: { rows: [{ id: 1 }], meta: { total: 9 } } },
      { arrayPath: 'payload.rows', totalPath: 'payload.meta.total' },
    );
    expect(result.data).toEqual([{ id: 1 }]);
    expect(result.total).toBe(9);
  });
});

describe('Phase 46 - connectors storage paths', () => {
  it('keeps connector files under the designer connectors directory', () => {
    expect(designerConnectorsPaths.root).toContain(path.join('designer', 'connectors'));
    const dir = resolveConnectorFilesDir('probe');
    expect(dir.startsWith(designerConnectorsPaths.files)).toBe(true);
    // clean empty probe dir if created
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir);
    }
    void os;
  });
});
