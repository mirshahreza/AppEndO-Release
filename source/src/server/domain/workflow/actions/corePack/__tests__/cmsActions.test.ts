import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  cmsContentGetExecutor,
  cmsContentCreateExecutor,
  cmsContentUpdateExecutor,
  __resetCmsActionExecutorForTests,
} from '../cmsActions';
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

const publishedContentsApi = {
  id: 'ea_cms_contents',
  key: 'cms-contents',
  publishedAt: '2026-01-01T00:00:00.000Z',
  operations: [
    { id: 'op_get', kind: 'getOne', enabled: true, method: 'GET', pathPattern: '/api/cms/contents/:pk' },
    { id: 'op_create', kind: 'create', enabled: true, method: 'POST', pathPattern: '/api/cms/contents' },
    { id: 'op_update', kind: 'update', enabled: true, method: 'PUT', pathPattern: '/api/cms/contents/:pk' },
  ],
};

describe('cms Action pack (p-89 ACT-1)', () => {
  beforeEach(() => {
    __resetActionRegistryForTests();
    __resetCmsActionExecutorForTests();
    registerCoreActionPack();
    getEdgeApiDefinitionByKeyMock.mockReset();
    executeMock.mockReset();
    getEdgeApiDefinitionByKeyMock.mockReturnValue(publishedContentsApi as never);
  });

  it('registers cms.content-get/create/update as AVAILABLE core providers', () => {
    for (const key of ['cms.content-get', 'cms.content-create', 'cms.content-update', 'cms.revision-create'] as const) {
      expect(getActionDefinition(key, '1')?.definition.availability).toBe('AVAILABLE');
      expect(() => resolveExactProvider(key, '1', 'core', '1')).not.toThrow();
    }
    const keys = listAvailableActionDefinitions().map((d) => d.key);
    expect(keys).toContain('cms.content-get');
    expect(keys).toContain('cms.content-create');
    expect(keys).toContain('cms.content-update');
    expect(keys).toContain('cms.revision-create');
  });

  it('cms.content-get returns a content summary', async () => {
    executeMock.mockResolvedValue({
      success: true,
      data: { id: 42, slug: 'welcome', title: 'Welcome', statusCode: 'x.draft' },
    });

    const result = await cmsContentGetExecutor.execute(fakeContext, {}, { contentId: 42 });
    expect(result).toMatchObject({
      status: 'SUCCEEDED',
      output: { found: true, id: 42, slug: 'welcome', title: 'Welcome', statusCode: 'x.draft' },
    });
    expect(executeMock).toHaveBeenCalledWith(expect.objectContaining({
      edgeApiDefinitionId: 'ea_cms_contents',
      operationId: 'op_get',
      params: { pk: '42' },
    }));
  });

  it('cms.content-update accepts flat patch fields', async () => {
    executeMock.mockResolvedValue({
      success: true,
      data: { id: 7, statusCode: 'x.published', title: 'T' },
    });
    const result = await cmsContentUpdateExecutor.execute(fakeContext, {}, {
      contentId: 7,
      statusCode: 'x.published',
      publishedAt: '2026-08-11T00:00:00.000Z',
    });
    expect(result.status).toBe('SUCCEEDED');
    expect(executeMock).toHaveBeenCalledWith(expect.objectContaining({
      operationId: 'op_update',
      params: { pk: '7' },
      body: { statusCode: 'x.published', publishedAt: '2026-08-11T00:00:00.000Z' },
      actorUserId: '100000',
    }));
  });

  it('cms.content-update patches statusCode via fields object', async () => {
    executeMock.mockResolvedValue({
      success: true,
      data: { id: 7, statusCode: 'x.published', title: 'T' },
    });
    const result = await cmsContentUpdateExecutor.execute(fakeContext, {}, {
      contentId: 7,
      fields: { statusCode: 'x.published', publishedAt: '2026-08-11T00:00:00.000Z' },
    });
    expect(result.status).toBe('SUCCEEDED');
    expect(executeMock).toHaveBeenCalledWith(expect.objectContaining({
      operationId: 'op_update',
      params: { pk: '7' },
      body: { statusCode: 'x.published', publishedAt: '2026-08-11T00:00:00.000Z' },
      actorUserId: '100000',
    }));
  });

  it('cms.content-create requires fields', async () => {
    const result = await cmsContentCreateExecutor.execute(fakeContext, {}, { fields: {} });
    expect(result).toMatchObject({ status: 'FAILED', errorCode: 'CMS_INVALID_INPUT' });
  });

  it('fails when cms-contents API is missing', async () => {
    getEdgeApiDefinitionByKeyMock.mockReturnValue(null);
    const result = await cmsContentGetExecutor.execute(fakeContext, {}, { contentId: 1 });
    expect(result).toMatchObject({ status: 'FAILED', errorCode: 'CMS_API_NOT_FOUND' });
  });
});
