import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  HTTP_SECRET_PURPOSE,
  HTTP_WORKSHOP_VAULT_OWNER_TYPE,
} from '../httpConnectionVault';

const { testDir } = vi.hoisted(() => {
  const nodePath = require('node:path') as typeof import('node:path');
  const nodeOs = require('node:os') as typeof import('node:os');
  const dir = nodePath.join(nodeOs.tmpdir(), `appendo-http-workshop-collections-test-${process.pid}`);
  return { testDir: dir };
});

vi.mock('../../../../core/runtime/runtimePaths', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../core/runtime/runtimePaths')>();
  return {
    ...actual,
    runtimeDirs: {
      ...actual.runtimeDirs,
      httpConnections: testDir,
      httpConnectionsLocks: path.join(testDir, 'locks'),
      workspaceTemp: path.join(testDir, 'temp'),
    },
    HTTP_WORKSHOP_COLLECTIONS_INDEX_PATH: path.join(testDir, 'collections.json'),
  };
});

import {
  createCollection,
  createFolder,
  createRequest,
  deleteCollection,
  deleteFolder,
  duplicateCollection,
  duplicateFolder,
  duplicateRequest,
  listCollections,
  listFolders,
  listRequests,
  resolveEffectiveAuth,
  updateCollection,
} from '../collectionsStore';

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
  fs.rmSync(testDir, { recursive: true, force: true });
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

describe('collectionsStore', () => {
  it('creates a collection without leaking its secret', async () => {
    const created = await createCollection({
      name: 'Auth API',
      createdByUserId: 1,
      auth: { kind: 'bearer', secretPlaintext: 'token-123' },
    });
    expect(created.auth.hasSecret).toBe(true);
    expect((created.auth as unknown as { secret?: unknown }).secret).toBeUndefined();
    expect(listCollections()).toHaveLength(1);
    expect(await getSecret(HTTP_WORKSHOP_VAULT_OWNER_TYPE, created.id, HTTP_SECRET_PURPOSE)).toBe('token-123');
  });

  it('keeps the secret on rename and rotates only when a new one is supplied', async () => {
    const created = await createCollection({
      name: 'Payments',
      createdByUserId: 1,
      auth: { kind: 'apiKey', apiKeyHeaderName: 'X-Api-Key', secretPlaintext: 'key-1' },
    });
    await updateCollection(created.id, { name: 'Payments API' });
    const afterRename = listCollections().find((entry) => entry.id === created.id);
    expect(afterRename?.name).toBe('Payments API');
    expect(afterRename?.auth.hasSecret).toBe(true);
    expect(await getSecret(HTTP_WORKSHOP_VAULT_OWNER_TYPE, created.id, HTTP_SECRET_PURPOSE)).toBe('key-1');

    await updateCollection(created.id, {
      auth: { kind: 'apiKey', apiKeyHeaderName: 'X-Api-Key', secretPlaintext: 'key-2' },
    });
    expect(await getSecret(HTTP_WORKSHOP_VAULT_OWNER_TYPE, created.id, HTTP_SECRET_PURPOSE)).toBe('key-2');
  });

  it('cascades delete from collection to its folders and requests', async () => {
    const collection = await createCollection({ name: 'Users', createdByUserId: 1 });
    const folder = await createFolder({ collectionId: collection.id, name: 'Auth' });
    await createRequest({ collectionId: collection.id, folderId: folder.id, name: 'Login', method: 'POST', url: 'https://x/login' });
    await createRequest({ collectionId: collection.id, folderId: null, name: 'List', method: 'GET', url: 'https://x/users' });

    expect(listFolders(collection.id)).toHaveLength(1);
    expect(listRequests(collection.id)).toHaveLength(2);

    expect(await deleteCollection(collection.id)).toBe(true);
    expect(listFolders(collection.id)).toHaveLength(0);
    expect(listRequests(collection.id)).toHaveLength(0);
  });

  it('cascades delete from a folder to nested folders and their requests', async () => {
    const collection = await createCollection({ name: 'API', createdByUserId: 1 });
    const parent = await createFolder({ collectionId: collection.id, name: 'Parent' });
    const child = await createFolder({ collectionId: collection.id, parentFolderId: parent.id, name: 'Child' });
    await createRequest({ collectionId: collection.id, folderId: child.id, name: 'Nested', method: 'GET', url: 'https://x/nested' });

    expect(await deleteFolder(parent.id)).toBe(true);
    expect(listFolders(collection.id)).toHaveLength(0);
    expect(listRequests(collection.id)).toHaveLength(0);
  });

  it('resolves effective auth by walking request -> folder -> collection', async () => {
    const collection = await createCollection({
      name: 'Inherited',
      createdByUserId: 1,
      auth: { kind: 'bearer', secretPlaintext: 'collection-token' },
    });
    const folder = await createFolder({ collectionId: collection.id, name: 'Folder' });
    const inheritingRequest = await createRequest({
      collectionId: collection.id,
      folderId: folder.id,
      name: 'Inherits',
      method: 'GET',
      url: 'https://x/a',
    });
    const overridingRequest = await createRequest({
      collectionId: collection.id,
      folderId: folder.id,
      name: 'Overrides',
      method: 'GET',
      url: 'https://x/b',
      auth: { kind: 'none' },
    });

    const inherited = resolveEffectiveAuth(inheritingRequest.id);
    expect(inherited.kind).toBe('bearer');
    expect(inherited.vaultOwnerId).toBe(collection.id);
    expect(inherited.hasSecret).toBe(true);
    expect(resolveEffectiveAuth(overridingRequest.id).kind).toBe('none');
  });

  it('duplicates a collection with its folders and requests', async () => {
    const collection = await createCollection({ name: 'Payments', createdByUserId: 1 });
    const folder = await createFolder({ collectionId: collection.id, name: 'Auth' });
    await createRequest({ collectionId: collection.id, folderId: folder.id, name: 'Login', method: 'POST', url: 'https://x/login' });
    await createRequest({ collectionId: collection.id, folderId: null, name: 'List', method: 'GET', url: 'https://x/pay' });

    const copy = await duplicateCollection(collection.id);
    expect(copy?.name).toBe('Payments copy');
    expect(listFolders(copy!.id)).toHaveLength(1);
    expect(listRequests(copy!.id)).toHaveLength(2);
    expect(listCollections()).toHaveLength(2);
  });

  it('duplicates a folder and its nested requests', async () => {
    const collection = await createCollection({ name: 'API', createdByUserId: 1 });
    const folder = await createFolder({ collectionId: collection.id, name: 'Users' });
    await createRequest({ collectionId: collection.id, folderId: folder.id, name: 'Get', method: 'GET', url: 'https://x/users' });
    const copy = await duplicateFolder(folder.id);
    expect(copy?.name).toBe('Users copy');
    expect(listFolders(collection.id)).toHaveLength(2);
    expect(listRequests(collection.id)).toHaveLength(2);
  });

  it('duplicates a request next to the original and copies the vault secret', async () => {
    const collection = await createCollection({ name: 'API', createdByUserId: 1 });
    const created = await createRequest({
      collectionId: collection.id,
      name: 'Get user',
      method: 'GET',
      url: 'https://x/user',
      auth: { kind: 'bearer', secretPlaintext: 'token-abc' },
    });
    const copy = await duplicateRequest(created.id);
    expect(copy?.name).toBe('Get user copy');
    expect(copy?.url).toBe('https://x/user');
    expect(copy?.auth.hasSecret).toBe(true);
    expect(listRequests(collection.id)).toHaveLength(2);
    expect(await getSecret(HTTP_WORKSHOP_VAULT_OWNER_TYPE, created.id, HTTP_SECRET_PURPOSE)).toBe('token-abc');
    expect(await getSecret(HTTP_WORKSHOP_VAULT_OWNER_TYPE, copy!.id, HTTP_SECRET_PURPOSE)).toBe('token-abc');
  });
});
