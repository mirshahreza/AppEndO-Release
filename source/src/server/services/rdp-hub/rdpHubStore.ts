import crypto from 'node:crypto';
import fs from 'node:fs';
import {
  acquireRuntimeLock,
  atomicWriteText,
  ensureRuntimeDirs,
  releaseRuntimeLock,
} from '../../../core/runtime/RuntimeFileStore';
import { runtimeDirs, RDP_HUB_INDEX_PATH } from '../../../core/runtime/runtimePaths';
import type {
  RdpHubConnectionPublic,
  RdpHubConnectionRecord,
  RdpHubConnectionWritePayload,
  RdpHubIndexFile,
} from '../../../shared/api/contracts/rdp-hub/types';
import {
  parseRdpHubPort,
  parseRdpHubSecurity,
  sanitizeRdpHubDisplayName,
  sanitizeRdpHubDomain,
  sanitizeRdpHubNote,
  sanitizeRdpHubTags,
  RDP_HUB_DEFAULT_PORT,
  RDP_HUB_DEFAULT_SECURITY,
  stripHostBrackets,
  validateRdpHubDisplayName,
  validateRdpHubDomain,
  validateRdpHubHost,
  validateRdpHubUsername,
} from '../../../shared/api/contracts/rdp-hub/validation';
import { allocateInternalLatinSlug } from '../../../shared/lib/latinSlug';
import {
  LEGACY_RDP_HUB_SECRET_BLOB_ERROR,
  deleteRdpHubVaultSecret,
  deleteRdpHubVaultSecrets,
  getRdpHubVaultSecret,
  isLegacyRdpHubSecretBlob,
  setRdpHubVaultSecret,
} from './rdpHubVault';

const LOCK_NAME = 'rdp-hub';

type RdpHubRecordOnDisk = RdpHubConnectionRecord & {
  passwordCipher?: unknown;
};

export class RdpHubStoreError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'RdpHubStoreError';
  }
}

const emptyIndex = (): RdpHubIndexFile => ({
  schema: 'appendo-rdp-hub-index',
  schemaVersion: '1.0.0',
  updatedAt: new Date().toISOString(),
  connections: [],
});

function ensureStoreDirs(): void {
  ensureRuntimeDirs([runtimeDirs.rdpHub, runtimeDirs.rdpHubLocks, runtimeDirs.workspaceTemp]);
}

function withStoreLock<T>(fn: () => T): T {
  ensureStoreDirs();
  if (!acquireRuntimeLock(runtimeDirs.rdpHubLocks, LOCK_NAME)) {
    throw new RdpHubStoreError('RDP Hub catalog is busy. Retry in a moment.', 409);
  }
  try {
    return fn();
  } finally {
    releaseRuntimeLock(runtimeDirs.rdpHubLocks, LOCK_NAME);
  }
}

async function withStoreLockAsync<T>(fn: () => Promise<T>): Promise<T> {
  ensureStoreDirs();
  if (!acquireRuntimeLock(runtimeDirs.rdpHubLocks, LOCK_NAME)) {
    throw new RdpHubStoreError('RDP Hub catalog is busy. Retry in a moment.', 409);
  }
  try {
    return await fn();
  } finally {
    releaseRuntimeLock(runtimeDirs.rdpHubLocks, LOCK_NAME);
  }
}

const assertNoLegacySecretBlob = (value: unknown): void => {
  if (isLegacyRdpHubSecretBlob(value)) {
    throw new Error(LEGACY_RDP_HUB_SECRET_BLOB_ERROR);
  }
};

function normalizeRecord(entry: RdpHubRecordOnDisk): RdpHubConnectionRecord {
  assertNoLegacySecretBlob(entry.passwordCipher);
  const { passwordCipher: _passwordCipher, ...rest } = entry;
  return {
    ...rest,
    hasPassword: Boolean(entry.hasPassword),
  };
}

function readIndexUnlocked(): RdpHubIndexFile {
  ensureStoreDirs();
  if (!fs.existsSync(RDP_HUB_INDEX_PATH)) {
    return emptyIndex();
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(RDP_HUB_INDEX_PATH, 'utf8')) as Partial<RdpHubIndexFile>;
    if (!parsed || parsed.schema !== 'appendo-rdp-hub-index' || !Array.isArray(parsed.connections)) {
      return emptyIndex();
    }
    return {
      schema: 'appendo-rdp-hub-index',
      schemaVersion: '1.0.0',
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
      connections: parsed.connections
        .filter((item): item is RdpHubConnectionRecord => Boolean(item?.id && item.key))
        .map((item) => normalizeRecord(item)),
    };
  } catch (error) {
    if (error instanceof Error && error.message === LEGACY_RDP_HUB_SECRET_BLOB_ERROR) {
      throw error;
    }
    return emptyIndex();
  }
}

function writeIndexUnlocked(index: RdpHubIndexFile): void {
  const next: RdpHubIndexFile = {
    ...index,
    updatedAt: new Date().toISOString(),
  };
  atomicWriteText(RDP_HUB_INDEX_PATH, `${JSON.stringify(next, null, 2)}\n`, runtimeDirs.workspaceTemp);
}

export function toRdpHubConnectionPublic(record: RdpHubConnectionRecord): RdpHubConnectionPublic {
  return {
    id: record.id,
    key: record.key,
    name: record.name,
    host: record.host,
    port: record.port,
    username: record.username,
    domain: record.domain,
    security: record.security,
    ignoreCert: record.ignoreCert,
    hasPassword: Boolean(record.hasPassword),
    tags: [...record.tags],
    note: record.note,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    createdBy: record.createdBy,
    updatedBy: record.updatedBy,
  };
}

export type RdpHubResolvedSecrets = {
  password?: string;
};

export function listRdpHubConnections(): RdpHubConnectionPublic[] {
  return withStoreLock(() => readIndexUnlocked().connections.map(toRdpHubConnectionPublic));
}

export function getRdpHubConnection(idOrKey: string): RdpHubConnectionPublic | null {
  const record = withStoreLock(() => findRecord(readIndexUnlocked(), idOrKey));
  return record ? toRdpHubConnectionPublic(record) : null;
}

export async function getRdpHubConnectionSecrets(idOrKey: string): Promise<{
  record: RdpHubConnectionRecord;
  secrets: RdpHubResolvedSecrets;
} | null> {
  const record = withStoreLock(() => findRecord(readIndexUnlocked(), idOrKey));
  if (!record) {
    return null;
  }
  const secrets: RdpHubResolvedSecrets = {};
  if (record.hasPassword) {
    secrets.password = await getRdpHubVaultSecret(record.id) ?? undefined;
  }
  return { record, secrets };
}

function computeHasPassword(payload: RdpHubConnectionWritePayload, previous: boolean): boolean {
  if (payload.clearPassword) {
    return false;
  }
  if (typeof payload.password === 'string' && payload.password.length > 0) {
    return true;
  }
  return previous;
}

async function syncVaultPassword(
  ownerId: string,
  payload: RdpHubConnectionWritePayload,
  previous: boolean,
): Promise<boolean> {
  if (payload.clearPassword) {
    await deleteRdpHubVaultSecret(ownerId);
    return false;
  }
  if (typeof payload.password === 'string' && payload.password.length > 0) {
    await setRdpHubVaultSecret(ownerId, payload.password);
    return true;
  }
  return previous;
}

export async function createRdpHubConnection(
  payload: RdpHubConnectionWritePayload,
  actor: string,
): Promise<RdpHubConnectionPublic> {
  const id = crypto.randomUUID();
  return withStoreLockAsync(async () => {
    const index = readIndexUnlocked();
    const now = new Date().toISOString();
    const record = buildRecord(payload, {
      id,
      createdAt: now,
      createdBy: actor,
      updatedAt: now,
      updatedBy: actor,
    }, {
      requireSecret: true,
      hasPassword: computeHasPassword(payload, false),
      takenKeys: index.connections.map((item) => item.key),
    });
    const hasPassword = await syncVaultPassword(id, payload, false);
    const stored: RdpHubConnectionRecord = {
      ...record,
      hasPassword,
    };
    assertUniqueKey(index, stored.key);
    index.connections.push(stored);
    writeIndexUnlocked(index);
    return toRdpHubConnectionPublic(stored);
  });
}

export async function updateRdpHubConnection(
  idOrKey: string,
  payload: RdpHubConnectionWritePayload,
  actor: string,
): Promise<RdpHubConnectionPublic> {
  return withStoreLockAsync(async () => {
    const index = readIndexUnlocked();
    const current = findRecord(index, idOrKey);
    if (!current) {
      throw new RdpHubStoreError('RDP connection was not found.', 404);
    }
    const next = buildRecord(payload, current, {
      requireSecret: false,
      hasPassword: computeHasPassword(payload, current.hasPassword),
    });
    next.hasPassword = await syncVaultPassword(current.id, payload, current.hasPassword);
    next.updatedAt = new Date().toISOString();
    next.updatedBy = actor;
    if (next.key !== current.key) {
      assertUniqueKey(index, next.key, current.id);
    }
    index.connections = index.connections.map((item) => (item.id === current.id ? next : item));
    writeIndexUnlocked(index);
    return toRdpHubConnectionPublic(next);
  });
}

export async function deleteRdpHubConnection(idOrKey: string): Promise<boolean> {
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
  await deleteRdpHubVaultSecrets(removedId);
  return true;
}

function findRecord(index: RdpHubIndexFile, idOrKey: string): RdpHubConnectionRecord | null {
  const needle = idOrKey.trim();
  if (!needle) {
    return null;
  }
  return index.connections.find((item) => item.id === needle || item.key === needle) ?? null;
}

function assertUniqueKey(index: RdpHubIndexFile, key: string, exceptId?: string): void {
  const collision = index.connections.find((item) => item.key === key && item.id !== exceptId);
  if (collision) {
    throw new RdpHubStoreError(`An RDP connection with key "${key}" already exists.`, 409);
  }
}

function parseIgnoreCert(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }
  return fallback;
}

function buildRecord(
  payload: RdpHubConnectionWritePayload,
  current: Pick<RdpHubConnectionRecord, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'> & Partial<RdpHubConnectionRecord>,
  options: { requireSecret: boolean; takenKeys?: string[]; hasPassword: boolean },
): RdpHubConnectionRecord {
  const name = sanitizeRdpHubDisplayName(payload.name ?? current.name ?? '');
  const nameError = validateRdpHubDisplayName(name);
  if (nameError) {
    throw new RdpHubStoreError(nameError, 400);
  }

  const key = current.key || allocateInternalLatinSlug({
    seed: payload.key?.trim() || name,
    id: current.id,
    taken: options.takenKeys ?? [],
  });

  const host = stripHostBrackets(payload.host ?? current.host ?? '');
  const hostError = validateRdpHubHost(host);
  if (hostError) {
    throw new RdpHubStoreError(hostError, 400);
  }

  const username = (payload.username ?? current.username ?? '').trim();
  const usernameError = validateRdpHubUsername(username);
  if (usernameError) {
    throw new RdpHubStoreError(usernameError, 400);
  }

  const domain = sanitizeRdpHubDomain(payload.domain ?? current.domain ?? '');
  const domainError = validateRdpHubDomain(domain);
  if (domainError) {
    throw new RdpHubStoreError(domainError, 400);
  }

  const port = parseRdpHubPort(payload.port ?? current.port ?? RDP_HUB_DEFAULT_PORT);
  if (port == null) {
    throw new RdpHubStoreError('Port must be an integer between 1 and 65535.', 400);
  }

  const security = parseRdpHubSecurity(payload.security ?? current.security) ?? RDP_HUB_DEFAULT_SECURITY;
  const ignoreCert = parseIgnoreCert(payload.ignoreCert, current.ignoreCert ?? true);
  const hasPassword = options.hasPassword;

  if (!hasPassword && options.requireSecret) {
    throw new RdpHubStoreError('Password is required.', 400);
  }
  if (!hasPassword) {
    throw new RdpHubStoreError('This connection has no stored password. Enter a password to save.', 400);
  }

  return {
    id: current.id,
    key,
    name,
    host,
    port,
    username,
    domain,
    security,
    ignoreCert,
    hasPassword,
    tags: sanitizeRdpHubTags(payload.tags ?? current.tags ?? []),
    note: sanitizeRdpHubNote(payload.note ?? current.note ?? ''),
    createdAt: current.createdAt,
    createdBy: current.createdBy,
    updatedAt: current.updatedAt,
    updatedBy: current.updatedBy,
  };
}
