import crypto from 'node:crypto';
import fs from 'node:fs';
import {
  acquireRuntimeLock,
  atomicWriteText,
  ensureRuntimeDirs,
  releaseRuntimeLock,
} from '../../../core/runtime/RuntimeFileStore';
import { FILE_HUB_INDEX_PATH, runtimeDirs } from '../../../core/runtime/runtimePaths';
import type {
  FileHubAuthMethod,
  FileHubConnectionPublic,
  FileHubConnectionRecord,
  FileHubConnectionWritePayload,
  FileHubIndexFile,
} from '../../../shared/api/contracts/file-hub/types';
import {
  FILE_HUB_DEFAULT_PORTS,
  parseFileHubAuthMethod,
  parseFileHubPort,
  parseFileHubProtocol,
  protocolAllowsPrivateKey,
  resolveFileHubAuthMethod,
  sanitizeFileHubDisplayName,
  sanitizeFileHubNote,
  sanitizeFileHubTags,
  sanitizeInitialPath,
  stripHostBrackets,
  validateFileHubDisplayName,
  validateFileHubHost,
  validateFileHubUsername,
} from '../../../shared/api/contracts/file-hub/validation';
import { allocateInternalLatinSlug } from '../../../shared/lib/latinSlug';
import {
  FILE_HUB_PASSPHRASE_PURPOSE,
  FILE_HUB_PASSWORD_PURPOSE,
  FILE_HUB_PRIVATE_KEY_PURPOSE,
  LEGACY_FILE_HUB_SECRET_BLOB_ERROR,
  deleteFileHubVaultSecret,
  deleteFileHubVaultSecrets,
  getFileHubVaultSecret,
  isLegacyFileHubSecretBlob,
  setFileHubVaultSecret,
} from './fileHubVault';

const LOCK_NAME = 'file-hub';

type SecretFlags = {
  hasPassword: boolean;
  hasPrivateKey: boolean;
  hasPassphrase: boolean;
};

type FileHubRecordOnDisk = FileHubConnectionRecord & {
  passwordCipher?: unknown;
  privateKeyCipher?: unknown;
  passphraseCipher?: unknown;
};

export class FileHubStoreError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'FileHubStoreError';
  }
}

const emptyIndex = (): FileHubIndexFile => ({
  schema: 'appendo-file-hub-index',
  schemaVersion: '1.0.0',
  updatedAt: new Date().toISOString(),
  connections: [],
});

function ensureStoreDirs(): void {
  ensureRuntimeDirs([runtimeDirs.fileHub, runtimeDirs.fileHubLocks, runtimeDirs.workspaceTemp]);
}

function withStoreLock<T>(fn: () => T): T {
  ensureStoreDirs();
  if (!acquireRuntimeLock(runtimeDirs.fileHubLocks, LOCK_NAME)) {
    throw new FileHubStoreError('File Hub catalog is busy. Retry in a moment.', 409);
  }
  try {
    return fn();
  } finally {
    releaseRuntimeLock(runtimeDirs.fileHubLocks, LOCK_NAME);
  }
}

async function withStoreLockAsync<T>(fn: () => Promise<T>): Promise<T> {
  ensureStoreDirs();
  if (!acquireRuntimeLock(runtimeDirs.fileHubLocks, LOCK_NAME)) {
    throw new FileHubStoreError('File Hub catalog is busy. Retry in a moment.', 409);
  }
  try {
    return await fn();
  } finally {
    releaseRuntimeLock(runtimeDirs.fileHubLocks, LOCK_NAME);
  }
}

const assertNoLegacySecretBlob = (value: unknown): void => {
  if (isLegacyFileHubSecretBlob(value)) {
    throw new Error(LEGACY_FILE_HUB_SECRET_BLOB_ERROR);
  }
};

function normalizeRecord(entry: FileHubRecordOnDisk): FileHubConnectionRecord {
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
  };
}

function readIndexUnlocked(): FileHubIndexFile {
  ensureStoreDirs();
  if (!fs.existsSync(FILE_HUB_INDEX_PATH)) {
    return emptyIndex();
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE_HUB_INDEX_PATH, 'utf8')) as Partial<FileHubIndexFile>;
    if (!parsed || parsed.schema !== 'appendo-file-hub-index' || !Array.isArray(parsed.connections)) {
      return emptyIndex();
    }
    return {
      schema: 'appendo-file-hub-index',
      schemaVersion: '1.0.0',
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
      connections: parsed.connections
        .filter((item): item is FileHubConnectionRecord => Boolean(item?.id && item.key))
        .map((item) => normalizeRecord(item)),
    };
  } catch (error) {
    if (error instanceof Error && error.message === LEGACY_FILE_HUB_SECRET_BLOB_ERROR) {
      throw error;
    }
    return emptyIndex();
  }
}

function writeIndexUnlocked(index: FileHubIndexFile): void {
  const next: FileHubIndexFile = {
    ...index,
    updatedAt: new Date().toISOString(),
  };
  atomicWriteText(FILE_HUB_INDEX_PATH, `${JSON.stringify(next, null, 2)}\n`, runtimeDirs.workspaceTemp);
}

export function toFileHubConnectionPublic(record: FileHubConnectionRecord): FileHubConnectionPublic {
  return {
    id: record.id,
    key: record.key,
    name: record.name,
    protocol: record.protocol,
    host: record.host,
    port: record.port,
    username: record.username,
    authMethod: record.authMethod,
    hasPassword: Boolean(record.hasPassword),
    hasPrivateKey: Boolean(record.hasPrivateKey),
    hasPassphrase: Boolean(record.hasPassphrase),
    initialPath: record.initialPath,
    tags: [...record.tags],
    note: record.note,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    createdBy: record.createdBy,
    updatedBy: record.updatedBy,
  };
}

export type FileHubResolvedSecrets = {
  password?: string;
  privateKey?: string;
  passphrase?: string;
};

export function listFileHubConnections(): FileHubConnectionPublic[] {
  return withStoreLock(() => readIndexUnlocked().connections.map(toFileHubConnectionPublic));
}

export function getFileHubConnection(idOrKey: string): FileHubConnectionPublic | null {
  const record = withStoreLock(() => findRecord(readIndexUnlocked(), idOrKey));
  return record ? toFileHubConnectionPublic(record) : null;
}

export async function getFileHubConnectionSecrets(idOrKey: string): Promise<{
  record: FileHubConnectionRecord;
  secrets: FileHubResolvedSecrets;
} | null> {
  const record = withStoreLock(() => findRecord(readIndexUnlocked(), idOrKey));
  if (!record) {
    return null;
  }
  const secrets: FileHubResolvedSecrets = {};
  if (record.hasPassword) {
    secrets.password = await getFileHubVaultSecret(record.id, FILE_HUB_PASSWORD_PURPOSE) ?? undefined;
  }
  if (record.hasPrivateKey) {
    secrets.privateKey = await getFileHubVaultSecret(record.id, FILE_HUB_PRIVATE_KEY_PURPOSE) ?? undefined;
  }
  if (record.hasPassphrase) {
    secrets.passphrase = await getFileHubVaultSecret(record.id, FILE_HUB_PASSPHRASE_PURPOSE) ?? undefined;
  }
  return { record, secrets };
}

export async function createFileHubConnection(
  payload: FileHubConnectionWritePayload,
  actor: string,
): Promise<FileHubConnectionPublic> {
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
    const authMethod = resolveAuthMethod(payload, current);
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
    const stored: FileHubConnectionRecord = {
      ...record,
      hasPassword: flags.hasPassword,
      hasPrivateKey: flags.hasPrivateKey,
      hasPassphrase: flags.hasPassphrase,
    };
    assertUniqueKey(index, stored.key);
    index.connections.push(stored);
    writeIndexUnlocked(index);
    return toFileHubConnectionPublic(stored);
  });
}

export async function updateFileHubConnection(
  idOrKey: string,
  payload: FileHubConnectionWritePayload,
  actor: string,
): Promise<FileHubConnectionPublic> {
  return withStoreLockAsync(async () => {
    const index = readIndexUnlocked();
    const current = findRecord(index, idOrKey);
    if (!current) {
      throw new FileHubStoreError('File Hub connection was not found.', 404);
    }
    const authMethod = resolveAuthMethod(payload, current);
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
    return toFileHubConnectionPublic(next);
  });
}

export async function deleteFileHubConnection(idOrKey: string): Promise<boolean> {
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
  await deleteFileHubVaultSecrets(removedId);
  return true;
}

function findRecord(index: FileHubIndexFile, idOrKey: string): FileHubConnectionRecord | null {
  const needle = idOrKey.trim();
  if (!needle) {
    return null;
  }
  return index.connections.find((item) => item.id === needle || item.key === needle) ?? null;
}

function assertUniqueKey(index: FileHubIndexFile, key: string, exceptId?: string): void {
  const collision = index.connections.find((item) => item.key === key && item.id !== exceptId);
  if (collision) {
    throw new FileHubStoreError(`A File Hub connection with key "${key}" already exists.`, 409);
  }
}

function resolveAuthMethod(
  payload: FileHubConnectionWritePayload,
  current: Partial<FileHubConnectionRecord>,
): FileHubAuthMethod {
  const protocol = parseFileHubProtocol(payload.protocol ?? current.protocol) ?? 'sftp';
  const authMethod = resolveFileHubAuthMethod(
    protocol,
    parseFileHubAuthMethod(payload.authMethod ?? current.authMethod),
  );
  if (authMethod === 'privateKey' && !protocolAllowsPrivateKey(protocol)) {
    throw new FileHubStoreError('Private-key authentication is only available for SFTP.', 400);
  }
  return authMethod;
}

function computeSecretFlags(
  payload: FileHubConnectionWritePayload,
  previous: SecretFlags,
  authMethod: FileHubAuthMethod,
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
  payload: FileHubConnectionWritePayload,
  previous: SecretFlags,
  authMethod: FileHubAuthMethod,
): Promise<SecretFlags> {
  let hasPassword = previous.hasPassword;
  let hasPrivateKey = previous.hasPrivateKey;
  let hasPassphrase = previous.hasPassphrase;

  if (payload.clearPassword) {
    await deleteFileHubVaultSecret(ownerId, FILE_HUB_PASSWORD_PURPOSE);
    hasPassword = false;
  } else if (typeof payload.password === 'string' && payload.password.length > 0) {
    await setFileHubVaultSecret(ownerId, FILE_HUB_PASSWORD_PURPOSE, payload.password);
    hasPassword = true;
  }

  if (payload.clearPrivateKey) {
    await deleteFileHubVaultSecret(ownerId, FILE_HUB_PRIVATE_KEY_PURPOSE);
    hasPrivateKey = false;
  } else if (typeof payload.privateKey === 'string' && payload.privateKey.trim()) {
    await setFileHubVaultSecret(ownerId, FILE_HUB_PRIVATE_KEY_PURPOSE, payload.privateKey);
    hasPrivateKey = true;
  }

  if (payload.clearPassphrase) {
    await deleteFileHubVaultSecret(ownerId, FILE_HUB_PASSPHRASE_PURPOSE);
    hasPassphrase = false;
  } else if (typeof payload.passphrase === 'string' && payload.passphrase.length > 0) {
    await setFileHubVaultSecret(ownerId, FILE_HUB_PASSPHRASE_PURPOSE, payload.passphrase);
    hasPassphrase = true;
  }

  if (authMethod === 'password') {
    if (hasPrivateKey) {
      await deleteFileHubVaultSecret(ownerId, FILE_HUB_PRIVATE_KEY_PURPOSE);
      hasPrivateKey = false;
    }
    if (hasPassphrase) {
      await deleteFileHubVaultSecret(ownerId, FILE_HUB_PASSPHRASE_PURPOSE);
      hasPassphrase = false;
    }
  } else if (hasPassword) {
    await deleteFileHubVaultSecret(ownerId, FILE_HUB_PASSWORD_PURPOSE);
    hasPassword = false;
  }

  return { hasPassword, hasPrivateKey, hasPassphrase };
}

function buildRecord(
  payload: FileHubConnectionWritePayload,
  current: Pick<FileHubConnectionRecord, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'> & Partial<FileHubConnectionRecord>,
  options: { requireSecret: boolean; takenKeys?: string[]; flags: SecretFlags },
): FileHubConnectionRecord {
  const name = sanitizeFileHubDisplayName(payload.name ?? current.name ?? '');
  const nameError = validateFileHubDisplayName(name);
  if (nameError) {
    throw new FileHubStoreError(nameError, 400);
  }

  const key = current.key || allocateInternalLatinSlug({
    seed: payload.key?.trim() || name,
    id: current.id,
    taken: options.takenKeys ?? [],
  });

  const host = stripHostBrackets(payload.host ?? current.host ?? '');
  const hostError = validateFileHubHost(host);
  if (hostError) {
    throw new FileHubStoreError(hostError, 400);
  }

  const username = (payload.username ?? current.username ?? '').trim();
  const usernameError = validateFileHubUsername(username);
  if (usernameError) {
    throw new FileHubStoreError(usernameError, 400);
  }

  const protocol = parseFileHubProtocol(payload.protocol ?? current.protocol) ?? 'sftp';
  const defaultPort = FILE_HUB_DEFAULT_PORTS[protocol];
  const port = parseFileHubPort(payload.port ?? current.port ?? defaultPort);
  if (port == null) {
    throw new FileHubStoreError('Port must be an integer between 1 and 65535.', 400);
  }

  const authMethod = resolveFileHubAuthMethod(
    protocol,
    parseFileHubAuthMethod(payload.authMethod ?? current.authMethod),
  );
  if (authMethod === 'privateKey' && !protocolAllowsPrivateKey(protocol)) {
    throw new FileHubStoreError('Private-key authentication is only available for SFTP.', 400);
  }

  const flags: SecretFlags = {
    hasPassword: authMethod === 'password' ? options.flags.hasPassword : false,
    hasPrivateKey: authMethod === 'privateKey' ? options.flags.hasPrivateKey : false,
    hasPassphrase: authMethod === 'privateKey' ? options.flags.hasPassphrase : false,
  };

  if (authMethod === 'password' && !flags.hasPassword && options.requireSecret) {
    throw new FileHubStoreError('Password is required for password authentication.', 400);
  }
  if (authMethod === 'privateKey' && !flags.hasPrivateKey && options.requireSecret) {
    throw new FileHubStoreError('Private key is required for key authentication.', 400);
  }
  if (authMethod === 'password' && !flags.hasPassword) {
    throw new FileHubStoreError('This connection has no stored password. Enter a password to save.', 400);
  }
  if (authMethod === 'privateKey' && !flags.hasPrivateKey) {
    throw new FileHubStoreError('This connection has no stored private key. Paste a key to save.', 400);
  }

  return {
    id: current.id,
    key,
    name,
    protocol,
    host,
    port,
    username,
    authMethod,
    hasPassword: flags.hasPassword,
    hasPrivateKey: flags.hasPrivateKey,
    hasPassphrase: flags.hasPassphrase,
    initialPath: sanitizeInitialPath(payload.initialPath ?? current.initialPath ?? ''),
    tags: sanitizeFileHubTags(payload.tags ?? current.tags ?? []),
    note: sanitizeFileHubNote(payload.note ?? current.note ?? ''),
    createdAt: current.createdAt,
    createdBy: current.createdBy,
    updatedAt: current.updatedAt,
    updatedBy: current.updatedBy,
  };
}
