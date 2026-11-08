import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runtimeDirs, RDP_HUB_INDEX_PATH } from '../../../../core/runtime/runtimePaths';
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
import { isRemoteHubLibraryInstalled } from '../../remote-hubs/requireRemoteHubLibrary';
import {
  RDP_HUB_PASSWORD_PURPOSE,
  RDP_HUB_VAULT_OWNER_TYPE,
} from '../rdpHubVault';
import {
  createRdpHubConnection,
  deleteRdpHubConnection,
  getRdpHubConnectionSecrets,
  listRdpHubConnections,
} from '../rdpHubStore';
import { createRdpHubSessionTicket, decryptGuacamoleLiteToken } from '../rdpHubToken';

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

function rmHubDir(): void {
  fs.rmSync(runtimeDirs.rdpHub, { recursive: true, force: true, maxRetries: 8, retryDelay: 25 });
}

describe('rdpHubStore', () => {
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
    rmHubDir();
  });

  afterEach(async () => {
    rmHubDir();
    configureCredentialVaultSequelizeForTests(null);
    resetCredentialVaultModelCacheForTests();
    await sequelize.close();
    restoreEnv();
  });

  it('stores credentials in the vault and never returns plaintext', async () => {
    const created = await createRdpHubConnection({
      name: 'Win Jump',
      host: '10.0.0.20',
      port: 3389,
      username: 'Administrator',
      domain: 'CORP',
      security: 'nla',
      ignoreCert: true,
      password: 'plain-password-value',
      tags: ['prod'],
    }, 'admin@example.com');

    expect(created.hasPassword).toBe(true);
    expect(created.security).toBe('nla');
    expect(JSON.stringify(created)).not.toContain('plain-password-value');

    const listed = listRdpHubConnections();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.hasPassword).toBe(true);
    expect(JSON.stringify(listed)).not.toContain('plain-password-value');

    const onDisk = fs.readFileSync(RDP_HUB_INDEX_PATH, 'utf8');
    expect(onDisk).not.toContain('plain-password-value');
    expect(onDisk).not.toContain('"ciphertext"');
    expect(onDisk).toContain('"hasPassword": true');

    const secrets = await getRdpHubConnectionSecrets(created.id);
    expect(secrets?.secrets.password).toBe('plain-password-value');
    expect(await getSecret(RDP_HUB_VAULT_OWNER_TYPE, created.id, RDP_HUB_PASSWORD_PURPOSE)).toBe('plain-password-value');
    expect(await deleteRdpHubConnection(created.key)).toBe(true);
    expect(listRdpHubConnections()).toHaveLength(0);
    expect(await getSecret(RDP_HUB_VAULT_OWNER_TYPE, created.id, RDP_HUB_PASSWORD_PURPOSE)).toBeNull();
    expect(path.basename(RDP_HUB_INDEX_PATH)).toBe('index.json');
  });

  it.skipIf(!isRemoteHubLibraryInstalled('guacamole-lite'))('issues a guacamole-lite ticket without embedding the password', async () => {
    const created = await createRdpHubConnection({
      name: 'Win Jump',
      host: '10.0.0.20',
      username: 'Administrator',
      password: 'plain-password-value',
    }, 'admin@example.com');

    const ticket = createRdpHubSessionTicket(created.id, 7, { width: 1600, height: 900 });
    expect(ticket).not.toBeNull();
    expect(ticket?.token).not.toContain('plain-password-value');

    const claims = decryptGuacamoleLiteToken(ticket!.token) as {
      connectionId?: string;
      userId?: number;
      connection?: { type?: string; settings?: { width?: number; height?: number; password?: string } };
    };
    expect(claims.connectionId).toBe(created.id);
    expect(claims.userId).toBe(7);
    expect(claims.connection?.type).toBe('rdp');
    expect(claims.connection?.settings?.width).toBe(1600);
    expect(claims.connection?.settings?.height).toBe(900);
    expect(claims.connection?.settings?.password).toBeUndefined();
    expect(JSON.stringify(claims)).not.toContain('plain-password-value');
  });

  it('throws when leftover cipher blobs remain on disk', () => {
    fs.mkdirSync(runtimeDirs.rdpHub, { recursive: true });
    fs.writeFileSync(RDP_HUB_INDEX_PATH, `${JSON.stringify({
      schema: 'appendo-rdp-hub-index',
      schemaVersion: '1.0.0',
      updatedAt: '2026-09-10T00:00:00.000Z',
      connections: [{
        id: 'legacy-1',
        key: 'legacy',
        name: 'Legacy',
        host: '10.0.0.1',
        port: 3389,
        username: 'admin',
        domain: '',
        security: 'nla',
        ignoreCert: true,
        passwordCipher: { iv: 'aa', authTag: 'bb', ciphertext: 'cc' },
        tags: [],
        note: '',
        createdAt: '2026-09-10T00:00:00.000Z',
        updatedAt: '2026-09-10T00:00:00.000Z',
        createdBy: 'admin',
        updatedBy: 'admin',
      }],
    }, null, 2)}\n`, 'utf8');

    expect(() => listRdpHubConnections()).toThrow(/migrate-rdp-hub/);
  });
});
