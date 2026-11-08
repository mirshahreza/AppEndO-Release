import crypto from 'node:crypto';
import { Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CREDENTIAL_KEY_VERSION_ENV,
  CREDENTIAL_MASTER_KEY_ENV,
  CREDENTIAL_PREVIOUS_KEY_ENV,
  resetCredentialMasterKeyCacheForTests,
} from '../../security/credentialVault/credentialCrypto';
import {
  configureCredentialVaultSequelizeForTests,
  getSecret,
} from '../../security/credentialVault/credentialVault';
import {
  ensureCredentialVaultTable,
  resetCredentialVaultModelCacheForTests,
} from '../../security/credentialVault/credentialVaultSequelizeModel';
import {
  configureEdgeDataSourceSequelizeForTests,
  deleteEdgeDataSource,
  listHydratedEdgeDataSources,
  upsertEdgeDataSource,
} from '../edgeDataSourceRepository';
import {
  ensureEdgeDataSourcesTable,
  resetEdgeDataSourceModelCacheForTests,
} from '../edgeDataSourceSequelizeModel';

const originalMaster = process.env[CREDENTIAL_MASTER_KEY_ENV];
const originalVersion = process.env[CREDENTIAL_KEY_VERSION_ENV];
const originalPrevious = process.env[CREDENTIAL_PREVIOUS_KEY_ENV];

let sequelize: Sequelize;

const restoreEnv = (): void => {
  if (originalMaster === undefined) delete process.env[CREDENTIAL_MASTER_KEY_ENV];
  else process.env[CREDENTIAL_MASTER_KEY_ENV] = originalMaster;
  if (originalVersion === undefined) delete process.env[CREDENTIAL_KEY_VERSION_ENV];
  else process.env[CREDENTIAL_KEY_VERSION_ENV] = originalVersion;
  if (originalPrevious === undefined) delete process.env[CREDENTIAL_PREVIOUS_KEY_ENV];
  else process.env[CREDENTIAL_PREVIOUS_KEY_ENV] = originalPrevious;
  resetCredentialMasterKeyCacheForTests();
};

beforeEach(async () => {
  restoreEnv();
  process.env[CREDENTIAL_MASTER_KEY_ENV] = crypto.randomBytes(32).toString('hex');
  process.env[CREDENTIAL_KEY_VERSION_ENV] = '1';
  delete process.env[CREDENTIAL_PREVIOUS_KEY_ENV];
  resetCredentialMasterKeyCacheForTests();
  resetCredentialVaultModelCacheForTests();
  resetEdgeDataSourceModelCacheForTests();
  sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
  configureCredentialVaultSequelizeForTests(sequelize);
  configureEdgeDataSourceSequelizeForTests(sequelize);
  await ensureCredentialVaultTable(sequelize);
  await ensureEdgeDataSourcesTable(sequelize);
});

afterEach(async () => {
  configureCredentialVaultSequelizeForTests(null);
  configureEdgeDataSourceSequelizeForTests(null);
  resetCredentialVaultModelCacheForTests();
  resetEdgeDataSourceModelCacheForTests();
  await sequelize.close();
  restoreEnv();
});

describe('edgeDataSourceRepository', () => {
  it('stores metadata without a password column and keeps the secret in the vault', async () => {
    await upsertEdgeDataSource({
      id: 'ds_edge_1',
      name: 'Reporting',
      type: 'PostgreSQL',
      host: 'db.example.com',
      port: 5432,
      database: 'reports',
      username: 'reader',
      status: 'disconnected',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    }, 'edge-secret');

    const listed = await listHydratedEdgeDataSources();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.password).toBe('edge-secret');
    expect(await getSecret('data_source', 'ds_edge_1', 'password')).toBe('edge-secret');

    const description = await sequelize.getQueryInterface().describeTable('base_data_sources');
    expect(description.password).toBeUndefined();
  });

  it('keeps the current secret when passwordUpdate is omitted', async () => {
    await upsertEdgeDataSource({
      id: 'ds_edge_1',
      name: 'Reporting',
      type: 'PostgreSQL',
      host: 'db.example.com',
      port: 5432,
      status: 'disconnected',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '',
    }, 'edge-secret');

    await upsertEdgeDataSource({
      id: 'ds_edge_1',
      name: 'Reporting West',
      type: 'PostgreSQL',
      host: 'db.example.com',
      port: 5432,
      status: 'connected',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
    });

    const listed = await listHydratedEdgeDataSources();
    expect(listed[0]?.name).toBe('Reporting West');
    expect(listed[0]?.password).toBe('edge-secret');
  });

  it('deletes vault secrets with the owner row', async () => {
    await upsertEdgeDataSource({
      id: 'ds_edge_1',
      name: 'Reporting',
      type: 'PostgreSQL',
      host: 'localhost',
      port: 5432,
      status: 'disconnected',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '',
    }, 'edge-secret');

    await deleteEdgeDataSource('ds_edge_1');
    expect(await listHydratedEdgeDataSources()).toHaveLength(0);
    expect(await getSecret('data_source', 'ds_edge_1', 'password')).toBeNull();
  });
});
