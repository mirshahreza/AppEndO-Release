import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { testSshHubDir, testIndexPath } = vi.hoisted(() => {
  const nodePath = require('node:path') as typeof import('node:path');
  const nodeOs = require('node:os') as typeof import('node:os');
  const dir = nodePath.join(nodeOs.tmpdir(), `appendo-ssh-hub-test-${process.pid}`);
  return {
    testSshHubDir: dir,
    testIndexPath: nodePath.join(dir, 'index.json'),
  };
});

vi.mock('../../../../core/runtime/runtimePaths', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../core/runtime/runtimePaths')>();
  return {
    ...actual,
    runtimeDirs: {
      ...actual.runtimeDirs,
      sshHub: testSshHubDir,
      sshHubLocks: path.join(testSshHubDir, 'locks'),
      workspaceTemp: path.join(testSshHubDir, 'temp'),
    },
    SSH_HUB_INDEX_PATH: testIndexPath,
  };
});

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
  SSH_HUB_PASSWORD_PURPOSE,
  SSH_HUB_VAULT_OWNER_TYPE,
} from '../sshHubVault';
import {
  createSshHubConnection,
  deleteSshHubConnection,
  getSshHubConnectionSecrets,
  listSshHubConnections,
} from '../sshHubStore';

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

describe('sshHubStore', () => {
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
    fs.rmSync(testSshHubDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    fs.rmSync(testSshHubDir, { recursive: true, force: true });
    configureCredentialVaultSequelizeForTests(null);
    resetCredentialVaultModelCacheForTests();
    await sequelize.close();
    restoreEnv();
  });

  it('stores credentials in the vault and never returns plaintext', async () => {
    const created = await createSshHubConnection({
      name: 'Edge DB',
      host: '10.0.0.12',
      port: 22,
      username: 'deploy',
      authMethod: 'password',
      password: 'plain-password-value',
      initialPath: '/var/www',
      tags: ['prod'],
    }, 'admin@example.com');

    expect(created.hasPassword).toBe(true);
    expect(created.initialPath).toBe('/var/www');
    expect(JSON.stringify(created)).not.toContain('plain-password-value');

    const listed = listSshHubConnections();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.hasPassword).toBe(true);
    expect(JSON.stringify(listed)).not.toContain('plain-password-value');

    const onDisk = fs.readFileSync(testIndexPath, 'utf8');
    expect(onDisk).not.toContain('plain-password-value');
    expect(onDisk).not.toContain('"ciphertext"');
    expect(onDisk).toContain('"hasPassword": true');

    const secrets = await getSshHubConnectionSecrets(created.id);
    expect(secrets?.secrets.password).toBe('plain-password-value');
    expect(await getSecret(SSH_HUB_VAULT_OWNER_TYPE, created.id, SSH_HUB_PASSWORD_PURPOSE)).toBe('plain-password-value');
    expect(await deleteSshHubConnection(created.key)).toBe(true);
    expect(listSshHubConnections()).toHaveLength(0);
    expect(await getSecret(SSH_HUB_VAULT_OWNER_TYPE, created.id, SSH_HUB_PASSWORD_PURPOSE)).toBeNull();
    expect(path.basename(testIndexPath)).toBe('index.json');
  });

  it('fails to read secrets when the vault master key changes', async () => {
    const created = await createSshHubConnection({
      name: 'Edge DB',
      host: '10.0.0.12',
      port: 22,
      username: 'deploy',
      authMethod: 'password',
      password: 'plain-password-value',
    }, 'admin@example.com');

    process.env[CREDENTIAL_MASTER_KEY_ENV] = crypto.randomBytes(32).toString('hex');
    resetCredentialMasterKeyCacheForTests();
    await expect(getSshHubConnectionSecrets(created.id)).rejects.toThrow(/decrypt stored credentials/);
  });

  it('throws when leftover cipher blobs remain on disk', () => {
    fs.mkdirSync(testSshHubDir, { recursive: true });
    fs.writeFileSync(testIndexPath, `${JSON.stringify({
      schema: 'appendo-ssh-hub-index',
      schemaVersion: '1.0.0',
      updatedAt: '2026-09-10T00:00:00.000Z',
      connections: [{
        id: 'legacy-1',
        key: 'legacy',
        name: 'Legacy',
        host: '10.0.0.1',
        port: 22,
        username: 'deploy',
        authMethod: 'password',
        passwordCipher: { iv: 'aa', authTag: 'bb', ciphertext: 'cc' },
        tags: [],
        note: '',
        createdAt: '2026-09-10T00:00:00.000Z',
        updatedAt: '2026-09-10T00:00:00.000Z',
        createdBy: 'admin',
        updatedBy: 'admin',
      }],
    }, null, 2)}\n`, 'utf8');

    expect(() => listSshHubConnections()).toThrow(/migrate-ssh-hub/);
  });
});
