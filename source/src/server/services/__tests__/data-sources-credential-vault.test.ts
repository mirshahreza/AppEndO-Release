import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HttpError } from '../../errors/HttpError';
import { DataSourcesService } from '../data-sources.service';
import {
  CREDENTIAL_KEY_VERSION_ENV,
  CREDENTIAL_MASTER_KEY_ENV,
  resetCredentialMasterKeyCacheForTests,
} from '../../domain/security/credentialVault/credentialCrypto';
import { configureCredentialVaultSequelizeForTests } from '../../domain/security/credentialVault/credentialVault';
import {
  ensureCredentialVaultTable,
  resetCredentialVaultModelCacheForTests,
} from '../../domain/security/credentialVault/credentialVaultSequelizeModel';
import { configureEdgeDataSourceSequelizeForTests } from '../../domain/data-sources/edgeDataSourceRepository';
import {
  ensureEdgeDataSourcesTable,
  resetEdgeDataSourceModelCacheForTests,
} from '../../domain/data-sources/edgeDataSourceSequelizeModel';
import {
  getDataSourcesFromSettings,
  resetEdgeDataSourcesCatalogForTests,
  saveDataSourcesToSettings,
  toApiDataSource,
} from '../../db/dataSourcesStore';

const originalMaster = process.env[CREDENTIAL_MASTER_KEY_ENV];
const originalVersion = process.env[CREDENTIAL_KEY_VERSION_ENV];

let sequelize: Sequelize;
let tempDir: string;
let settingsPath: string;

beforeEach(async () => {
  process.env[CREDENTIAL_MASTER_KEY_ENV] = crypto.randomBytes(32).toString('hex');
  process.env[CREDENTIAL_KEY_VERSION_ENV] = '1';
  resetCredentialMasterKeyCacheForTests();
  resetCredentialVaultModelCacheForTests();
  resetEdgeDataSourceModelCacheForTests();
  resetEdgeDataSourcesCatalogForTests();
  sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
  configureCredentialVaultSequelizeForTests(sequelize);
  configureEdgeDataSourceSequelizeForTests(sequelize);
  await ensureCredentialVaultTable(sequelize);
  await ensureEdgeDataSourcesTable(sequelize);

  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-ds-svc-'));
  settingsPath = path.join(tempDir, 'settings.json');
  fs.writeFileSync(settingsPath, '{}', 'utf8');
  saveDataSourcesToSettings(settingsPath, [{
    id: 'ds_default',
    name: 'default-db',
    type: 'PostgreSQL',
    host: 'localhost',
    port: 5432,
    database: 'AppEnd',
    username: 'postgres',
    password: 'default-secret',
    status: 'connected',
    isDefault: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '',
  }]);
});

afterEach(async () => {
  configureCredentialVaultSequelizeForTests(null);
  configureEdgeDataSourceSequelizeForTests(null);
  resetCredentialVaultModelCacheForTests();
  resetEdgeDataSourceModelCacheForTests();
  resetEdgeDataSourcesCatalogForTests();
  await sequelize.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalMaster === undefined) delete process.env[CREDENTIAL_MASTER_KEY_ENV];
  else process.env[CREDENTIAL_MASTER_KEY_ENV] = originalMaster;
  if (originalVersion === undefined) delete process.env[CREDENTIAL_KEY_VERSION_ENV];
  else process.env[CREDENTIAL_KEY_VERSION_ENV] = originalVersion;
  resetCredentialMasterKeyCacheForTests();
});

describe('DataSourcesService credential vault', () => {
  it('rejects writable isDefault and always creates edge sources', async () => {
    const service = new DataSourcesService({ settingsPath });

    await expect(service.create({
      name: 'Reporting',
      type: 'PostgreSQL',
      host: 'localhost',
      port: 5432,
      isDefault: true,
    })).rejects.toBeInstanceOf(HttpError);

    const created = await service.create({
      name: 'Reporting',
      type: 'PostgreSQL',
      host: 'localhost',
      port: 5432,
      database: 'reports',
      username: 'reader',
      password: 'edge-secret',
    });
    expect(created.statusCode).toBe(201);

    const listed = service.list();
    expect(listed.body.items).toHaveLength(2);
    const edge = listed.body.items.find((item) => item.name === 'Reporting');
    expect(edge?.isDefault).toBe(false);
    expect(edge).not.toHaveProperty('password');
    expect(edge?.hasPassword).toBe(true);

    await expect(service.update(String(created.body.id), { isDefault: true }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('keeps the default secret when the password field is blank', async () => {
    const service = new DataSourcesService({ settingsPath });
    await service.update('ds_default', { name: 'Control plane', password: '' });
    const stored = getDataSourcesFromSettings(settingsPath).find((item) => item.id === 'ds_default');
    expect(stored?.name).toBe('Control plane');
    expect(stored?.password).toBe('default-secret');
    expect(toApiDataSource(stored!).hasPassword).toBe(true);
  });
});
