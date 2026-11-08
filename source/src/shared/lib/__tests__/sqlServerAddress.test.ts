import { describe, expect, it } from 'vitest';

import {
  buildSqlServerHostToken,
  isSqlServerNamedInstanceHost,
  parseSqlServerAddress,
  parseSqlServerHost,
} from '../sqlServerAddress';

describe('sqlServerAddress', () => {
  it('detects named instance hosts', () => {
    expect(isSqlServerNamedInstanceHost('.\\SQL2025')).toBe(true);
    expect(isSqlServerNamedInstanceHost('localhost\\SQLEXPRESS')).toBe(true);
    expect(isSqlServerNamedInstanceHost('localhost,1433')).toBe(false);
    expect(isSqlServerNamedInstanceHost('localhost')).toBe(false);
  });

  it('parses named instance without port', () => {
    expect(parseSqlServerAddress('localhost\\SQLEXPRESS', 1433)).toEqual({
      host: 'localhost\\SQLEXPRESS',
      port: 0,
    });
  });

  it('builds host token without port for named instance', () => {
    expect(buildSqlServerHostToken('localhost\\SQLEXPRESS', 1433)).toBe('localhost\\SQLEXPRESS');
  });

  it('builds host token with port for plain host', () => {
    expect(buildSqlServerHostToken('localhost', 1433)).toBe('localhost:1433');
  });

  it('parses dot-instance host for local SQL Server', () => {
    expect(parseSqlServerHost('.\\SQL2025')).toEqual({
      server: 'localhost',
      instanceName: 'SQL2025',
      port: null,
    });
  });
});
