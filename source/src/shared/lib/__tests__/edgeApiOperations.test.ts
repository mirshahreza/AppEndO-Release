import { describe, expect, it } from 'vitest';
import { buildDefaultCollectionOperations, deriveDataApiBasePath, enrichEdgeApiOperationsFromModel } from '../edgeApiOperations';

describe('edgeApiOperations', () => {
  it('derives REST base paths from object names', () => {
    expect(deriveDataApiBasePath('customer_orders')).toBe('/api/customer_orders');
  });

  it('builds default Sequelize collection operations', () => {
    const operations = buildDefaultCollectionOperations('/api/customer_orders');
    expect(operations).toHaveLength(5);
    expect(operations.map((operation) => operation.method)).toEqual(['GET', 'GET', 'POST', 'PUT', 'DELETE']);
  });

  it('enriches operations with model field projections', () => {
    const operations = buildDefaultCollectionOperations('/api/widgets');
    const enriched = enrichEdgeApiOperationsFromModel(operations, {
      id: 'em_test',
      dataSourceId: 'ds1',
      schema: null,
      objectName: 'widgets',
      objectType: 'TABLE',
      sequelize: { modelName: 'Widgets', tableName: 'widgets' },
      columns: [
        {
          name: 'id',
          field: 'id',
          dataType: 'INTEGER',
          sequelizeType: 'INTEGER',
          allowNull: false,
          isPrimaryKey: true,
          isForeignKey: false,
        },
        {
          name: 'title',
          field: 'title',
          dataType: 'TEXT',
          sequelizeType: 'STRING',
          allowNull: false,
          isPrimaryKey: false,
          isForeignKey: false,
        },
      ],
      primaryKey: 'id',
      associations: [],
      schemaFingerprint: 'fp',
      readOnly: false,
      labels: { title: 'Widgets' },
      status: 'ready',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });

    expect(enriched[0]?.fields?.read).toEqual(['id', 'title']);
    expect(enriched[0]?.fields?.write).toBeUndefined();
    expect(enriched[0]?.fields?.required).toBeUndefined();
    expect(enriched[2]?.fields?.write).toEqual(['title']);
    expect(enriched[2]?.fields?.required).toEqual(['title']);
  });
});
