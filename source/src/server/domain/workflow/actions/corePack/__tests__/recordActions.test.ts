import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  dataRecordGetExecutor,
  dataRecordCreateExecutor,
  dataRecordUpdateExecutor,
  dataRecordDeleteExecutor,
  dataRecordCreateManyExecutor,
  dataRecordUpsertExecutor,
  __resetRecordActionExecutorForTests,
  MAX_RECORD_CREATE_MANY,
} from '../recordActions';
import { registerCoreActionPack } from '../index';
import { __resetActionRegistryForTests, getActionDefinition, resolveExactProvider, listAvailableActionDefinitions } from '../../registry';

const executeMock = vi.fn();

vi.mock('../../../../../services/data-api/edgeApiStore', () => ({
  getEdgeApiDefinitionByKey: vi.fn(),
}));

vi.mock('../../../../../services/data-api/dataApiExecutor', () => ({
  DataApiExecutor: class {
    execute = (...args: unknown[]) => executeMock(...args);
  },
}));

vi.mock('../../../../../db/dataSourcesStore', () => ({
  getDataSourcesFromSettings: vi.fn(() => []),
}));

import { getEdgeApiDefinitionByKey } from '../../../../../services/data-api/edgeApiStore';

const getEdgeApiDefinitionByKeyMock = vi.mocked(getEdgeApiDefinitionByKey);

const fakeContext = {
  workflowInstanceId: 'i1',
  nodeInstanceId: 'n1',
  logicalInvocationId: 'l1',
  idempotencyKey: 'k1',
  effectiveIdentity: { type: 'USER' as const, id: '100000' },
  cancellationSignal: new AbortController().signal,
  resolveSecret: async () => 'secret',
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  writeTraceMetadata: () => {},
};

const publishedApi = {
  id: 'ea_products',
  key: 'products',
  publishedAt: '2026-01-01T00:00:00.000Z',
  operations: [
    { id: 'op_get', kind: 'getOne', enabled: true, method: 'GET', pathPattern: '/api/products/:pk' },
    { id: 'op_list', kind: 'list', enabled: true, method: 'GET', pathPattern: '/api/products' },
    { id: 'op_create', kind: 'create', enabled: true, method: 'POST', pathPattern: '/api/products' },
    { id: 'op_update', kind: 'update', enabled: true, method: 'PUT', pathPattern: '/api/products/:pk' },
    { id: 'op_delete', kind: 'delete', enabled: true, method: 'DELETE', pathPattern: '/api/products/:pk' },
  ],
};

const RECORD_ACTION_KEYS = [
  'data.record-get',
  'data.record-create',
  'data.record-update',
  'data.record-delete',
  'data.record-create-many',
  'data.record-upsert',
] as const;

describe('data.record-* Action pack', () => {
  beforeEach(() => {
    __resetActionRegistryForTests();
    __resetRecordActionExecutorForTests();
    registerCoreActionPack();
    getEdgeApiDefinitionByKeyMock.mockReset();
    executeMock.mockReset();
    getEdgeApiDefinitionByKeyMock.mockReturnValue(publishedApi as never);
  });

  it('registers every record Action as an AVAILABLE core provider', () => {
    for (const key of RECORD_ACTION_KEYS) {
      expect(getActionDefinition(key, '1')?.definition.availability).toBe('AVAILABLE');
      expect(() => resolveExactProvider(key, '1', 'core', '1')).not.toThrow();
    }
    const keys = listAvailableActionDefinitions().map((d) => d.key);
    for (const key of RECORD_ACTION_KEYS) {
      expect(keys).toContain(key);
    }
  });

  it('marks apiKey as format edge-api-key so the Designer can offer a Data API picker', () => {
    const created = getActionDefinition('data.record-create', '1')?.definition;
    const schema = created?.configSchema;
    expect(schema?.type).toBe('INLINE');
    if (schema?.type !== 'INLINE') throw new Error('expected INLINE schema');
    const apiKey = (schema.schema as { properties?: { apiKey?: { format?: string } } }).properties?.apiKey;
    expect(apiKey?.format).toBe('edge-api-key');
  });

  it('create inserts through DataApiExecutor and returns the new pk', async () => {
    executeMock.mockResolvedValue({ success: true, data: { id: 9, sku: 'A-1' } });
    const result = await dataRecordCreateExecutor.execute(fakeContext, { apiKey: 'products' }, { fields: { sku: 'A-1' } });
    expect(result).toMatchObject({ status: 'SUCCEEDED', output: { pk: '9' } });
    expect(executeMock).toHaveBeenCalledWith(expect.objectContaining({
      edgeApiDefinitionId: 'ea_products',
      operationId: 'op_create',
      body: { sku: 'A-1' },
      actorUserId: '100000',
    }));
  });

  it('get returns the row by pk', async () => {
    executeMock.mockResolvedValue({ success: true, data: { id: 9, sku: 'A-1' } });
    const result = await dataRecordGetExecutor.execute(fakeContext, { apiKey: 'products' }, { pk: 9 });
    expect(result).toMatchObject({ status: 'SUCCEEDED', output: { found: true, pk: '9' } });
  });

  it('update patches by pk', async () => {
    executeMock.mockResolvedValue({ success: true, data: { id: 9, sku: 'A-2' } });
    const result = await dataRecordUpdateExecutor.execute(fakeContext, { apiKey: 'products' }, { pk: '9', fields: { sku: 'A-2' } });
    expect(result).toMatchObject({ status: 'SUCCEEDED', output: { pk: '9' } });
    expect(executeMock).toHaveBeenCalledWith(expect.objectContaining({
      operationId: 'op_update',
      params: { pk: '9' },
      body: { sku: 'A-2' },
    }));
  });

  it('delete removes by pk', async () => {
    executeMock.mockResolvedValue({ success: true, data: { deleted: 1 } });
    const result = await dataRecordDeleteExecutor.execute(fakeContext, { apiKey: 'products' }, { pk: '9' });
    expect(result).toEqual({ status: 'SUCCEEDED', output: { pk: '9', deleted: 1 } });
  });

  it('create-many inserts each record and reports counts', async () => {
    executeMock
      .mockResolvedValueOnce({ success: true, data: { id: 1 } })
      .mockResolvedValueOnce({ success: true, data: { id: 2 } });
    const result = await dataRecordCreateManyExecutor.execute(
      fakeContext,
      { apiKey: 'products' },
      { records: [{ sku: 'A' }, { sku: 'B' }] },
    );
    expect(result).toMatchObject({
      status: 'SUCCEEDED',
      output: { createdCount: 2, failedCount: 0 },
    });
    expect(executeMock).toHaveBeenCalledTimes(2);
  });

  it('create-many FAIL stops at the first row error', async () => {
    executeMock
      .mockResolvedValueOnce({ success: true, data: { id: 1 } })
      .mockRejectedValueOnce(new Error('duplicate sku'));
    const result = await dataRecordCreateManyExecutor.execute(
      fakeContext,
      { apiKey: 'products', onError: 'FAIL' },
      { records: [{ sku: 'A' }, { sku: 'A' }] },
    );
    expect(result).toMatchObject({ status: 'FAILED', errorCode: 'RECORD_CREATE_MANY_FAILED' });
    expect((result as { classifiedDetails?: { createdCount?: number } }).classifiedDetails).toEqual({
      createdCount: 1,
      failedIndex: 1,
    });
  });

  it('create-many CONTINUE skips failed rows', async () => {
    executeMock
      .mockRejectedValueOnce(new Error('bad row'))
      .mockResolvedValueOnce({ success: true, data: { id: 2 } });
    const result = await dataRecordCreateManyExecutor.execute(
      fakeContext,
      { apiKey: 'products', onError: 'CONTINUE' },
      { records: [{ sku: 'bad' }, { sku: 'ok' }] },
    );
    expect(result).toMatchObject({
      status: 'SUCCEEDED',
      output: { createdCount: 1, failedCount: 1 },
    });
  });

  it('create-many rejects arrays above the cap', async () => {
    const records = Array.from({ length: MAX_RECORD_CREATE_MANY + 1 }, () => ({ sku: 'x' }));
    const result = await dataRecordCreateManyExecutor.execute(fakeContext, { apiKey: 'products' }, { records });
    expect(result).toMatchObject({ status: 'FAILED', errorCode: 'RECORD_CREATE_MANY_LIMIT' });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('upsert creates when list lookup finds nothing', async () => {
    executeMock
      .mockResolvedValueOnce({ success: true, data: [] })
      .mockResolvedValueOnce({ success: true, data: { id: 11, sku: 'NEW' } });
    const result = await dataRecordUpsertExecutor.execute(
      fakeContext,
      { apiKey: 'products', uniqueField: 'sku' },
      { fields: { sku: 'NEW', title: 'Widget' } },
    );
    expect(result).toMatchObject({ status: 'SUCCEEDED', output: { pk: '11', created: true } });
    expect(executeMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ operationId: 'op_create' }));
  });

  it('upsert updates when list lookup finds a row', async () => {
    executeMock
      .mockResolvedValueOnce({ success: true, data: [{ id: 7, sku: 'OLD' }] })
      .mockResolvedValueOnce({ success: true, data: { id: 7, sku: 'OLD', title: 'Updated' } });
    const result = await dataRecordUpsertExecutor.execute(
      fakeContext,
      { apiKey: 'products', uniqueField: 'sku' },
      { fields: { sku: 'OLD', title: 'Updated' } },
    );
    expect(result).toMatchObject({ status: 'SUCCEEDED', output: { pk: '7', created: false } });
    expect(executeMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      operationId: 'op_update',
      params: { pk: '7' },
    }));
  });

  it('fails when the Data API is not published', async () => {
    getEdgeApiDefinitionByKeyMock.mockReturnValue({ ...publishedApi, publishedAt: null } as never);
    const result = await dataRecordCreateExecutor.execute(fakeContext, { apiKey: 'products' }, { fields: { sku: 'A' } });
    expect(result).toMatchObject({ status: 'FAILED', errorCode: 'RECORD_API_NOT_PUBLISHED' });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('fails when apiKey is missing', async () => {
    const result = await dataRecordCreateExecutor.execute(fakeContext, {}, { fields: { sku: 'A' } });
    expect(result).toMatchObject({ status: 'FAILED', errorCode: 'RECORD_API_KEY_REQUIRED' });
  });
});
