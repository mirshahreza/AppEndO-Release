import { describe, expect, it } from 'vitest';
import {
  mergeSchemaRelationsSnapshots,
  reconcileFocusSchemaRelationsRefresh,
} from '../mergeSchemaRelationsSnapshots';
import type { SchemaRelationsSnapshot } from '../../api/contracts/data-sources/schemaRelations';

const base: SchemaRelationsSnapshot = {
  focusObject: 'attachments',
  objectType: 'TABLE',
  tables: [
    { name: 'attachments', columns: [{ name: 'id', dataType: 'uuid', isPrimaryKey: true }] },
    { name: 'feedback', columns: [{ name: 'id', dataType: 'uuid', isPrimaryKey: true }] },
  ],
  relations: [
    {
      fromTable: 'attachments',
      fromColumn: 'feedback_id',
      toTable: 'feedback',
      toColumn: 'id',
    },
  ],
};

describe('mergeSchemaRelationsSnapshots', () => {
  it('merges new tables and relations while keeping the original focus', () => {
    const addition: SchemaRelationsSnapshot = {
      focusObject: 'feedback',
      objectType: 'TABLE',
      tables: [
        { name: 'feedback', columns: [{ name: 'id', dataType: 'uuid', isPrimaryKey: true }] },
        { name: 'users', columns: [{ name: 'id', dataType: 'uuid', isPrimaryKey: true }] },
      ],
      relations: [
        {
          fromTable: 'feedback',
          fromColumn: 'user_id',
          toTable: 'users',
          toColumn: 'id',
        },
      ],
    };

    const merged = mergeSchemaRelationsSnapshots(base, addition);
    expect(merged.focusObject).toBe('attachments');
    expect(merged.tables.map((table) => table.name).sort()).toEqual(['attachments', 'feedback', 'users']);
    expect(merged.relations).toHaveLength(2);
  });
});

describe('reconcileFocusSchemaRelationsRefresh', () => {
  it('drops stale focus foreign-keys while keeping expanded peer edges', () => {
    const working: SchemaRelationsSnapshot = {
      focusObject: 'products',
      objectType: 'TABLE',
      tables: [
        { name: 'products', columns: [{ name: 'id', dataType: 'uuid', isPrimaryKey: true }] },
        { name: 'categories', columns: [{ name: 'id', dataType: 'uuid', isPrimaryKey: true }] },
        { name: 'base_info', columns: [{ name: 'id', dataType: 'uuid', isPrimaryKey: true }] },
        { name: 'users', columns: [{ name: 'id', dataType: 'uuid', isPrimaryKey: true }] },
      ],
      relations: [
        {
          fromTable: 'products',
          fromColumn: 'category_id',
          toTable: 'categories',
          toColumn: 'id',
        },
        {
          fromTable: 'products',
          fromColumn: 'info_id',
          toTable: 'base_info',
          toColumn: 'id',
        },
        {
          fromTable: 'categories',
          fromColumn: 'user_id',
          toTable: 'users',
          toColumn: 'id',
        },
      ],
    };

    const server: SchemaRelationsSnapshot = {
      focusObject: 'products',
      objectType: 'TABLE',
      tables: [
        { name: 'products', columns: [{ name: 'id', dataType: 'uuid', isPrimaryKey: true }] },
        { name: 'categories', columns: [{ name: 'id', dataType: 'uuid', isPrimaryKey: true }] },
      ],
      relations: [
        {
          fromTable: 'products',
          fromColumn: 'category_id',
          toTable: 'categories',
          toColumn: 'id',
        },
      ],
    };

    const next = reconcileFocusSchemaRelationsRefresh(server, working);
    expect(next.relations).toEqual([
      {
        fromTable: 'products',
        fromColumn: 'category_id',
        toTable: 'categories',
        toColumn: 'id',
      },
      {
        fromTable: 'categories',
        fromColumn: 'user_id',
        toTable: 'users',
        toColumn: 'id',
      },
    ]);
    expect(next.tables.map((table) => table.name).sort()).toEqual([
      'base_info',
      'categories',
      'products',
      'users',
    ]);
  });
});
