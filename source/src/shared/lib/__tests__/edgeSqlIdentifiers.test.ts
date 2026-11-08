import { describe, expect, it } from 'vitest';
import { isSqlServerDataSourceType, quoteEdgeSqlColumn } from '../edgeSqlIdentifiers';

describe('edgeSqlIdentifiers', () => {
  it('quotes reserved columns for SQL Server data sources', () => {
    expect(isSqlServerDataSourceType('SQL Server')).toBe(true);
    expect(quoteEdgeSqlColumn('file', 'SQL Server')).toBe('[file]');
    expect(quoteEdgeSqlColumn('file_xs', 'SQL Server')).toBe('[file_xs]');
  });

  it('leaves PostgreSQL column names unquoted', () => {
    expect(quoteEdgeSqlColumn('file', 'PostgreSQL')).toBe('file');
  });
});
