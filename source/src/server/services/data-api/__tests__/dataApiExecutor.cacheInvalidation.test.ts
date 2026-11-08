import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invalidateDataApiDefinitionCache, createMock } = vi.hoisted(() => ({
  invalidateDataApiDefinitionCache: vi.fn(async () => undefined),
  createMock: vi.fn(async () => ({
    get: () => ({ id: 1, title: 'hello' }),
  })),
}));

vi.mock('../dataApiRuntimePolicy', () => ({
  invalidateDataApiDefinitionCache,
}));

vi.mock('../edgeApiStore', () => ({
  getEdgeApiDefinitionById: vi.fn(() => ({
    id: 'ea_test',
    edgeModelId: 'em_test',
    status: 'published',
    operations: [
      {
        id: 'op_create',
        kind: 'create',
        enabled: true,
        fields: { write: ['title'] },
      },
      {
        id: 'op_list',
        kind: 'list',
        enabled: true,
        query: { defaultPageSize: 20, maxPageSize: 100 },
      },
    ],
  })),
}));

vi.mock('../edgeModelStore', () => ({
  getEdgeModelById: vi.fn(() => ({
    id: 'em_test',
    dataSourceId: 'ds_test',
    primaryKey: 'id',
    columns: [
      {
        name: 'id',
        field: 'id',
        dataType: 'bigint',
        sequelizeType: 'INTEGER',
        allowNull: false,
        isPrimaryKey: true,
        isForeignKey: false,
      },
      {
        name: 'title',
        field: 'title',
        dataType: 'text',
        sequelizeType: 'STRING',
        allowNull: true,
        isPrimaryKey: false,
        isForeignKey: false,
      },
    ],
  })),
  listEdgeModels: vi.fn(() => []),
}));

vi.mock('../sequelize/associationRegistry', () => ({
  loadAssociationContext: vi.fn(() => ({ defs: [] })),
}));

vi.mock('../dataApiFieldEnrichment', () => ({
  applyFieldEnrichments: vi.fn(async (rows: unknown) => rows),
  resolveDataApiLang: vi.fn(() => 'en'),
}));

vi.mock('../dataApiBinaryPreview', () => ({
  applyBinaryPreviewToRows: vi.fn(async (rows: unknown) => rows),
  extendAttributesForBinaryPreview: vi.fn((attrs: unknown) => attrs),
}));

vi.mock('../dataApiAuditFields', () => ({
  applyDataApiAuditFields: vi.fn(() => ({ title: 'hello' })),
}));

vi.mock('../sequelize/edgeSequelizeFactory', () => ({
  EdgeSequelizeFactory: class {
    getOrCreate = vi.fn(async () => ({}));
    buildModelGraph = vi.fn(() => new Map([
      ['em_test', {
        create: createMock,
        findAndCountAll: vi.fn(),
        findOne: vi.fn(),
        destroy: vi.fn(),
      }],
    ]));
  },
}));

import { DataApiExecutor } from '../dataApiExecutor';

describe('DataApiExecutor write cache invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invalidates Data API GET cache after create (workflow / non-HTTP writes)', async () => {
    const executor = new DataApiExecutor({
      getDataSources: () => [{
        id: 'ds_test',
        name: 'test',
        type: 'PostgreSQL',
      } as never],
    });

    const result = await executor.execute({
      edgeApiDefinitionId: 'ea_test',
      operationId: 'op_create',
      body: { title: 'hello' },
      skipPublishCheck: true,
    });

    expect(result.success).toBe(true);
    expect(createMock).toHaveBeenCalled();
    expect(invalidateDataApiDefinitionCache).toHaveBeenCalledWith('ea_test');
  });
});
