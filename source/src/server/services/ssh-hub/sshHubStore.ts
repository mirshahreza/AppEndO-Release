import crypto from 'node:crypto';
import fs from 'node:fs';
import {
  acquireRuntimeLock,
  atomicWriteText,
  ensureRuntimeDirs,
  releaseRuntimeLock,
} from '../../../core/runtime/RuntimeFileStore';
import { runtimeDirs, SSH_HUB_INDEX_PATH } from '../../../core/runtime/runtimePaths';
import type {
  SshHubAuthMethod,
  SshHubConnectionPublic,
  SshHubConnectionRecord,
  SshHubConnectionWritePayload,
  SshHubIndexFile,
} from '../../../shared/api/contracts/ssh-hub/types';
import {
  parseSshHubAuthMethod,
  parseSshHubPort,
  sanitizeSshHubDisplayName,
  sanitizeSshHubNote,
  sanitizeSshHubTags,
  sanitizeSshInitialPath,
  SSH_HUB_DEFAULT_PORT,
  stripHostBrackets,
  validateSshHubDisplayName,
  validateSshHubHost,
  validateSshHubUsername,
} from '../../../shared/api/contracts/ssh-hub/validation';
import { allocateInternalLatinSlug } from '../../../shared/lib/latinSlug';
import {
  LEGACY_SSH_HUB_SECRET_BLOB_ERROR,
  SSH_HUB_PASSPHRASE_PURPOSE,
  SSH_HUB_PASSWORD_PURPOSE,
  SSH_HUB_PRIVATE_KEY_PURPOSE,
  deleteSshHubVaultSecret,
  deleteSshHubVaultSecrets,
  getSshHubVaultSecret,
  isLegacySshHubSecretBlob,
  setSshHubVaultSecret,
} from './sshHubVault';

const LOCK_NAME = 'ssh-hub';

type SecretFlags = {
  hasPassword: boolean;
  hasPrivateKey: boolean;
  hasPassphrase: boolean;
};

type SshHubRecordOnDisk = SshHubConnectionRecord & {
  passwordCipher?: unknown;
  privateKeyCipher?: unknown;
  passphraseCipher?: unknown;
};

export class SshHubStoreError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'SshHubStoreError';
  }
}

const emptyIndex = (): SshHubIndexFile => ({
  schema: 'appendo-ssh-hub-index',
  schemaVersion: '1.0.0',
  updatedAt: new Date().toISOString(),
  connections: [],
});

function ensureStoreDirs(): void {
  ensureRuntimeDirs([runtimeDirs.sshHub, runtimeDirs.sshHubLocks, runtimeDirs.workspaceTemp]);
}

function withStoreLock<T>(fn: () => T): T {
  ensureStoreDirs();
  if (!acquireRuntimeLock(runtimeDirs.sshHubLocks, LOCK_NAME)) {
    throw new SshHubStoreError('SSH Hub catalog is busy. Retry in a moment.', 409);
  }
  try {
    return fn();
  } finally {
    releaseRuntimeLock(runtimeDirs.sshHubLocks, LOCK_NAME);
  }
}

async function withStoreLockAsync<T>(fn: () => Promise<T>): Promise<T> {
  ensureStoreDirs();
  if (!acquireRuntimeLock(runtimeDirs.sshHubLocks, LOCK_NAME)) {
    throw new SshHubStoreError('SSH Hub catalog is busy. Retry in a moment.', 409);
  }
  try {
    return await fn();
  } finally {
    releaseRuntimeLock(runtimeDirs.sshHubLocks, LOCK_NAME);
  }
}

const assertNoLegacySecretBlob = (value: unknown): void => {
  if (isLegacySshHubSecretBlob(value)) {
    throw new Error(LEGACY_SSH_HUB_SECRET_BLOB_ERROR);
  }
};

function normalizeRecord(entry: SshHubRecordOnDisk): SshHubConnectionRecord {
  assertNoLegacySecretBlob(entry.passwordCipher);
  assertNoLegacySecretBlob(entry.privateKeyCipher);
  assertNoLegacySecretBlob(entry.passphraseCipher);
  const {
    passwordCipher: _passwordCipher,
    privateKeyCipher: _privateKeyCipher,
    passphraseCipher: _passphraseCipher,
    ...rest
  } = entry;
  return {
    ...rest,
    hasPassword: Boolean(entry.hasPassword),
    hasPrivateKey: Boolean(entry.hasPrivateKey),
    hasPassphrase: Boolean(entry.hasPassphrase),
    initialPath: typeof entry.initialPath === 'string' ? entry.initialPath : '',
  };
}

function readIndexUnlocked(): SshHubIndexFile {
  ensureStoreDirs();
  if (!fs.existsSync(SSH_HUB_INDEX_PATH)) {
    return emptyIndex();
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(SSH_HUB_INDEX_PATH, 'utf8')) as Partial<SshHubIndexFile>;
    if (!parsed || parsed.schema !== 'appendo-ssh-hub-index' || !Array.isArray(parsed.connections)) {
      return emptyIndex();
    }
    return {
      schema: 'appendo-ssh-hub-index',
      schemaVersion: '1.0.0',
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
      connections: parsed.connections
        .filter((item): item is SshHubConnectionRecord => Boolean(item?.id && item.key))
        .map((item) => normalizeRecord(item)),
    };
  } catch (error) {
    if (error instanceof Error && error.message === LEGACY_SSH_HUB_SECRET_BLOB_ERROR) {
      throw error;
    }
    return emptyIndex();
  }
}

function writeIndexUnlocked(index: SshHubIndexFile): void {
  const next: SshHubIndexFile = {
    ...index,
    updatedAt: new Date().toISOString(),
  };
  atomicWriteText(SSH_HUB_INDEX_PATH, `${JSON.stringify(next, null, 2)}\n`, runtimeDirs.workspaceTemp);
}

export function toSshHubConnectionPublic(record: SshHubConnectionRecord): SshHubConnectionPublic {
  return {
    id: record.id,
    key: record.key,
    name: record.name,
    host: record.host,
    port: record.port,
    username: record.username,
    authMethod: record.authMethod,
    hasPassword: Boolean(record.hasPassword),
    hasPrivateKey: Boolean(record.hasPrivateKey),
    hasPassphrase: Boolean(record.hasPassphrase),
    initialPath: typeof record.initialPath === 'string' ? record.initialPath : '',
    tags: [...record.tags],
    note: record.note,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    createdBy: record.createdBy,
    updatedBy: record.updatedBy,
  };
}

export type SshHubResolvedSecrets = {
  password?: string;
  privateKey?: string;
  passphrase?: string;
};

export function listSshHubConnections(): SshHubConnectionPublic[] {
  return withStoreLock(() => readIndexUnlocked().connections.map(toSshHubConnectionPublic));
}

export function getSshHubConnection(idOrKey: string): SshHubConnectionPublic | null {
  const record = withStoreLock(() => findRecord(readIndexUnlocked(), idOrKey));
  return record ? toSshHubConnectionPublic(record) : null;
}

export async function getSshHubConnectionSecrets(idOrKey: string): Promise<{
  record: SshHubConnectionRecord;
  secrets: SshHubResolvedSecrets;
} | null> {
  const record = withStoreLock(() => findRecord(readIndexUnlocked(), idOrKey));
  if (!record) {
    return null;
  }
  const secrets: SshHubResolvedSecrets = {};
  try {
    if (record.hasPassword) {
      secrets.password = await getSshHubVaultSecret(record.id, SSH_HUB_PASSWORD_PURPOSE) ?? undefined;
    }
    if (record.hasPrivateKey) {
      secrets.privateKey = await getSshHubVaultSecret(record.id, SSH_HUB_PRIVATE_KEY_PURPOSE) ?? undefined;
    }
    if (record.hasPassphrase) {
      secrets.passphrase = await getSshHubVaultSecret(record.id, SSH_HUB_PASSPHRASE_PURPOSE) ?? undefined;
    }
  } catch (error) {
    if (error instanceof Error && error.message === LEGACY_SSH_HUB_SECRET_BLOB_ERROR) {
      throw error;
    }
    throw new SshHubStoreError('Could not decrypt stored credentials. Re-enter the secret and save.', 400);
  }
  return { record, secrets };
}

function computeSecretFlags(
  payload: SshHubConnectionWritePayload,
  previous: SecretFlags,
  authMethod: SshHubAuthMethod,
): SecretFlags {
  let hasPassword = previous.hasPassword;
  let hasPrivateKey = previous.hasPrivateKey;
  let hasPassphrase = previous.hasPassphrase;

  if (payload.clearPassword) {
    hasPassword = false;
  } else if (typeof payload.password === 'string' && payload.password.length > 0) {
    hasPassword = true;
  }

  if (payload.clearPrivateKey) {
    hasPrivateKey = false;
  } else if (typeof payload.privateKey === 'string' && payload.privateKey.trim()) {
    hasPrivateKey = true;
  }

  if (payload.clearPassphrase) {
    hasPassphrase = false;
  } else if (typeof payload.passphrase === 'string' && payload.passphrase.length > 0) {
    hasPassphrase = true;
  }

  if (authMethod === 'password') {
    hasPrivateKey = false;
    hasPassphrase = false;
  } else {
    hasPassword = false;
  }

  return { hasPassword, hasPrivateKey, hasPassphrase };
}

async function syncVaultSecrets(
  ownerId: string,
  payload: SshHubConnectionWritePayload,
  previous: SecretFlags,
  authMethod: SshHubAuthMethod,
): Promise<SecretFlags> {
  let hasPassword = previous.hasPassword;
  let hasPrivateKey = previous.hasPrivateKey;
  let hasPassphrase = previous.hasPassphrase;

  if (payload.clearPassword) {
    await deleteSshHubVaultSecret(ownerId, SSH_HUB_PASSWORD_PURPOSE);
    hasPassword = false;
  } else if (typeof payload.password === 'string' && payload.password.length > 0) {
    await setSshHubVaultSecret(ownerId, SSH_HUB_PASSWORD_PURPOSE, payload.password);
    hasPassword = true;
  }

  if (payload.clearPrivateKey) {
    await deleteSshHubVaultSecret(ownerId, SSH_HUB_PRIVATE_KEY_PURPOSE);
    hasPrivateKey = false;
  } else if (typeof payload.privateKey === 'string' && payload.privateKey.trim()) {
    await setSshHubVaultSecret(ownerId, SSH_HUB_PRIVATE_KEY_PURPOSE, payload.privateKey);
    hasPrivateKey = true;
  }

  if (payload.clearPassphrase) {
    await deleteSshHubVaultSecret(ownerId, SSH_HUB_PASSPHRASE_PURPOSE);
    hasPassphrase = false;
  } else if (typeof payload.passphrase === 'string' && payload.passphrase.length > 0) {
    await setSshHubVaultSecret(ownerId, SSH_HUB_PASSPHRASE_PURPOSE, payload.passphrase);
    hasPassphrase = true;
  }

  if (authMethod === 'password') {
    if (hasPrivateKey) {
      await deleteSshHubVaultSecret(ownerId, SSH_HUB_PRIVATE_KEY_PURPOSE);
      hasPrivateKey = false;
    }
    if (hasPassphrase) {
      await deleteSshHubVaultSecret(ownerId, SSH_HUB_PASSPHRASE_PURPOSE);
      hasPassphrase = false;
    }
  } else if (hasPassword) {
    await deleteSshHubVaultSecret(ownerId, SSH_HUB_PASSWORD_PURPOSE);
    hasPassword = false;
  }

  return { hasPassword, hasPrivateKey, hasPassphrase };
}

export async function createSshHubConnection(
  payload: SshHubConnectionWritePayload,
  actor: string,
): Promise<SshHubConnectionPublic> {
  const id = crypto.randomUUID();
  return withStoreLockAsync(async () => {
    const index = readIndexUnlocked();
    const now = new Date().toISOString();
    const current = {
      id,
      createdAt: now,
      createdBy: actor,
      updatedAt: now,
      updatedBy: actor,
    };
    const authMethod = parseSshHubAuthMethod(payload.authMethod ?? current.authMethod) ?? 'password';
    const record = buildRecord(payload, current, {
      requireSecret: true,
      flags: computeSecretFlags(payload, {
        hasPassword: false,
        hasPrivateKey: false,
        hasPassphrase: false,
      }, authMethod),
      takenKeys: index.connections.map((item) => item.key),
    });
    const flags = await syncVaultSecrets(id, payload, {
      hasPassword: false,
      hasPrivateKey: false,
      hasPassphrase: false,
    }, authMethod);
    const stored: SshHubConnectionRecord = {
      ...record,
      hasPassword: flags.hasPassword,
      hasPrivateKey: flags.hasPrivateKey,
      hasPassphrase: flags.hasPassphrase,
    };
    assertUniqueKey(index, stored.key);
    index.connections.push(stored);
    writeIndexUnlocked(index);
    return toSshHubConnectionPublic(stored);
  });
}

export async function updateSshHubConnection(
  idOrKey: string,
  payload: SshHubConnectionWritePayload,
  actor: string,
): Promise<SshHubConnectionPublic> {
  return withStoreLockAsync(async () => {
    const index = readIndexUnlocked();
    const current = findRecord(index, idOrKey);
    if (!current) {
      throw new SshHubStoreError('SSH connection was not found.', 404);
    }
    const authMethod = parseSshHubAuthMethod(payload.authMethod ?? current.authMethod) ?? 'password';
    const previousFlags = {
      hasPassword: current.hasPassword,
      hasPrivateKey: current.hasPrivateKey,
      hasPassphrase: current.hasPassphrase,
    };
    const next = buildRecord(payload, current, {
      requireSecret: false,
      flags: computeSecretFlags(payload, previousFlags, authMethod),
    });
    const flags = await syncVaultSecrets(current.id, payload, previousFlags, authMethod);
    next.hasPassword = flags.hasPassword;
    next.hasPrivateKey = flags.hasPrivateKey;
    next.hasPassphrase = flags.hasPassphrase;
    next.updatedAt = new Date().toISOString();
    next.updatedBy = actor;
    if (next.key !== current.key) {
      assertUniqueKey(index, next.key, current.id);
    }
    index.connections = index.connections.map((item) => (item.id === current.id ? next : item));
    writeIndexUnlocked(index);
    return toSshHubConnectionPublic(next);
  });
}

export async function deleteSshHubConnection(idOrKey: string): Promise<boolean> {
  const removedId = withStoreLock(() => {
    const index = readIndexUnlocked();
    const current = findRecord(index, idOrKey);
    if (!current) {
      return null;
    }
    index.connections = index.connections.filter((item) => item.id !== current.id);
    writeIndexUnlocked(index);
    return current.id;
  });
  if (!removedId) {
    return false;
  }
  await deleteSshHubVaultSecrets(removedId);
  return true;
}

function findRecord(index: SshHubIndexFile, idOrKey: string): SshHubConnectionRecord | null {
  const needle = idOrKey.trim();
  if (!needle) {
    return null;
  }
  return index.connections.find((item) => item.id === needle || item.key === needle) ?? null;
}

function assertUniqueKey(index: SshHubIndexFile, key: string, exceptId?: string): void {
  const collision = index.connections.find((item) => item.key === key && item.id !== exceptId);
  if (collision) {
    throw new SshHubStoreError(`An SSH connection with key "${key}" already exists.`, 409);
  }
}

function buildRecord(
  payload: SshHubConnectionWritePayload,
  current: Pick<SshHubConnectionRecord, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'> & Partial<SshHubConnectionRecord>,
  options: { requireSecret: boolean; takenKeys?: string[]; flags: SecretFlags },
): SshHubConnectionRecord {
  const name = sanitizeSshHubDisplayName(payload.name ?? current.name ?? '');
  const nameError = validateSshHubDisplayName(name);
  if (nameError) {
    throw new SshHubStoreError(nameError, 400);
  }

  const key = current.key || allocateInternalLatinSlug({
    seed: payload.key?.trim() || name,
    id: current.id,
    taken: options.takenKeys ?? [],
  });

  const host = stripHostBrackets(payload.host ?? current.host ?? '');
  const hostError = validateSshHubHost(host);
  if (hostError) {
    throw new SshHubStoreError(hostError, 400);
  }

  const username = (payload.username ?? current.username ?? '').trim();
  const usernameError = validateSshHubUsername(username);
  if (usernameError) {
    throw new SshHubStoreError(usernameError, 400);
  }

  const port = parseSshHubPort(payload.port ?? current.port ?? SSH_HUB_DEFAULT_PORT);
  if (port == null) {
    throw new SshHubStoreError('Port must be an integer between 1 and 65535.', 400);
  }

  const authMethod = parseSshHubAuthMethod(payload.authMethod ?? current.authMethod) ?? 'password';
  const flags: SecretFlags = {
    hasPassword: authMethod === 'password' ? options.flags.hasPassword : false,
    hasPrivateKey: authMethod === 'privateKey' ? options.flags.hasPrivateKey : false,
    hasPassphrase: authMethod === 'privateKey' ? options.flags.hasPassphrase : false,
  };

  if (authMethod === 'password' && !flags.hasPassword && options.requireSecret) {
    throw new SshHubStoreError('Password is required for password authentication.', 400);
  }
  if (authMethod === 'privateKey' && !flags.hasPrivateKey && options.requireSecret) {
    throw new SshHubStoreError('Private key is required for key authentication.', 400);
  }
  if (authMethod === 'password' && !flags.hasPassword) {
    throw new SshHubStoreError('This connection has no stored password. Enter a password to save.', 400);
  }
  if (authMethod === 'privateKey' && !flags.hasPrivateKey) {
    throw new SshHubStoreError('This connection has no stored private key. Paste a key to save.', 400);
  }

  return {
    id: current.id,
    key,
    name,
    host,
    port,
    username,
    authMethod,
    hasPassword: flags.hasPassword,
    hasPrivateKey: flags.hasPrivateKey,
    hasPassphrase: flags.hasPassphrase,
    initialPath: sanitizeSshInitialPath(payload.initialPath ?? current.initialPath ?? ''),
    tags: sanitizeSshHubTags(payload.tags ?? current.tags ?? []),
    note: sanitizeSshHubNote(payload.note ?? current.note ?? ''),
    createdAt: current.createdAt,
    createdBy: current.createdBy,
    updatedAt: current.updatedAt,
    updatedBy: current.updatedBy,
  };
}
