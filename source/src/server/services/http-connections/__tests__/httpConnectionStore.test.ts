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
  HTTP_CONNECTION_VAULT_OWNER_TYPE,
  HTTP_SECRET_PURPOSE,
} from '../httpConnectionVault';

const { testDir, testIndexPath } = vi.hoisted(() => {
  const nodePath = require('node:path') as typeof import('node:path');
  const nodeOs = require('node:os') as typeof import('node:os');
  const dir = nodePath.join(nodeOs.tmpdir(), `appendo-http-connections-test-${process.pid}`);
  return {
    testDir: dir,
    testIndexPath: nodePath.join(dir, 'index.json'),
  };
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
    HTTP_CONNECTIONS_INDEX_PATH: testIndexPath,
  };
});

import {
  createHttpConnection,
  deleteHttpConnection,
  findHttpConnectionRecordByName,
  getHttpConnectionRecord,
  getHttpConnectionSummary,
  listHttpConnections,
  updateHttpConnection,
} from '../httpConnectionStore';

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

describe('httpConnectionStore', () => {
  it('creates a connection and lists it without leaking the secret', async () => {
    const created = await createHttpConnection({
      name: 'GitHub',
      baseUrl: 'https://api.github.com',
      authKind: 'bearer',
      secretPlaintext: 'super-secret-token',
      createdByUserId: 1,
    });

    expect(created.hasSecret).toBe(true);
    expect((created as unknown as { secret?: unknown }).secret).toBeUndefined();

    const items = listHttpConnections();
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('GitHub');
    expect((items[0] as unknown as { secret?: unknown }).secret).toBeUndefined();
    expect(items[0].openApiSpec).toBeUndefined();
  });

  it('lists connections without the parsed OpenAPI spec payload', async () => {
    const spec = {
      title: 'Huge spec',
      operations: [{ operationId: 'listThings', method: 'GET' as const, path: '/things' }],
    };
    const created = await createHttpConnection({
      name: 'Catalog',
      baseUrl: 'https://api.catalog.example',
      authKind: 'none',
      openApiSpec: spec,
      createdByUserId: 1,
    });

    expect(created.openApiSpec).toEqual(spec);
    expect(created.hasOpenApiSpec).toBe(true);

    const listed = listHttpConnections();
    expect(listed[0].openApiSpec).toBeUndefined();
    expect(listed[0].hasOpenApiSpec).toBe(true);

    const detail = getHttpConnectionSummary(created.id);
    expect(detail?.openApiSpec).toEqual(spec);
  });

  it('stores the secret in the vault, not on the JSON record', async () => {
    const created = await createHttpConnection({
      name: 'Stripe',
      baseUrl: 'https://api.stripe.com',
      authKind: 'apiKey',
      apiKeyHeaderName: 'X-Api-Key',
      secretPlaintext: 'sk_test_123',
      createdByUserId: 1,
    });

    const record = findHttpConnectionRecordByName('Stripe');
    expect(record?.hasSecret).toBe(true);
    expect((record as unknown as { secret?: unknown }).secret).toBeUndefined();
    expect(await getSecret(HTTP_CONNECTION_VAULT_OWNER_TYPE, created.id, HTTP_SECRET_PURPOSE)).toBe('sk_test_123');
  });

  it('updates fields and rotates the secret only when a new one is supplied', async () => {
    const created = await createHttpConnection({
      name: 'Weather',
      baseUrl: 'https://api.weather.example',
      authKind: 'apiKey',
      apiKeyHeaderName: 'X-Key',
      secretPlaintext: 'first-key',
      createdByUserId: 1,
    });

    await updateHttpConnection(created.id, { name: 'Weather API' });
    const recordAfterRename = getHttpConnectionRecord(created.id);
    expect(recordAfterRename?.name).toBe('Weather API');
    expect(await getSecret(HTTP_CONNECTION_VAULT_OWNER_TYPE, created.id, HTTP_SECRET_PURPOSE)).toBe('first-key');

    await updateHttpConnection(created.id, { secretPlaintext: 'second-key' });
    expect(await getSecret(HTTP_CONNECTION_VAULT_OWNER_TYPE, created.id, HTTP_SECRET_PURPOSE)).toBe('second-key');
  });

  it('deletes a connection and reports whether anything was removed', async () => {
    const created = await createHttpConnection({
      name: 'Temp',
      baseUrl: 'https://example.com',
      authKind: 'none',
      createdByUserId: 1,
    });

    expect(await deleteHttpConnection(created.id)).toBe(true);
    expect(await deleteHttpConnection(created.id)).toBe(false);
    expect(listHttpConnections()).toHaveLength(0);
  });
});
