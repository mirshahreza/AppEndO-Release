import crypto from 'node:crypto';
import { Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CREDENTIAL_KEY_VERSION_ENV,
  CREDENTIAL_MASTER_KEY_ENV,
  CREDENTIAL_PREVIOUS_KEY_ENV,
  resetCredentialMasterKeyCacheForTests,
} from '../credentialCrypto';
import {
  configureCredentialVaultSequelizeForTests,
  deleteSecret,
  deleteSecretsForOwner,
  getSecret,
  hasSecret,
  rotateDbVaultSecrets,
  setSecret,
} from '../credentialVault';
import {
  ensureCredentialVaultTable,
  getCredentialVaultModel,
  resetCredentialVaultModelCacheForTests,
} from '../credentialVaultSequelizeModel';

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
  sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
  configureCredentialVaultSequelizeForTests(sequelize);
  await ensureCredentialVaultTable(sequelize);
});

afterEach(async () => {
  configureCredentialVaultSequelizeForTests(null);
  resetCredentialVaultModelCacheForTests();
  await sequelize.close();
  restoreEnv();
});

describe('credentialVault', () => {
  it('upserts and decrypts a secret', async () => {
    await setSecret('infra_monitoring', 'engine-1', 'api_token', 'zabbix-token', 9);
    expect(await getSecret('infra_monitoring', 'engine-1', 'api_token')).toBe('zabbix-token');
    expect(await hasSecret('infra_monitoring', 'engine-1', 'api_token')).toBe(true);

    await setSecret('infra_monitoring', 'engine-1', 'api_token', 'rotated-token', 9);
    expect(await getSecret('infra_monitoring', 'engine-1', 'api_token')).toBe('rotated-token');
    const count = await getCredentialVaultModel(sequelize).count();
    expect(count).toBe(1);
  });

  it('returns null when the secret is missing', async () => {
    expect(await getSecret('infra_ops_engine', 'missing', 'api_token')).toBeNull();
    expect(await hasSecret('infra_ops_engine', 'missing', 'api_token')).toBe(false);
  });

  it('deletes one purpose and all secrets for an owner', async () => {
    await setSecret('ssh_hub', 'conn-1', 'password', 'pw-1');
    await setSecret('ssh_hub', 'conn-1', 'ssh_private_key', 'key-1');
    await setSecret('ssh_hub', 'conn-2', 'password', 'pw-2');

    await deleteSecret('ssh_hub', 'conn-1', 'password');
    expect(await getSecret('ssh_hub', 'conn-1', 'password')).toBeNull();
    expect(await getSecret('ssh_hub', 'conn-1', 'ssh_private_key')).toBe('key-1');

    const removed = await deleteSecretsForOwner('ssh_hub', 'conn-1');
    expect(removed).toBe(1);
    expect(await getSecret('ssh_hub', 'conn-1', 'ssh_private_key')).toBeNull();
    expect(await getSecret('ssh_hub', 'conn-2', 'password')).toBe('pw-2');
  });

  it('rejects invalid ownerType and empty plaintext', async () => {
    await expect(setSecret('HTTP Connection', 'id', 'password', 'x')).rejects.toThrow(/Latin slug/);
    await expect(setSecret('http_connection', 'id', 'password', '')).rejects.toThrow(/non-empty/);
  });

  it('rotates stale rows with the previous master key', async () => {
    const previous = crypto.randomBytes(32).toString('hex');
    const next = crypto.randomBytes(32).toString('hex');
    process.env[CREDENTIAL_MASTER_KEY_ENV] = previous;
    resetCredentialMasterKeyCacheForTests();
    await setSecret('data_source', 'ds_edge', 'password', 'edge-db-secret');

    process.env[CREDENTIAL_MASTER_KEY_ENV] = next;
    process.env[CREDENTIAL_PREVIOUS_KEY_ENV] = previous;
    process.env[CREDENTIAL_KEY_VERSION_ENV] = '2';
    resetCredentialMasterKeyCacheForTests();

    const result = await rotateDbVaultSecrets();
    expect(result).toEqual({ migrated: 1, failed: [] });
    expect(await getSecret('data_source', 'ds_edge', 'password')).toBe('edge-db-secret');

    const row = await getCredentialVaultModel(sequelize).findOne({
      where: { ownerType: 'data_source', ownerId: 'ds_edge', purpose: 'password' },
    });
    expect(row?.keyVersion).toBe(2);
    expect(row?.rotatedAt).toBeInstanceOf(Date);
  });

  it('fails rotate when previous-generation rows exist without PREVIOUS', async () => {
    const previous = crypto.randomBytes(32).toString('hex');
    process.env[CREDENTIAL_MASTER_KEY_ENV] = previous;
    resetCredentialMasterKeyCacheForTests();
    await setSecret('platform_smtp', 'app', 'password', 'smtp-secret');

    process.env[CREDENTIAL_MASTER_KEY_ENV] = crypto.randomBytes(32).toString('hex');
    process.env[CREDENTIAL_KEY_VERSION_ENV] = '2';
    delete process.env[CREDENTIAL_PREVIOUS_KEY_ENV];
    resetCredentialMasterKeyCacheForTests();

    await expect(rotateDbVaultSecrets()).rejects.toThrow(/PREVIOUS is required/);
  });
});
