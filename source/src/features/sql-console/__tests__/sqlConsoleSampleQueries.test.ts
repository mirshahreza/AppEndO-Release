import { describe, expect, it } from 'vitest';
import { DataSourceType } from '../../../shared/api/contracts/data-sources/types';
import {
  buildSqlConsoleSampleQueries,
  isSqlConsoleSampleEngine,
} from '../sqlConsoleSampleQueries';

describe('buildSqlConsoleSampleQueries', () => {
  it('returns three dialect-aware samples for PostgreSQL', () => {
    const samples = buildSqlConsoleSampleQueries(DataSourceType.POSTGRES);
    expect(samples.map((item) => item.id)).toEqual(['list-tables', 'platform-users', 'users-and-roles']);
    expect(samples[0]?.sql).toContain("table_schema = 'public'");
    expect(samples[1]?.sql).toMatch(/LIMIT 50;/);
    expect(samples[1]?.sql).not.toMatch(/password_hash/);
    expect(samples[2]?.sql).toContain('LEFT JOIN base_user_roles');
    expect(samples[2]?.sql).toMatch(/LIMIT 50;/);
  });

  it('uses TOP for SQL Server and sqlite_master for SQLite', () => {
    const sqlServer = buildSqlConsoleSampleQueries(DataSourceType.SQL_SERVER);
    expect(sqlServer[0]?.sql).toContain('INFORMATION_SCHEMA.TABLES');
    expect(sqlServer[1]?.sql).toMatch(/^SELECT TOP 50 /);
    expect(sqlServer[1]?.sql).not.toMatch(/\bLIMIT\b/);

    const sqlite = buildSqlConsoleSampleQueries(DataSourceType.SQLITE);
    expect(sqlite[0]?.sql).toContain('sqlite_master');
    expect(sqlite[1]?.sql).toMatch(/LIMIT 50;/);
  });

  it('skips non-SQL engines', () => {
    expect(buildSqlConsoleSampleQueries('Unknown')).toEqual([]);
    expect(buildSqlConsoleSampleQueries('')).toEqual([]);
    expect(isSqlConsoleSampleEngine(DataSourceType.POSTGRES)).toBe(true);
    expect(isSqlConsoleSampleEngine('Unknown')).toBe(false);
  });
});
