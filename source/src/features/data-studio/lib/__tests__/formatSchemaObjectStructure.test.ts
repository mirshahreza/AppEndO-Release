import { describe, expect, it } from 'vitest';
import {
  formatPrimaryKeyLabel,
  formatSchemaObjectStructureLabel,
} from '../formatSchemaObjectStructure';

describe('formatSchemaObjectStructure', () => {
  it('formats table column count and primary key', () => {
    expect(formatSchemaObjectStructureLabel({
      objectKind: 'TABLE',
      columnCount: 5,
      primaryKey: 'id',
    })).toBe('5 columns · PK: id');
  });

  it('formats composite primary keys', () => {
    expect(formatPrimaryKeyLabel(['tenant_id', 'id'])).toBe('tenant_id, id');
    expect(formatSchemaObjectStructureLabel({
      objectKind: 'TABLE',
      columnCount: 2,
      primaryKey: ['tenant_id', 'id'],
    })).toBe('2 columns · PK: tenant_id, id');
  });

  it('formats routines without primary key', () => {
    expect(formatSchemaObjectStructureLabel({
      objectKind: 'STORED_PROCEDURE',
      columnCount: 3,
      primaryKey: null,
    })).toBe('3 params');
  });
});
