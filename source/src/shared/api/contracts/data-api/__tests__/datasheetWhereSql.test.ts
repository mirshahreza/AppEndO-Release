import { describe, expect, it } from 'vitest';
import {
  buildDatasheetSelectSql,
  parseDatasheetSelectSql,
  parseDatasheetWhereSql,
} from '../datasheetWhereSql';

describe('parseDatasheetWhereSql', () => {
  it('treats empty input as unfiltered', () => {
    expect(parseDatasheetWhereSql('')).toBeNull();
    expect(parseDatasheetWhereSql('   ')).toBeNull();
    expect(parseDatasheetWhereSql(undefined)).toBeNull();
  });

  it('strips a leading WHERE and returns the fragment', () => {
    expect(parseDatasheetWhereSql("WHERE status = 1 AND city = 'Tehran'")).toBe(
      "status = 1 AND city = 'Tehran'",
    );
  });

  it('extracts WHERE from a SELECT sentence', () => {
    expect(parseDatasheetWhereSql("SELECT * FROM dbo.Orders WHERE status = 'open'")).toBe(
      "status = 'open'",
    );
  });

  it('allows DELETE inside a string literal', () => {
    expect(parseDatasheetWhereSql("status IN ('deleted')")).toBe("status IN ('deleted')");
  });

  it('rejects multiple statements and DML', () => {
    expect(() => parseDatasheetWhereSql('1 = 1; DROP TABLE x')).toThrow(/Multiple SQL/);
    expect(() => parseDatasheetWhereSql('1 = 1 OR 1 = 1; DELETE FROM t')).toThrow(/Multiple SQL/);
    expect(() => parseDatasheetWhereSql('status = 1; INSERT INTO t VALUES (1)')).toThrow(/Multiple SQL/);
  });

  it('rejects comments and changing keywords outside quotes', () => {
    expect(() => parseDatasheetWhereSql('status = 1 -- comment')).toThrow(/comments/);
    expect(() => parseDatasheetWhereSql('1 = 1 DROP TABLE x')).toThrow(/filter expression/);
  });

  it('rejects SELECT that joins another table', () => {
    expect(() => parseDatasheetWhereSql('SELECT * FROM a JOIN b ON a.id = b.id WHERE 1 = 1')).toThrow(
      /Only a SELECT/,
    );
  });
});

describe('parseDatasheetSelectSql', () => {
  it('defaults empty input to 100 rows and all columns', () => {
    expect(parseDatasheetSelectSql('')).toEqual({
      limit: 100,
      whereSql: null,
      columnNames: null,
    });
  });

  it('reads TOP and named columns', () => {
    const parsed = parseDatasheetSelectSql(
      'SELECT TOP 50 [Id], [Title] FROM [dbo].[Posts] WHERE status = 1',
    );
    expect(parsed.limit).toBe(50);
    expect(parsed.columnNames).toEqual(['Id', 'Title']);
    expect(parsed.whereSql).toBe('status = 1');
  });

  it('reads LIMIT after the table', () => {
    const parsed = parseDatasheetSelectSql(
      'SELECT "id", "name" FROM "orders" WHERE city = \'Tehran\' LIMIT 25',
    );
    expect(parsed.limit).toBe(25);
    expect(parsed.columnNames).toEqual(['id', 'name']);
    expect(parsed.whereSql).toBe("city = 'Tehran'");
  });

  it('rejects a limit above 200', () => {
    expect(() => parseDatasheetSelectSql('SELECT TOP 500 id FROM t')).toThrow(/more than 200/);
  });
});

describe('buildDatasheetSelectSql', () => {
  it('lists columns and TOP for SQL Server', () => {
    expect(buildDatasheetSelectSql({
      sourceType: 'SQL Server',
      schema: 'dbo',
      objectName: 'Orders',
      columnNames: ['Id', 'Status'],
      limit: 100,
    })).toBe('SELECT TOP 100 [Id], [Status] FROM [dbo].[Orders]');
  });

  it('lists columns and LIMIT for PostgreSQL', () => {
    expect(buildDatasheetSelectSql({
      sourceType: 'PostgreSQL',
      schema: 'public',
      objectName: 'orders',
      columnNames: ['id', 'status'],
      limit: 100,
      whereSql: 'status = 1',
    })).toBe('SELECT "id", "status" FROM "public"."orders" WHERE status = 1 LIMIT 100');
  });
});
