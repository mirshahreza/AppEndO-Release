import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildSqliteControlPlaneUrl,
  parseSqliteControlPlaneFilePath,
  readControlPlaneDatabaseSettings,
  removeSqliteControlPlaneFiles,
  toInstallSqliteDatabasePath,
  validateControlPlaneDatabaseSettings,
} from '../controlPlaneDatabase';

const tempDirs: string[] = [];

const writeSettings = (dir: string, body: Record<string, unknown>) => {
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify(body, null, 2), 'utf8');
};

const createSettingsDir = (body: Record<string, unknown>) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-cp-db-'));
  tempDirs.push(dir);
  writeSettings(dir, body);
  return path.join(dir, 'settings.json');
};

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('readControlPlaneDatabaseSettings', () => {
  it('defaults missing install to SQL Server with Prisma, not PostgreSQL pg-pool', () => {
    const settingsPath = createSettingsDir({});
    const settings = readControlPlaneDatabaseSettings(settingsPath);
    expect(settings.provider).toBe('sqlserver');
    expect(settings.engine).toBe('prisma');
    expect(settings.url).not.toMatch(/^postgresql:/i);
  });

  it('keeps SQL Server when engine is omitted', () => {
    const settingsPath = createSettingsDir({
      runtime: { databaseProvider: 'sqlserver' },
      database: {
        provider: 'sqlserver',
        url: 'sqlserver://localhost\\SQL2025;database=AppEnd;user=sa;encrypt=true;trustServerCertificate=true',
      },
    });
    const settings = readControlPlaneDatabaseSettings(settingsPath);
    expect(settings.provider).toBe('sqlserver');
    expect(settings.engine).toBe('prisma');
    expect(settings.url).toContain('sqlserver://localhost\\SQL2025');
  });

  it('infers SQL Server from the default data source when the database block is missing', () => {
    const settingsPath = createSettingsDir({
      runtime: { databaseProvider: 'postgres' },
      dataSources: [
        {
          id: 'ds_default',
          name: 'default-db',
          type: 'SQL Server',
          host: 'localhost\\SQL2025',
          port: 0,
          database: 'AppEnd',
          username: 'sa',
          isDefault: true,
        },
      ],
    });
    const settings = readControlPlaneDatabaseSettings(settingsPath);
    expect(settings.provider).toBe('sqlserver');
    expect(settings.engine).toBe('prisma');
    expect(settings.url).toContain('sqlserver://');
    expect(settings.url).not.toMatch(/^postgresql:/i);
  });

  it('rejects pg-pool for a non-PostgreSQL provider', () => {
    expect(() => validateControlPlaneDatabaseSettings({
      provider: 'sqlserver',
      url: 'sqlserver://localhost;database=AppEnd;user=sa',
      engine: 'pg-pool',
    })).toThrow(/pg-pool engine is only valid for PostgreSQL/);
  });
});

describe('sqlite control plane paths', () => {
  it('builds a Prisma file URL with forward slashes', () => {
    const url = buildSqliteControlPlaneUrl(path.join('data', 'appendo-control.db'));
    expect(url.startsWith('file:')).toBe(true);
    expect(url).toContain('appendo-control.db');
    expect(url).not.toContain('\\');
  });

  it('parses file URLs including Windows absolute paths', () => {
    const abs = path.join(process.cwd(), 'data', 'appendo-control.db');
    expect(parseSqliteControlPlaneFilePath(`file:${abs.replace(/\\/g, '/')}`)).toBe(path.resolve(abs));
    expect(toInstallSqliteDatabasePath(abs)).toBe('data/appendo-control.db');
  });

  it('removes sqlite sidecar files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-sqlite-rm-'));
    tempDirs.push(dir);
    const dbPath = path.join(dir, 'appendo-control.db');
    fs.writeFileSync(dbPath, 'db');
    fs.writeFileSync(`${dbPath}-wal`, 'wal');
    fs.writeFileSync(`${dbPath}-shm`, 'shm');
    removeSqliteControlPlaneFiles(`file:${dbPath.replace(/\\/g, '/')}`);
    expect(fs.existsSync(dbPath)).toBe(false);
    expect(fs.existsSync(`${dbPath}-wal`)).toBe(false);
    expect(fs.existsSync(`${dbPath}-shm`)).toBe(false);
  });
});
