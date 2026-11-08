import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EdgeApiDefinition, EdgeModelDefinition } from '../../../../shared/api/contracts/data-api';

const listEdgeModels = vi.fn(() => [] as EdgeModelDefinition[]);
const getEdgeModelById = vi.fn();
const deleteEdgeModel = vi.fn(() => true);
const saveEdgeApiDefinition = vi.fn((definition: EdgeApiDefinition) => definition);
const listEdgeApiDefinitions = vi.fn(() => [] as EdgeApiDefinition[]);
const getEdgeApiDefinitionById = vi.fn();
const deleteEdgeApiDefinitionById = vi.fn();
const deleteEdgeApiDefinition = vi.fn(() => true);
const listEdgeModelIndexIds = vi.fn(() => [] as string[]);
const listEdgeApiIndexIds = vi.fn(() => [] as string[]);
const deleteEdgeModelStudioMeta = vi.fn();
const parkEdgeModelStudioMeta = vi.fn();
const retargetEdgeModelStudioMeta = vi.fn();
const listRecordPoliciesForModel = vi.fn(() => [] as Array<{ id: string }>);
const deleteRecordPolicy = vi.fn();
const deleteRecordPolicyBinding = vi.fn();
const listManagedFunctionsFromStore = vi.fn(() => [] as Array<{
  id: string;
  engine_type: string;
  metadata_json: string | null;
}>);
const deleteManagedFunctionFromStore = vi.fn();

vi.mock('../edgeModelStore', () => ({
  listEdgeModels,
  getEdgeModelById,
  deleteEdgeModel,
  listEdgeModelIndexIds,
  saveEdgeModel: vi.fn(),
}));

vi.mock('../edgeApiStore', () => ({
  listEdgeApiDefinitions,
  getEdgeApiDefinitionById,
  saveEdgeApiDefinition,
  deleteEdgeApiDefinition,
  listEdgeApiIndexIds,
}));

vi.mock('../edgeApiPublisher', () => ({
  deleteEdgeApiDefinitionById,
}));

vi.mock('../edgeModelStudioMetaStore', () => ({
  deleteEdgeModelStudioMeta,
  parkEdgeModelStudioMeta,
  retargetEdgeModelStudioMeta,
  getEdgeModelStudioMeta: vi.fn(() => ({
    columnMeta: [],
    associationMeta: [],
    tags: [],
    extensions: {},
  })),
  upsertEdgeModelStudioMeta: vi.fn(),
}));

vi.mock('../../record-policy/recordPolicyStore', () => ({
  listRecordPoliciesForModel,
  deleteRecordPolicy,
}));

vi.mock('../../record-policy/recordPolicyBindingStore', () => ({
  deleteRecordPolicyBinding,
}));

vi.mock('../../../../core/functions/FunctionFileStore', () => ({
  listManagedFunctionsFromStore,
  deleteManagedFunctionFromStore,
}));

vi.mock('../../managedFunctionRouteRegistry', () => ({
  managedFunctionRouteRegistry: { invalidate: vi.fn() },
}));

vi.mock('../../openApiDocRefresh', () => ({
  refreshOpenApiDocumentationCaches: vi.fn(),
}));

const {
  collapseDuplicateEdgeModels,
  deleteEdgeModelCascade,
  pruneDuplicateEdgeApis,
  pruneOrphanEdgeApis,
  pruneOrphanDataApiManagedFunctions,
  pruneEdgeApisWithMissingManagedFunctions,
  pruneUnreadableEdgeStoreRecords,
  pruneEdgeModelsWithoutApis,
} = await import('../edgeCapabilityDeleteCleanup');

const model = (
  id: string,
  objectName: string,
  extras: Partial<EdgeModelDefinition> = {},
): EdgeModelDefinition => ({
  id,
  dataSourceId: 'ds1',
  schema: null,
  objectName,
  objectType: 'TABLE',
  sequelize: { modelName: objectName, tableName: objectName },
  columns: extras.columns ?? [{ name: 'id', field: 'id', dataType: 'uuid', sequelizeType: 'UUID', allowNull: false, isPrimaryKey: true, isForeignKey: false }],
  primaryKey: 'id',
  associations: [],
  schemaFingerprint: 'fp',
  readOnly: false,
  labels: { title: objectName },
  status: 'ready',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: extras.updated_at ?? '2026-01-01T00:00:00.000Z',
  ...extras,
});

const api = (
  id: string,
  edgeModelId: string,
  key: string,
  basePath: string,
): EdgeApiDefinition => ({
  id,
  edgeModelId,
  key,
  label: key,
  basePath,
  operations: [],
  accessControl: { accessMode: 'authenticated', allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
  openapi: { tags: [] },
  publishedAt: null,
  version: 1,
  runtime: { timeoutMs: 30_000, useGlobalConfig: true, enableLogs: true, cacheEnabled: false, cacheTtlMs: 60_000, cacheByParam: false, cacheByUser: false },
});

describe('edgeCapabilityDeleteCleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listEdgeModels.mockReturnValue([]);
    listEdgeApiDefinitions.mockReturnValue([]);
    listRecordPoliciesForModel.mockReturnValue([]);
    listManagedFunctionsFromStore.mockReturnValue([]);
    deleteEdgeModel.mockReturnValue(true);
    getEdgeApiDefinitionById.mockImplementation((id: string) => (
      listEdgeApiDefinitions().find((item) => item.id === id) ?? null
    ));
  });

  it('cascades APIs and policies when deleting an edge model', () => {
    const focus = model('em_a', 'orders');
    getEdgeModelById.mockReturnValue(focus);
    listEdgeModels.mockReturnValue([focus]);
    listEdgeApiDefinitions.mockReturnValue([api('ea_a', 'em_a', 'List', '/api/orders')]);
    listRecordPoliciesForModel.mockReturnValue([{ id: 'rp_a' }]);

    expect(deleteEdgeModelCascade('em_a')).toBe(true);
    expect(deleteEdgeApiDefinitionById).toHaveBeenCalledWith('ea_a');
    expect(deleteRecordPolicy).toHaveBeenCalledWith('rp_a');
    expect(deleteRecordPolicyBinding).toHaveBeenCalledWith('em_a');
    expect(parkEdgeModelStudioMeta).toHaveBeenCalledWith(expect.objectContaining({ id: 'em_a' }));
    expect(deleteEdgeModel).toHaveBeenCalledWith('em_a');
  });

  it('collapses duplicate models for the same table and retargets APIs', () => {
    const older = model('em_old', 'base_app_feedback_attachments', { updated_at: '2026-01-01T00:00:00.000Z' });
    const newer = model('em_new', 'base_app_feedback_attachments', { updated_at: '2026-08-01T00:00:00.000Z' });
    listEdgeModels.mockReturnValue([older, newer]);
    listEdgeApiDefinitions.mockReturnValue([
      api('ea_old', 'em_old', 'List', '/api/feedback/list'),
      api('ea_new', 'em_new', 'Other', '/api/feedback/other'),
    ]);

    expect(collapseDuplicateEdgeModels()).toBe(1);
    expect(saveEdgeApiDefinition).toHaveBeenCalledWith(expect.objectContaining({
      id: 'ea_old',
      edgeModelId: 'em_new',
    }));
    expect(deleteEdgeModel).toHaveBeenCalledWith('em_old');
    expect(deleteEdgeModel).not.toHaveBeenCalledWith('em_new');
    expect(retargetEdgeModelStudioMeta).toHaveBeenCalledWith('em_old', 'em_new');
  });

  it('removes orphan APIs whose edge model is gone', () => {
    listEdgeModels.mockReturnValue([model('em_live', 'orders')]);
    listEdgeApiDefinitions.mockReturnValue([
      api('ea_live', 'em_live', 'List', '/api/orders'),
      api('ea_ghost', 'em_missing', 'List', '/api/ghost'),
    ]);

    expect(pruneOrphanEdgeApis()).toBe(1);
    expect(deleteEdgeApiDefinitionById).toHaveBeenCalledWith('ea_ghost');
    expect(deleteEdgeApiDefinitionById).not.toHaveBeenCalledWith('ea_live');
  });

  it('removes duplicate APIs that share a key or base path', () => {
    const first = { ...api('ea_1', 'em_a', 'List', '/api/kkkkkkk/list'), version: 1 };
    const second = { ...api('ea_2', 'em_a', 'List', '/api/kkkkkkk/list'), version: 2 };
    listEdgeApiDefinitions.mockReturnValue([first, second]);

    expect(pruneDuplicateEdgeApis()).toBe(1);
    expect(deleteEdgeApiDefinitionById).toHaveBeenCalledWith('ea_1');
    expect(deleteEdgeApiDefinitionById).not.toHaveBeenCalledWith('ea_2');
  });

  it('removes DATA_API functions whose definition was deleted', () => {
    listEdgeApiDefinitions.mockReturnValue([]);
    listManagedFunctionsFromStore.mockReturnValue([
      {
        id: 'data-api.ghost-list',
        engine_type: 'DATA_API',
        metadata_json: JSON.stringify({ edgeApiDefinitionId: 'ea_ghost' }),
      },
      {
        id: 'custom.hello',
        engine_type: 'SANDBOX_JS',
        metadata_json: null,
      },
    ]);

    expect(pruneOrphanDataApiManagedFunctions()).toBe(1);
    expect(deleteManagedFunctionFromStore).toHaveBeenCalledWith('data-api.ghost-list');
    expect(deleteManagedFunctionFromStore).not.toHaveBeenCalledWith('custom.hello');
  });

  it('removes published Edge APIs whose managed functions are already gone', () => {
    listEdgeApiDefinitions.mockReturnValue([
      {
        ...api('ea_ghost', 'em_live', 'List', '/api/ghost'),
        publishedAt: '2026-07-23T06:08:20.219Z',
        managedFunctionId: 'data-api.ghost-list',
      },
    ]);
    listManagedFunctionsFromStore.mockReturnValue([]);
    getEdgeApiDefinitionById.mockReturnValue({
      ...api('ea_ghost', 'em_live', 'List', '/api/ghost'),
      publishedAt: '2026-07-23T06:08:20.219Z',
      managedFunctionId: 'data-api.ghost-list',
    });

    expect(pruneEdgeApisWithMissingManagedFunctions()).toBe(1);
    expect(deleteEdgeApiDefinitionById).toHaveBeenCalledWith('ea_ghost');
  });

  it('removes indexed model and API files that no longer parse', () => {
    listEdgeModelIndexIds.mockReturnValue(['em_bad', 'em_ok']);
    listEdgeApiIndexIds.mockReturnValue(['ea_bad', 'ea_ok']);
    getEdgeModelById.mockImplementation((id: string) => (id === 'em_ok' ? model('em_ok', 'orders') : null));
    getEdgeApiDefinitionById.mockImplementation((id: string) => (
      id === 'ea_ok' ? api('ea_ok', 'em_ok', 'List', '/api/orders') : null
    ));

    expect(pruneUnreadableEdgeStoreRecords()).toBe(2);
    expect(deleteEdgeModelStudioMeta).toHaveBeenCalledWith('em_bad');
    expect(deleteEdgeModel).toHaveBeenCalledWith('em_bad');
    expect(deleteEdgeModel).not.toHaveBeenCalledWith('em_ok');
    expect(deleteEdgeApiDefinition).toHaveBeenCalledWith('ea_bad');
    expect(deleteEdgeApiDefinition).not.toHaveBeenCalledWith('ea_ok');
  });

  it('removes edge models that have no APIs', () => {
    const used = model('em_cms', 'cms_contents');
    const leftover = model('em_test', 'testtest');
    listEdgeModels.mockReturnValue([used, leftover]);
    listEdgeApiDefinitions.mockReturnValue([api('ea_cms', 'em_cms', 'cms-contents', '/api/cms/contents')]);
    getEdgeModelById.mockImplementation((id: string) => (
      id === 'em_cms' ? used : id === 'em_test' ? leftover : null
    ));

    expect(pruneEdgeModelsWithoutApis()).toBe(1);
    expect(deleteEdgeModel).toHaveBeenCalledWith('em_test');
    expect(deleteEdgeModel).not.toHaveBeenCalledWith('em_cms');
  });
});
