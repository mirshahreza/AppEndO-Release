import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EdgeModelAssociation, EdgeModelDefinition } from '../../../../shared/api/contracts/data-api';

const listEdgeModels = vi.fn();
const getEdgeModelById = vi.fn();
const saveEdgeModel = vi.fn();
const deleteEdgeModel = vi.fn();
const getEdgeModelStudioMeta = vi.fn();
const upsertEdgeModelStudioMeta = vi.fn();
const parkEdgeModelStudioMeta = vi.fn();

vi.mock('../edgeModelStore', () => ({
  listEdgeModels: (...args: unknown[]) => listEdgeModels(...args),
  getEdgeModelById: (...args: unknown[]) => getEdgeModelById(...args),
  saveEdgeModel: (...args: unknown[]) => saveEdgeModel(...args),
  deleteEdgeModel: (...args: unknown[]) => deleteEdgeModel(...args),
}));

vi.mock('../edgeModelStudioMetaStore', () => ({
  getEdgeModelStudioMeta: (...args: unknown[]) => getEdgeModelStudioMeta(...args),
  upsertEdgeModelStudioMeta: (...args: unknown[]) => upsertEdgeModelStudioMeta(...args),
  parkEdgeModelStudioMeta: (...args: unknown[]) => parkEdgeModelStudioMeta(...args),
}));

const listEdgeApiDefinitions = vi.fn(() => []);
const deleteEdgeApiDefinitionById = vi.fn();
const listRecordPoliciesForModel = vi.fn(() => []);
const deleteRecordPolicy = vi.fn();
const deleteRecordPolicyBinding = vi.fn();

vi.mock('../edgeApiStore', () => ({
  listEdgeApiDefinitions: (...args: unknown[]) => listEdgeApiDefinitions(...args),
}));

vi.mock('../edgeApiPublisher', () => ({
  deleteEdgeApiDefinitionById: (...args: unknown[]) => deleteEdgeApiDefinitionById(...args),
}));

vi.mock('../../record-policy/recordPolicyStore', () => ({
  listRecordPoliciesForModel: (...args: unknown[]) => listRecordPoliciesForModel(...args),
  deleteRecordPolicy: (...args: unknown[]) => deleteRecordPolicy(...args),
}));

vi.mock('../../record-policy/recordPolicyBindingStore', () => ({
  deleteRecordPolicyBinding: (...args: unknown[]) => deleteRecordPolicyBinding(...args),
}));

const { collectEdgeModelDeleteRelationImpact, cleanupEdgeModelsForDeletedSchemaObject } = await import(
  '../edgeModelDeleteCleanup'
);

const baseModel = (
  overrides: Partial<EdgeModelDefinition> & Pick<EdgeModelDefinition, 'id' | 'objectName' | 'associations'>,
): EdgeModelDefinition => ({
  id: overrides.id,
  dataSourceId: 'ds1',
  schema: null,
  objectName: overrides.objectName,
  objectType: 'TABLE',
  sequelize: {
    modelName: overrides.objectName,
    tableName: overrides.objectName,
  },
  columns: [],
  primaryKey: 'id',
  associations: overrides.associations,
  schemaFingerprint: 'fp',
  readOnly: false,
  labels: { title: overrides.objectName },
  status: 'ready',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const belongsTo = (
  id: string,
  targetModelId: string,
  as: string,
): EdgeModelAssociation => ({
  id,
  kind: 'belongsTo',
  targetModelId,
  foreignKey: `${as}_id`,
  as,
  source: 'manual',
});

describe('edgeModelDeleteCleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getEdgeModelStudioMeta.mockReturnValue({
      edgeModelId: 'x',
      tags: [],
      columnMeta: [],
      associationMeta: [],
      extensions: {},
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    getEdgeModelById.mockReturnValue(null);
    listEdgeApiDefinitions.mockReturnValue([]);
    listRecordPoliciesForModel.mockReturnValue([]);
  });

  it('collects outbound and inbound logical relation impact', () => {
    const products = baseModel({
      id: 'em_products',
      objectName: 'products',
      associations: [belongsTo('a1', 'em_base_info', 'product_category')],
    });
    const orders = baseModel({
      id: 'em_orders',
      objectName: 'orders',
      associations: [belongsTo('a2', 'em_products', 'product')],
    });
    listEdgeModels.mockReturnValue([products, orders]);
    getEdgeModelStudioMeta.mockReturnValue({
      edgeModelId: 'em_products',
      tags: ['shop'],
      columnMeta: [],
      associationMeta: [{ relationKey: 'a1', displayLabel: 'Category' }],
      extensions: {},
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });

    const impact = collectEdgeModelDeleteRelationImpact({
      dataSourceId: 'ds1',
      objectName: 'products',
      objectType: 'TABLE',
    });

    expect(impact.edgeModelId).toBe('em_products');
    expect(impact.outboundLogicalCount).toBe(1);
    expect(impact.outboundAliases).toEqual(['product_category']);
    expect(impact.inboundRefs).toEqual([
      {
        peerObjectName: 'orders',
        peerModelId: 'em_orders',
        as: 'product',
        kind: 'belongsTo',
        role: 'target',
      },
    ]);
    expect(impact.willParkStudioMeta).toBe(true);
  });

  it('cleans peer associations, peer associationMeta, studio-meta, and focus model', () => {
    const products = baseModel({
      id: 'em_products',
      objectName: 'products',
      associations: [belongsTo('a1', 'em_base_info', 'product_category')],
    });
    const orders = baseModel({
      id: 'em_orders',
      objectName: 'orders',
      associations: [
        belongsTo('a2', 'em_products', 'product'),
        belongsTo('a3', 'em_customers', 'customer'),
      ],
    });
    listEdgeModels.mockReturnValue([products, orders]);
    listEdgeApiDefinitions.mockReturnValue([
      { id: 'ea_products', edgeModelId: 'em_products' },
    ]);
    listRecordPoliciesForModel.mockImplementation((modelId: string) => (
      modelId === 'em_products' ? [{ id: 'rp_products' }] : []
    ));
    getEdgeModelStudioMeta.mockImplementation((id: string) => ({
      edgeModelId: id,
      tags: [],
      columnMeta: [],
      associationMeta: id === 'em_orders'
        ? [
          { relationKey: 'a2', displayLabel: 'Product' },
          { relationKey: 'a3', displayLabel: 'Customer' },
        ]
        : [{ relationKey: 'a1', displayLabel: 'Category' }],
      extensions: {},
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    }));

    cleanupEdgeModelsForDeletedSchemaObject({
      dataSourceId: 'ds1',
      objectName: 'products',
      objectType: 'TABLE',
    });

    expect(saveEdgeModel).toHaveBeenCalledTimes(1);
    const savedPeer = saveEdgeModel.mock.calls[0]?.[0] as EdgeModelDefinition;
    expect(savedPeer.id).toBe('em_orders');
    expect(savedPeer.associations.map((item) => item.id)).toEqual(['a3']);

    expect(upsertEdgeModelStudioMeta).toHaveBeenCalledWith('em_orders', {
      associationMeta: [{ relationKey: 'a3', displayLabel: 'Customer' }],
    });
    expect(parkEdgeModelStudioMeta).toHaveBeenCalledWith(expect.objectContaining({ id: 'em_products' }));
    expect(deleteEdgeModel).toHaveBeenCalledWith('em_products');
    expect(deleteEdgeApiDefinitionById).toHaveBeenCalledWith('ea_products');
    expect(deleteRecordPolicy).toHaveBeenCalledWith('rp_products');
    expect(deleteRecordPolicyBinding).toHaveBeenCalledWith('em_products');
  });
});
