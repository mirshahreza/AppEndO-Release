import { describe, expect, it } from 'vitest';

import {
  buildControlPlaneUrlFromInstallPayload,
  defaultInstallDatabasePayload,
} from '../controlPlaneInstall';

describe('controlPlaneInstall', () => {
  it('builds postgresql url from install payload', () => {
    const url = buildControlPlaneUrlFromInstallPayload({
      provider: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'AppEnd',
      username: 'postgres',
      password: 'secret',
      encrypt: true,
      trustServerCertificate: true,
    });

    expect(url).toBe('postgresql://postgres:secret@localhost:5432/AppEnd');
  });

  it('builds sqlite file url from install payload', () => {
    const url = buildControlPlaneUrlFromInstallPayload({
      provider: 'sqlite',
      host: 'localhost',
      port: 0,
      database: 'data/appendo-control.db',
      username: '',
      password: '',
      encrypt: true,
      trustServerCertificate: true,
    });

    expect(url.startsWith('file:')).toBe(true);
    expect(url).toContain('appendo-control.db');
    expect(url).not.toContain('\\');
  });

  it('builds sqlserver url with trustServerCertificate flag', () => {
    const url = buildControlPlaneUrlFromInstallPayload({
      provider: 'sqlserver',
      host: 'localhost,1433',
      port: 1433,
      database: 'AppEnd',
      username: 'sa',
      password: 'secret',
      encrypt: true,
      trustServerCertificate: true,
    });

    expect(url).toContain('sqlserver://localhost,1433;');
    expect(url).toContain('database=AppEnd');
    expect(url).toContain('trustServerCertificate=true');
  });

  it('builds sqlserver url without port for named instance host', () => {
    const url = buildControlPlaneUrlFromInstallPayload({
      provider: 'sqlserver',
      host: 'localhost\\SQLEXPRESS',
      port: 1433,
      database: 'AppEnd',
      username: 'sa',
      password: 'secret',
      encrypt: true,
      trustServerCertificate: true,
    });

    expect(url).toContain('sqlserver://localhost\\SQLEXPRESS;');
    expect(url).not.toContain(':1433');
  });

  it('builds sqlserver url for dot-instance host', () => {
    const url = buildControlPlaneUrlFromInstallPayload({
      provider: 'sqlserver',
      host: '.\\SQL2025',
      port: 0,
      database: 'AppEnd',
      username: 'sa',
      password: '1',
      encrypt: true,
      trustServerCertificate: true,
    });

    expect(url).toContain('sqlserver://.\\SQL2025;');
    expect(url).toContain('database=AppEnd');
  });

  it('defaults install payload to sqlserver', () => {
    expect(defaultInstallDatabasePayload().provider).toBe('sqlserver');
  });
});
