import { describe, expect, it } from 'vitest';
import {
  associationShapeKey,
  associationsFromSuggestions,
  buildManualAssociation,
  foreignKeyOwnerForKind,
  preferredForeignKeyColumnName,
  resolveAssociationTargetModelId,
  suggestAssociationAlias,
  suggestAssociationsFromPhysicalRelations,
  suggestForeignKeyColumn,
  suggestThroughTableName,
  supportsPhysicalNatureConversion,
  validateAssociationDraft,
} from '../edgeModelAssociations';

describe('edgeModelAssociations', () => {
  it('places the foreign key on the source for belongsTo and on the target otherwise', () => {
    expect(foreignKeyOwnerForKind('belongsTo')).toBe('source');
    expect(foreignKeyOwnerForKind('hasOne')).toBe('target');
    expect(foreignKeyOwnerForKind('hasMany')).toBe('target');
    expect(foreignKeyOwnerForKind('belongsToMany')).toBe('through');
    expect(supportsPhysicalNatureConversion('belongsToMany')).toBe(false);
  });

  it('suggests unique aliases', () => {
    const used = new Set(['orders']);
    expect(suggestAssociationAlias('hasMany', 'orders', used)).toBe('orders_list');
    expect(suggestAssociationAlias('belongsToMany', 'roles', new Set())).toBe('roles');
    expect(suggestAssociationAlias('belongsTo', 'customers', new Set())).toBe('customer');
  });

  it('prefers belongsTo aliases from the foreign-key column', () => {
    expect(suggestAssociationAlias(
      'belongsTo',
      'base_info',
      new Set(),
      'content_type_code',
    )).toBe('content_type');
    expect(suggestAssociationAlias(
      'belongsTo',
      'base_info',
      new Set(['content_type']),
      'content_type_code',
    )).toBe('content_type_ref');
    expect(suggestAssociationAlias(
      'belongsTo',
      'customers',
      new Set(),
      'customer_id',
    )).toBe('customer');
    expect(suggestAssociationAlias(
      'belongsTo',
      'base_info',
      new Set(),
      'genderCode',
    )).toBe('gender');
    // Collections keep the target name even when an FK is provided.
    expect(suggestAssociationAlias(
      'hasMany',
      'order_items',
      new Set(),
      'order_id',
    )).toBe('order_items');
  });

  it('suggests through table and FK column names for belongsToMany', () => {
    expect(preferredForeignKeyColumnName('users')).toBe('user_id');
    expect(preferredForeignKeyColumnName('base_roles')).toBe('base_role_id');
    expect(suggestThroughTableName('products', 'base_roles', new Set())).toBe('product_base_roles');
    expect(suggestThroughTableName('products', 'base_roles', new Set(['product_base_roles']))).toBe(
      'product_base_roles_2',
    );
  });

  it('suggests foreign-key columns from the referenced table name', () => {
    expect(suggestForeignKeyColumn(['id', 'customer_id', 'total'], 'customers')).toBe('customer_id');
    expect(suggestForeignKeyColumn(['id', 'categories_id'], 'categories')).toBe('categories_id');
    expect(suggestForeignKeyColumn(['only_col'], 'anything')).toBe('only_col');
  });

  it('resolves target model ids from id, object name, or display label', () => {
    const peers = [
      { id: 'm-products', objectName: 'products' },
      { id: 'm-base-info', objectName: 'base_info' },
    ];
    expect(resolveAssociationTargetModelId({
      targetModelId: 'm-base-info',
      peers,
      sourceModelId: 'm-products',
    })).toBe('m-base-info');
    expect(resolveAssociationTargetModelId({
      targetModelId: 'base_info',
      peers,
      sourceModelId: 'm-products',
    })).toBe('m-base-info');
    expect(resolveAssociationTargetModelId({
      targetModelId: '',
      targetObjectName: 'Base Info (base_info)',
      peers,
      sourceModelId: 'm-products',
    })).toBe('m-base-info');
  });

  it('validates alias shape and uniqueness', () => {
    expect(validateAssociationDraft(
      {
        kind: 'belongsTo',
        targetModelId: 'm2',
        foreignKey: 'customer_id',
        as: '1bad',
      },
      {
        sourceModelId: 'm1',
        existing: [],
        foreignKeyOptions: ['customer_id'],
        targetModelIds: new Set(['m2']),
      },
    )).toMatch(/Alias must start/i);

    expect(validateAssociationDraft(
      {
        kind: 'belongsTo',
        targetModelId: 'm2',
        foreignKey: 'customer_id',
        as: 'customer',
      },
      {
        sourceModelId: 'm1',
        existing: [{ id: 'a1', as: 'customer' }],
        foreignKeyOptions: ['customer_id'],
        targetModelIds: new Set(['m2']),
      },
    )).toMatch(/already used/i);
  });

  it('validates and builds belongsToMany associations with through keys', () => {
    expect(validateAssociationDraft(
      {
        kind: 'belongsToMany',
        targetModelId: 'm_roles',
        throughModelId: 'm_user_roles',
        foreignKey: 'user_id',
        otherKey: 'role_id',
        as: 'roles',
      },
      {
        sourceModelId: 'm_users',
        existing: [],
        foreignKeyOptions: ['user_id', 'role_id'],
        otherKeyOptions: ['user_id', 'role_id'],
        targetModelIds: new Set(['m_roles', 'm_user_roles']),
        throughModelIds: new Set(['m_roles', 'm_user_roles']),
      },
    )).toBeNull();

    expect(validateAssociationDraft(
      {
        kind: 'belongsToMany',
        targetModelId: 'm_roles',
        throughModelId: 'm_users',
        foreignKey: 'user_id',
        otherKey: 'role_id',
        as: 'roles',
      },
      {
        sourceModelId: 'm_users',
        existing: [],
        foreignKeyOptions: ['user_id', 'role_id'],
        otherKeyOptions: ['user_id', 'role_id'],
        targetModelIds: new Set(['m_roles']),
        throughModelIds: new Set(['m_users']),
      },
    )).toMatch(/different from the source/i);

    const built = buildManualAssociation({
      kind: 'belongsToMany',
      targetModelId: 'm_roles',
      throughModelId: 'm_user_roles',
      foreignKey: 'user_id',
      otherKey: 'role_id',
      as: 'roles',
    });
    expect(built).toMatchObject({
      kind: 'belongsToMany',
      throughModelId: 'm_user_roles',
      foreignKey: 'user_id',
      otherKey: 'role_id',
      as: 'roles',
      source: 'manual',
    });
    expect(associationShapeKey(built)).toBe(
      'belongsToMany|m_roles|m_user_roles|user_id|role_id',
    );
  });

  it('suggests belongsTo for outbound FKs and hasMany for inbound FKs', () => {
    const suggestions = suggestAssociationsFromPhysicalRelations({
      focusObjectName: 'orders',
      dataSourceId: 'ds1',
      models: [
        { id: 'm_orders', objectName: 'orders', dataSourceId: 'ds1' },
        { id: 'm_customers', objectName: 'customers', dataSourceId: 'ds1' },
        { id: 'm_items', objectName: 'order_items', dataSourceId: 'ds1' },
      ],
      existing: [],
      relations: [
        {
          fromTable: 'orders',
          fromColumn: 'customer_id',
          toTable: 'customers',
          toColumn: 'id',
          constraintName: 'fk_orders_customer',
        },
        {
          fromTable: 'order_items',
          fromColumn: 'order_id',
          toTable: 'orders',
          toColumn: 'id',
        },
      ],
    });

    expect(suggestions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'belongsTo',
        targetModelId: 'm_customers',
        foreignKey: 'customer_id',
      }),
      expect.objectContaining({
        kind: 'hasMany',
        targetModelId: 'm_items',
        foreignKey: 'order_id',
      }),
    ]));

    const associations = associationsFromSuggestions(suggestions);
    expect(associations.every((item) => item.source === 'catalog')).toBe(true);
  });

  it('skips suggestions that already exist', () => {
    const suggestions = suggestAssociationsFromPhysicalRelations({
      focusObjectName: 'orders',
      dataSourceId: 'ds1',
      models: [
        { id: 'm_orders', objectName: 'orders', dataSourceId: 'ds1' },
        { id: 'm_customers', objectName: 'customers', dataSourceId: 'ds1' },
      ],
      existing: [{
        as: 'customer',
        kind: 'belongsTo',
        targetModelId: 'm_customers',
        foreignKey: 'customer_id',
      }],
      relations: [{
        fromTable: 'orders',
        fromColumn: 'customer_id',
        toTable: 'customers',
        toColumn: 'id',
      }],
    });

    expect(suggestions).toHaveLength(0);
  });
});
