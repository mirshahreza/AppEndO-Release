import { describe, expect, it } from 'vitest';
import {
  buildAddColumnStatement,
  buildAddColumnStatements,
  buildDropColumnStatement,
  resolveNewTableColumns,
  resolveRemovedTableColumnNames,
} from '../schemaObjectAlteration';
import type { EdgeModelColumn } from '../../api/contracts/data-api';

const sampleColumn = (
  name: string,
  dataType = 'text',
): EdgeModelColumn => ({
  name,
  field: name,
  dataType,
  sequelizeType: 'STRING',
  allowNull: true,
  isPrimaryKey: false,
  isForeignKey: false,
});

describe('buildAddColumnStatement', () => {
  it('builds PostgreSQL ADD COLUMN statements', () => {
    expect(buildAddColumnStatement('PostgreSQL', 'orders', {
      name: 'customer_name',
      dataType: 'text',
      allowNull: true,
    })).toBe('ALTER TABLE "orders" ADD COLUMN "customer_name" text NULL');
  });

  it('builds SQLite ADD COLUMN statements', () => {
    expect(buildAddColumnStatement('SQLite', 'orders', {
      name: 'customer_name',
      dataType: 'TEXT',
      allowNull: false,
    })).toBe('ALTER TABLE orders ADD COLUMN customer_name TEXT NOT NULL');
  });

  it('builds MySQL ADD COLUMN statements', () => {
    expect(buildAddColumnStatement('MySQL', 'orders', {
      name: 'total_amount',
      dataType: 'decimal(10,2)',
      allowNull: false,
    })).toBe('ALTER TABLE orders ADD COLUMN total_amount decimal(10,2) NOT NULL');
  });
});

describe('buildAddColumnStatements', () => {
  it('returns one statement per column', () => {
    expect(buildAddColumnStatements('PostgreSQL', 'orders', [
      { name: 'first_name', dataType: 'text', allowNull: true },
      { name: 'last_name', dataType: 'text', allowNull: true },
    ])).toHaveLength(2);
  });
});

describe('resolveNewTableColumns', () => {
  it('returns only columns missing from the database', () => {
    expect(resolveNewTableColumns(
      [sampleColumn('id'), sampleColumn('title')],
      new Set(['id']),
    ).map((column) => column.name)).toEqual(['title']);
  });
});

describe('buildDropColumnStatement', () => {
  it('builds PostgreSQL DROP COLUMN statements', () => {
    expect(buildDropColumnStatement('PostgreSQL', 'orders', 'legacy_code')).toBe(
      'ALTER TABLE "orders" DROP COLUMN "legacy_code"',
    );
  });

  it('builds MySQL DROP COLUMN statements', () => {
    expect(buildDropColumnStatement('MySQL', 'orders', 'legacy_code')).toBe(
      'ALTER TABLE orders DROP COLUMN legacy_code',
    );
  });
});

describe('resolveRemovedTableColumnNames', () => {
  it('returns database columns missing from the desired model', () => {
    expect(resolveRemovedTableColumnNames(
      [sampleColumn('id'), sampleColumn('title')],
      new Set(['id', 'title', 'legacy_code']),
    )).toEqual(['legacy_code']);
  });
});
