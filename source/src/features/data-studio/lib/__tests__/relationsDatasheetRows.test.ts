import { describe, expect, it } from 'vitest';
import type { EdgeModelAssociation, EdgeModelDefinition } from '../../../../shared/api/contracts/data-api';
import { buildRelationsDatasheetRows } from '../relationsDatasheetRows';

const peer = (id: string, objectName: string, title?: string): Pick<EdgeModelDefinition, 'id' | 'objectName' | 'labels'> => ({
  id,
  objectName,
  labels: { title: title ?? objectName },
});

describe('buildRelationsDatasheetRows', () => {
  it('merges matching physical and logical twins into one row', () => {
    const association: EdgeModelAssociation = {
      id: 'a1',
      kind: 'belongsTo',
      targetModelId: 'm_base',
      foreignKey: 'category_id',
      as: 'product_category',
      source: 'manual',
    };
    const rows = buildRelationsDatasheetRows({
      objectName: 'products',
      physicalRelations: [{
        fromTable: 'products',
        fromColumn: 'category_id',
        toTable: 'base_info',
        toColumn: 'id',
        constraintName: 'fk_products_category_id',
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      }],
      associations: [association],
      peerModels: [peer('m_base', 'base_info', 'base_info')],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      nature: 'both',
      name: 'product_category',
      kindLabel: 'Belongs to',
      fromLabel: 'products.category_id',
      toLabel: 'base_info.id',
    });
  });

  it('renders belongsToMany as a logical row with via through labels', () => {
    const association: EdgeModelAssociation = {
      id: 'a_m2m',
      kind: 'belongsToMany',
      targetModelId: 'm_roles',
      throughModelId: 'm_user_roles',
      foreignKey: 'user_id',
      otherKey: 'role_id',
      as: 'roles',
      source: 'manual',
    };
    const rows = buildRelationsDatasheetRows({
      objectName: 'users',
      physicalRelations: [],
      associations: [association],
      peerModels: [
        peer('m_roles', 'roles'),
        peer('m_user_roles', 'user_roles'),
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      nature: 'logical',
      name: 'roles',
      kindLabel: 'Belongs to many',
      fromLabel: 'users · via user_roles.user_id',
      toLabel: 'roles · via user_roles.role_id',
    });
  });

  it('keeps unmatched physical and logical rows separate', () => {
    const association: EdgeModelAssociation = {
      id: 'a2',
      kind: 'hasMany',
      targetModelId: 'm_lines',
      foreignKey: 'product_id',
      as: 'lines',
      source: 'manual',
    };
    const rows = buildRelationsDatasheetRows({
      objectName: 'products',
      physicalRelations: [{
        fromTable: 'products',
        fromColumn: 'category_id',
        toTable: 'base_info',
        toColumn: 'id',
        constraintName: 'fk_products_category_id',
      }],
      associations: [association],
      peerModels: [
        peer('m_base', 'base_info'),
        peer('m_lines', 'order_lines'),
      ],
    });

    expect(rows.map((row) => row.nature).sort()).toEqual(['logical', 'physical']);
    const physical = rows.find((row) => row.nature === 'physical');
    expect(physical?.kindLabel).toBe('Belongs to');
    const logical = rows.find((row) => row.nature === 'logical');
    expect(logical?.kindLabel).toBe('Has many');
  });

  it('labels inbound physical FKs as Has many from the focus table', () => {
    const rows = buildRelationsDatasheetRows({
      objectName: 'base_info',
      physicalRelations: [{
        fromTable: 'products',
        fromColumn: 'category_id',
        toTable: 'base_info',
        toColumn: 'id',
        constraintName: 'fk_products_category_id',
      }],
      associations: [],
      peerModels: [peer('m_products', 'products')],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      nature: 'physical',
      kindLabel: 'Has many',
    });
  });

  it('hides through-table physical FKs covered by a self belongsToMany', () => {
    const association: EdgeModelAssociation = {
      id: 'a_related',
      kind: 'belongsToMany',
      targetModelId: 'm_contents',
      throughModelId: 'm_relations',
      foreignKey: 'content_id_a',
      otherKey: 'content_id_b',
      as: 'relatedContents',
      source: 'manual',
    };
    const rows = buildRelationsDatasheetRows({
      objectName: 'cms_contents',
      physicalRelations: [
        {
          fromTable: 'cms_content_relations',
          fromColumn: 'content_id_a',
          toTable: 'cms_contents',
          toColumn: 'id',
          constraintName: 'cms_content_relations_content_id_a_fkey',
        },
        {
          fromTable: 'cms_content_relations',
          fromColumn: 'content_id_b',
          toTable: 'cms_contents',
          toColumn: 'id',
          constraintName: 'cms_content_relations_content_id_b_fkey',
        },
      ],
      associations: [association],
      peerModels: [
        peer('m_contents', 'cms_contents'),
        peer('m_relations', 'cms_content_relations'),
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      nature: 'logical',
      name: 'relatedContents',
      kindLabel: 'Belongs to many',
    });
  });
});
