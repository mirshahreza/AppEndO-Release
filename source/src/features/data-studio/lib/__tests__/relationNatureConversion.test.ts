import { describe, expect, it } from 'vitest';
import type { EdgeModelAssociation, EdgeModelDefinition } from '../../../../shared/api/contracts/data-api';
import {
  buildAddForeignKeyFromPlan,
  findAssociationForPhysicalRelation,
  findPhysicalRelationForAssociation,
  formatReferentialActionLabel,
  physicalMatchesAssociation,
  planLogicalToPhysical,
  planPhysicalToLogical,
} from '../relationNatureConversion';

const focusModel = {
  id: 'm-orders',
  objectName: 'orders',
  dataSourceId: 'ds1',
  primaryKey: 'id',
  columns: [
    { name: 'id', dataType: 'uuid', isPrimaryKey: true },
    { name: 'customer_id', dataType: 'uuid', isPrimaryKey: false },
  ],
} as EdgeModelDefinition;

const customerModel = {
  id: 'm-customers',
  objectName: 'customers',
  dataSourceId: 'ds1',
  primaryKey: 'id',
  columns: [
    { name: 'id', dataType: 'uuid', isPrimaryKey: true },
  ],
} as EdgeModelDefinition;

describe('relationNatureConversion', () => {
  it('plans belongsTo logical → physical on the focus table', () => {
    const association = {
      id: 'a1',
      kind: 'belongsTo',
      targetModelId: customerModel.id,
      foreignKey: 'customer_id',
      as: 'customer',
      source: 'manual',
    } satisfies EdgeModelAssociation;

    const plan = planLogicalToPhysical({
      association,
      focusModel,
      targetModel: customerModel,
    });

    expect(plan).toMatchObject({
      tableName: 'orders',
      columnName: 'customer_id',
      referencedTable: 'customers',
      referencedColumn: 'id',
      altersPeerTable: false,
    });
  });

  it('plans hasMany logical → physical on the peer table', () => {
    const association = {
      id: 'a2',
      kind: 'hasMany',
      targetModelId: customerModel.id,
      foreignKey: 'order_id',
      as: 'items',
      source: 'manual',
    } satisfies EdgeModelAssociation;

    const plan = planLogicalToPhysical({
      association,
      focusModel,
      targetModel: customerModel,
    });

    expect(plan).toMatchObject({
      tableName: 'customers',
      columnName: 'order_id',
      referencedTable: 'orders',
      referencedColumn: 'id',
      altersPeerTable: true,
    });
  });

  it('builds add-FK payload with cascade actions', () => {
    const plan = planLogicalToPhysical({
      association: {
        id: 'a1',
        kind: 'belongsTo',
        targetModelId: customerModel.id,
        foreignKey: 'customer_id',
        as: 'customer',
        source: 'manual',
      },
      focusModel,
      targetModel: customerModel,
    });
    expect('error' in plan).toBe(false);
    if ('error' in plan) {
      return;
    }

    expect(buildAddForeignKeyFromPlan({
      dataSourceId: 'ds1',
      plan,
      onDelete: 'CASCADE',
      onUpdate: 'RESTRICT',
    })).toMatchObject({
      dataSourceId: 'ds1',
      tableName: 'orders',
      columnName: 'customer_id',
      referencedTable: 'customers',
      referencedColumn: 'id',
      onDelete: 'CASCADE',
      onUpdate: 'RESTRICT',
    });
  });

  it('plans physical → logical belongsTo for outbound FK', () => {
    const result = planPhysicalToLogical({
      focusObjectName: 'orders',
      relation: {
        fromTable: 'orders',
        fromColumn: 'customer_id',
        toTable: 'customers',
        toColumn: 'id',
        constraintName: 'fk_orders_customer_id',
      },
      models: [focusModel, customerModel],
      dataSourceId: 'ds1',
      existing: [],
    });

    expect(result).toMatchObject({
      kind: 'belongsTo',
      foreignKey: 'customer_id',
      targetModelId: customerModel.id,
    });
    if ('error' in result) {
      return;
    }
    expect(result.association.source).toBe('catalog');
  });

  it('does not convert or twin-match belongsToMany associations', () => {
    const association = {
      id: 'a_m2m',
      kind: 'belongsToMany' as const,
      targetModelId: customerModel.id,
      throughModelId: 'm-user-roles',
      foreignKey: 'user_id',
      otherKey: 'role_id',
      as: 'roles',
      source: 'manual' as const,
    } satisfies EdgeModelAssociation;
    const plan = planLogicalToPhysical({
      association,
      focusModel,
      targetModel: customerModel,
    });
    expect(plan).toMatchObject({ error: expect.stringMatching(/logical/i) });
    expect(physicalMatchesAssociation({
      association,
      focusObjectName: 'orders',
      targetObjectName: 'customers',
      relation: {
        fromTable: 'orders',
        fromColumn: 'user_id',
        toTable: 'customers',
        toColumn: 'id',
      },
    })).toBe(false);
  });

  it('detects matching physical/logical twins', () => {
    const association = {
      id: 'a1',
      kind: 'belongsTo' as const,
      targetModelId: customerModel.id,
      foreignKey: 'customer_id',
      as: 'customer',
      source: 'manual' as const,
    };
    const relation = {
      fromTable: 'orders',
      fromColumn: 'customer_id',
      toTable: 'customers',
      toColumn: 'id',
      constraintName: 'fk_orders_customer_id',
    };
    expect(physicalMatchesAssociation({
      association,
      focusObjectName: 'orders',
      targetObjectName: 'customers',
      relation,
    })).toBe(true);
    expect(findAssociationForPhysicalRelation({
      relation,
      focusObjectName: 'orders',
      associations: [association],
      models: [focusModel, customerModel],
    })?.id).toBe('a1');
    expect(findPhysicalRelationForAssociation({
      association,
      focusObjectName: 'orders',
      targetObjectName: 'customers',
      relations: [relation],
    })?.constraintName).toBe('fk_orders_customer_id');
  });

  it('formats cascade labels', () => {
    expect(formatReferentialActionLabel('CASCADE', 'RESTRICT')).toBe(
      'ON DELETE CASCADE · ON UPDATE RESTRICT',
    );
    expect(formatReferentialActionLabel(null, null)).toBeNull();
  });
});
