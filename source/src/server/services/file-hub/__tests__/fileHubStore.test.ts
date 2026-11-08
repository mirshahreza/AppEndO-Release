import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FILE_HUB_INDEX_PATH, runtimeDirs } from '../../../../core/runtime/runtimePaths';
import {
  CREDENTIAL_KEY_VERSION_ENV,
  CREDENTIAL_MASTER_KEY_ENV,
  CREDENTIAL_PREVIOUS_KEY_ENV,
  resetCredentialMasterKeyCacheForTests,
} from '../../../domain/security/credentialVault/credentialCrypto';
import {
  configureCredentialVaultSequelizeForTests,
  getSecret,
} from '../../../domain/security/credentialVault/credentialVault';
import {
  ensureCredentialVaultTable,
  resetCredentialVaultModelCacheForTests,
} from '../../../domain/security/credentialVault/credentialVaultSequelizeModel';
import {
  FILE_HUB_PASSWORD_PURPOSE,
  FILE_HUB_VAULT_OWNER_TYPE,
} from '../fileHubVault';
import {
  createFileHubConnection,
  deleteFileHubConnection,
  getFileHubConnectionSecrets,
  listFileHubConnections,
} from '../fileHubStore';

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

describe('fileHubStore', () => {
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
    fs.rmSync(runtimeDirs.fileHub, { recursive: true, force: true });
  });

  afterEach(async () => {
    fs.rmSync(runtimeDirs.fileHub, { recursive: true, force: true });
    configureCredentialVaultSequelizeForTests(null);
    resetCredentialVaultModelCacheForTests();
    await sequelize.close();
    restoreEnv();
  });

  it('stores credentials in the vault and never returns plaintext', async () => {
    const created = await createFileHubConnection({
      name: 'Edge Files',
      protocol: 'sftp',
      host: '10.0.0.12',
      port: 22,
      username: 'deploy',
      authMethod: 'password',
      password: 'plain-password-value',
      tags: ['prod'],
    }, 'admin@example.com');

    expect(created.hasPassword).toBe(true);
    expect(created.protocol).toBe('sftp');
    expect(JSON.stringify(created)).not.toContain('plain-password-value');

    const listed = listFileHubConnections();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.hasPassword).toBe(true);
    expect(JSON.stringify(listed)).not.toContain('plain-password-value');

    const onDisk = fs.readFileSync(FILE_HUB_INDEX_PATH, 'utf8');
    expect(onDisk).not.toContain('plain-password-value');
    expect(onDisk).not.toContain('"ciphertext"');
    expect(onDisk).toContain('"hasPassword": true');

    const secrets = await getFileHubConnectionSecrets(created.id);
    expect(secrets?.secrets.password).toBe('plain-password-value');
    expect(await getSecret(FILE_HUB_VAULT_OWNER_TYPE, created.id, FILE_HUB_PASSWORD_PURPOSE)).toBe('plain-password-value');
    expect(await deleteFileHubConnection(created.key)).toBe(true);
    expect(listFileHubConnections()).toHaveLength(0);
    expect(await getSecret(FILE_HUB_VAULT_OWNER_TYPE, created.id, FILE_HUB_PASSWORD_PURPOSE)).toBeNull();
    expect(path.basename(FILE_HUB_INDEX_PATH)).toBe('index.json');
  });

  it('creates an SFTP password connection from the catalog form payload', async () => {
    const created = await createFileHubConnection({
      name: 'eeeeeeee',
      protocol: 'sftp',
      host: '91.98.24.146',
      port: 22,
      username: 'root',
      authMethod: 'password',
      password: 'dummy-password',
      initialPath: '/',
      tags: [],
      note: '',
    }, 'admin@example.com');

    expect(created.key).toBe('eeeeeeee');
    expect(created.host).toBe('91.98.24.146');
    expect(created.hasPassword).toBe(true);
    expect(listFileHubConnections()).toHaveLength(1);
  });

  it('requires a password for FTP connections', async () => {
    await expect(createFileHubConnection({
      name: 'Public FTP',
      protocol: 'ftp',
      host: 'ftp.example.com',
      username: 'anonymous',
      authMethod: 'privateKey',
    }, 'admin@example.com')).rejects.toThrow(/Password is required/i);
  });

  it('allocates an internal key without requiring the caller to supply one', async () => {
    const first = await createFileHubConnection({
      name: 'Edge Files',
      protocol: 'sftp',
      host: '10.0.0.12',
      username: 'deploy',
      authMethod: 'password',
      password: 'secret',
    }, 'admin@example.com');
    const second = await createFileHubConnection({
      name: 'Edge Files',
      protocol: 'sftp',
      host: '10.0.0.13',
      username: 'deploy',
      authMethod: 'password',
      password: 'secret',
    }, 'admin@example.com');
    const persian = await createFileHubConnection({
      name: 'سرور تولید',
      protocol: 'sftp',
      host: '10.0.0.14',
      username: 'deploy',
      authMethod: 'password',
      password: 'secret',
    }, 'admin@example.com');

    expect(first.key).toBe('edge-files');
    expect(second.key).toBe('edge-files-2');
    expect(persian.key).toMatch(/^c-[a-f0-9]{12}$/);
  });
});
