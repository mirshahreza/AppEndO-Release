import { describe, expect, it } from 'vitest';
import type { EdgeModelColumn } from '../../api/contracts/data-api';
import {
  annotateEdgeModelColumnsWithForeignKeys,
  buildOutboundForeignKeyMap,
  formatForeignKeyTargetLabel,
} from '../edgeModelForeignKeys';

const column = (name: string, overrides: Partial<EdgeModelColumn> = {}): EdgeModelColumn => ({
  name,
  field: name,
  dataType: 'uuid',
  sequelizeType: 'STRING',
  allowNull: true,
  isPrimaryKey: false,
  isForeignKey: false,
  ...overrides,
});

describe('edgeModelForeignKeys', () => {
  it('maps outbound foreign keys by local column', () => {
    const map = buildOutboundForeignKeyMap('orders', [
      {
        fromTable: 'orders',
        fromColumn: 'customer_id',
        toTable: 'customers',
        toColumn: 'id',
      },
      {
        fromTable: 'order_items',
        fromColumn: 'order_id',
        toTable: 'orders',
        toColumn: 'id',
      },
    ]);

    expect([...map.entries()]).toEqual([
      ['customer_id', { toTable: 'customers', toColumn: 'id', constraintName: undefined }],
    ]);
    expect(formatForeignKeyTargetLabel(map.get('customer_id')!)).toBe('customers.id');
  });

  it('annotates columns and resolves fkTarget when a peer model exists', () => {
    const annotated = annotateEdgeModelColumnsWithForeignKeys(
      [
        column('id', { isPrimaryKey: true, allowNull: false }),
        column('customer_id'),
        column('notes'),
      ],
      {
        objectName: 'orders',
        dataSourceId: 'ds1',
        relations: [
          {
            fromTable: 'orders',
            fromColumn: 'customer_id',
            toTable: 'customers',
            toColumn: 'id',
          },
        ],
        models: [
          { id: 'mdl_customers', dataSourceId: 'ds1', objectName: 'customers' },
        ],
      },
    );

    expect(annotated[1]).toMatchObject({
      name: 'customer_id',
      isForeignKey: true,
      fkTarget: { modelId: 'mdl_customers', column: 'id' },
    });
    expect(annotated[2].isForeignKey).toBe(false);
    expect(annotated[2].fkTarget).toBeUndefined();
  });

  it('clears stale foreign-key flags when the relation is gone', () => {
    const annotated = annotateEdgeModelColumnsWithForeignKeys(
      [
        column('customer_id', {
          isForeignKey: true,
          fkTarget: { modelId: 'mdl_customers', column: 'id' },
        }),
      ],
      {
        objectName: 'orders',
        dataSourceId: 'ds1',
        relations: [],
        models: [],
      },
    );

    expect(annotated[0].isForeignKey).toBe(false);
    expect(annotated[0].fkTarget).toBeUndefined();
  });
});
