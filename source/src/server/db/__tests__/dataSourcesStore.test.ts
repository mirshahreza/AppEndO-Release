import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CREDENTIAL_MASTER_KEY_ENV,
  encryptCredential,
  resetCredentialMasterKeyCacheForTests,
} from '../../domain/security/credentialVault/credentialCrypto';
import {
  ensureDataSourcesSettings,
  getDataSourcesFromSettings,
  persistControlPlaneFromDefaultDataSource,
  resetEdgeDataSourcesCatalogForTests,
  toApiDataSource,
  upsertDefaultDataSourceFromInstall,
} from '../dataSourcesStore';

const tempDirs: string[] = [];

const writeSettings = (dir: string, body: Record<string, unknown>) => {
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify(body, null, 2), 'utf8');
};

const createSettingsDir = (body: Record<string, unknown>) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-ds-'));
  tempDirs.push(dir);
  writeSettings(dir, body);
  return dir;
};

const originalMaster = process.env[CREDENTIAL_MASTER_KEY_ENV];

beforeEach(() => {
  process.env[CREDENTIAL_MASTER_KEY_ENV] = crypto.randomBytes(32).toString('hex');
  resetCredentialMasterKeyCacheForTests();
  resetEdgeDataSourcesCatalogForTests();
});

afterEach(() => {
  if (originalMaster === undefined) {
    delete process.env[CREDENTIAL_MASTER_KEY_ENV];
  } else {
    process.env[CREDENTIAL_MASTER_KEY_ENV] = originalMaster;
  }
  resetCredentialMasterKeyCacheForTests();
  resetEdgeDataSourcesCatalogForTests();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('dataSourcesStore control plane sync', () => {
  it('repairs stale PostgreSQL placeholder after SQL Server install', () => {
    const dir = createSettingsDir({
      runtime: { databaseProvider: 'sqlserver' },
      install: { databaseInitialized: true, completedAt: '2026-01-01T00:00:00.000Z' },
      database: {
        provider: 'sqlserver',
        url: 'sqlserver://localhost\\SQL2025;database=AppEnd;user=sa;encrypt=true;trustServerCertificate=true',
        engine: 'prisma',
      },
      dataSources: [
        {
          id: 'ds_default_local',
          name: 'PostgreSQL 18 (Local)',
          type: 'PostgreSQL',
          host: 'localhost',
          port: 5432,
          database: 'AppEnd',
          username: 'postgres',
          passwordCipher: encryptCredential('secret'),
          isDefault: true,
          status: 'connected',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    const settingsPath = path.join(dir, 'settings.json');

    ensureDataSourcesSettings(settingsPath);
    const items = getDataSourcesFromSettings(settingsPath);

    expect(items).toHaveLength(1);
    expect(items[0]?.type).toBe('SQL Server');
    expect(items[0]?.name).toBe('default-db');
    expect(items[0]?.host).toBe('localhost\\SQL2025');
    expect(items[0]?.database).toBe('AppEnd');
    expect(items[0]?.username).toBe('sa');
    expect(items[0]?.isDefault).toBe(true);
    expect(items[0]?.password).toBe('secret');
  });

  it('does not overwrite a SQL Server default when control plane is PostgreSQL', () => {
    const dir = createSettingsDir({
      runtime: { databaseProvider: 'postgres' },
      install: { databaseInitialized: true, completedAt: '2026-01-01T00:00:00.000Z' },
      database: {
        provider: 'postgresql',
        url: 'postgresql://postgres@localhost:5432/AppEnd',
        engine: 'prisma',
      },
      dataSources: [
        {
          id: 'ds_default_local',
          name: 'default-db',
          type: 'SQL Server',
          host: 'localhost\\SQL2025',
          port: 0,
          database: 'AppEnd',
          username: 'sa',
          passwordCipher: encryptCredential('secret'),
          isDefault: true,
          status: 'connected',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    const settingsPath = path.join(dir, 'settings.json');

    ensureDataSourcesSettings(settingsPath);
    const items = getDataSourcesFromSettings(settingsPath);

    expect(items).toHaveLength(1);
    expect(items[0]?.type).toBe('SQL Server');
    expect(items[0]?.host).toBe('localhost\\SQL2025');
    expect(items[0]?.username).toBe('sa');
  });

  it('upserts SQL Server default data source from install payload without writing plaintext', () => {
    const dir = createSettingsDir({});
    const settingsPath = path.join(dir, 'settings.json');

    upsertDefaultDataSourceFromInstall(settingsPath, {
      provider: 'sqlserver',
      host: 'localhost\\SQL2025',
      port: 0,
      database: 'AppEnd',
      username: 'sa',
      password: 'secret',
      encrypt: true,
      trustServerCertificate: true,
    });

    const items = getDataSourcesFromSettings(settingsPath);
    expect(items).toHaveLength(1);
    expect(items[0]?.type).toBe('SQL Server');
    expect(items[0]?.name).toBe('default-db');
    expect(items[0]?.created_by).toBe('admin');
    expect(items[0]?.updated_at).toBe('');
    expect(items[0]?.updated_by).toBeNull();
    expect(items[0]?.password).toBe('secret');

    const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as {
      dataSources?: Array<Record<string, unknown>>;
    };
    expect(saved.dataSources?.[0]?.password).toBeUndefined();
    expect(saved.dataSources?.[0]?.passwordCipher).toEqual(expect.objectContaining({
      alg: 'aes-256-gcm',
    }));
  });

  it('persists SQL Server control-plane settings from the default data source without a url password', () => {
    const dir = createSettingsDir({
      runtime: { databaseProvider: 'postgres' },
    });
    const settingsPath = path.join(dir, 'settings.json');

    persistControlPlaneFromDefaultDataSource(settingsPath, {
      id: 'ds_default_local',
      name: 'default-db',
      type: 'SQL Server',
      host: 'localhost\\SQL2025',
      port: 0,
      database: 'AppEnd',
      username: 'sa',
      password: 'secret',
      encrypt: true,
      trustServerCertificate: true,
      pooling: true,
      status: 'connected',
      isDefault: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '',
    });

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as {
      database?: { provider?: string; engine?: string; url?: string };
      runtime?: { databaseProvider?: string };
    };
    expect(settings.database?.provider).toBe('sqlserver');
    expect(settings.database?.engine).toBe('prisma');
    expect(settings.database?.url).toContain('sqlserver://localhost\\SQL2025');
    expect(settings.database?.url).not.toMatch(/password=/i);
    expect(settings.runtime?.databaseProvider).toBe('sqlserver');
  });

  it('omits password from the public API shape', () => {
    const api = toApiDataSource({
      id: 'ds_x',
      name: 'X',
      type: 'PostgreSQL',
      host: 'localhost',
      port: 5432,
      database: 'db',
      username: 'user',
      password: 'raw-secret',
      encrypt: true,
      trustServerCertificate: true,
      pooling: false,
      status: 'connected',
      isDefault: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '',
    });
    expect(api).not.toHaveProperty('password');
    expect(api.hasPassword).toBe(true);
  });

  it('does not invent a PostgreSQL default when SQL Server was stored without database.engine', () => {
    const dir = createSettingsDir({
      runtime: { databaseProvider: 'sqlserver' },
      install: { databaseInitialized: true, completedAt: '2026-01-01T00:00:00.000Z' },
      database: {
        provider: 'sqlserver',
        url: 'sqlserver://localhost\\SQL2025;database=AppEnd;user=sa;encrypt=true;trustServerCertificate=true',
      },
      dataSources: [
        {
          id: 'ds_default',
          name: 'default-db',
          type: 'SQL Server',
          host: 'localhost\\SQL2025',
          port: 0,
          database: 'AppEnd',
          username: 'sa',
          passwordCipher: encryptCredential('secret'),
          isDefault: true,
          status: 'connected',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '',
        },
      ],
    });
    const settingsPath = path.join(dir, 'settings.json');

    ensureDataSourcesSettings(settingsPath);
    const items = getDataSourcesFromSettings(settingsPath);

    expect(items).toHaveLength(1);
    expect(items[0]?.type).toBe('SQL Server');
    expect(items[0]?.username).toBe('sa');

    const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as {
      dataSources?: Array<Record<string, unknown>>;
    };
    expect(saved.dataSources?.[0]?.type).toBe('SQL Server');
  });
});
