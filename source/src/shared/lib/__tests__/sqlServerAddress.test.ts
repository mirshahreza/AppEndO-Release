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

  it('splits host:port and raw IPv4 instead of keeping the port inside the server name', () => {
    expect(parseSqlServerAddress('10.1.2.3:1433', 1433)).toEqual({
      host: '10.1.2.3',
      port: 1433,
    });
    expect(parseSqlServerHost('10.1.2.3:1433')).toEqual({
      server: '10.1.2.3',
      instanceName: '',
      port: 1433,
    });
    expect(parseSqlServerHost('10.1.2.3')).toEqual({
      server: '10.1.2.3',
      instanceName: '',
      port: null,
    });
    expect(parseSqlServerHost('db.internal:1433')).toEqual({
      server: 'db.internal',
      instanceName: '',
      port: 1433,
    });
    expect(buildSqlServerHostToken('10.1.2.3:1433', 1433)).toBe('10.1.2.3:1433');
    expect(parseSqlServerAddress('localhost,1433', 1433)).toEqual({
      host: 'localhost',
      port: 1433,
    });
  });

  it('parses dot-instance host for local SQL Server', () => {
    expect(parseSqlServerHost('.\\SQL2025')).toEqual({
      server: 'localhost',
      instanceName: 'SQL2025',
      port: null,
    });
  });
});
