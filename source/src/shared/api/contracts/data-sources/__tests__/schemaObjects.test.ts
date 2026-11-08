import { describe, expect, it } from 'vitest';
import { normalizeSchemaObjectListItem } from '../schemaObjects';

describe('normalizeSchemaObjectListItem', () => {
  it('reads camelCase summary fields', () => {
    expect(normalizeSchemaObjectListItem({
      name: 'users',
      columnCount: 5,
      primaryKey: 'id',
    })).toEqual({
      name: 'users',
      columnCount: 5,
      primaryKey: 'id',
    });
  });

  it('reads snake_case summary fields', () => {
    expect(normalizeSchemaObjectListItem({
      name: 'orders',
      column_count: '8',
      primary_key: 'tenant_id, id',
    })).toEqual({
      name: 'orders',
      columnCount: 8,
      primaryKey: ['tenant_id', 'id'],
    });
  });
});
