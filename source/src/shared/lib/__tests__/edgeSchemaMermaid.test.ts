import { describe, expect, it } from 'vitest';
import { buildEdgeSchemaMermaid } from '../edgeSchemaMermaid';
import type { SchemaRelationsSnapshot } from '../../api/contracts/data-sources/schemaRelations';

const snapshot: SchemaRelationsSnapshot = {
  focusObject: 'orders',
  objectType: 'TABLE',
  tables: [
    {
      name: 'orders',
      columns: [
        { name: 'id', dataType: 'integer', isPrimaryKey: true },
        { name: 'customer_id', dataType: 'integer', isPrimaryKey: false },
      ],
    },
    {
      name: 'customers',
      columns: [
        { name: 'id', dataType: 'integer', isPrimaryKey: true },
      ],
    },
  ],
  relations: [
    {
      fromTable: 'orders',
      fromColumn: 'customer_id',
      toTable: 'customers',
      toColumn: 'id',
      constraintName: 'fk_orders_customer',
    },
  ],
};

describe('buildEdgeSchemaMermaid', () => {
  it('builds an erDiagram with entities and foreign-key edges', () => {
    const chart = buildEdgeSchemaMermaid(snapshot);

    expect(chart).toContain('erDiagram');
    expect(chart).toContain('orders {');
    expect(chart).toContain('customers {');
    expect(chart).toContain('orders }o--|| customers : customer_id');
  });
});
