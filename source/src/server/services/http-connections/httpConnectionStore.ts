import crypto from 'node:crypto';
import fs from 'node:fs';
import {
  acquireRuntimeLock,
  atomicWriteText,
  ensureRuntimeDirs,
  releaseRuntimeLock,
} from '../../../core/runtime/RuntimeFileStore';
import { runtimeDirs, HTTP_CONNECTIONS_INDEX_PATH } from '../../../core/runtime/runtimePaths';
import type { ParsedOpenApiConnectorSpec } from '../../../shared/lib/openApiConnectorSpec';
import {
  HTTP_CONNECTION_VAULT_OWNER_TYPE,
  LEGACY_HTTP_SECRET_BLOB_ERROR,
  deleteHttpVaultSecrets,
  isLegacyHttpSecretBlob,
  setHttpVaultSecret,
} from './httpConnectionVault';

export type HttpConnectionAuthKind = 'none' | 'apiKey' | 'bearer' | 'basic';

export type HttpConnectionRecord = {
  id: string;
  name: string;
  baseUrl: string;
  authKind: HttpConnectionAuthKind;
  /** apiKey only — the header the key is sent in, e.g. "X-Api-Key". */
  apiKeyHeaderName?: string;
  /** basic only — password lives in the credential vault. */
  basicUsername?: string;
  hasSecret: boolean;
  openApiSpec?: ParsedOpenApiConnectorSpec;
  createdAt: string;
  updatedAt: string;
  createdByUserId: number;
};

/** What list/get responses expose to the client — never a vault blob or plaintext secret. */
export type HttpConnectionSummary = Omit<HttpConnectionRecord, 'openApiSpec'> & {
  hasOpenApiSpec: boolean;
  /** Present on get/create/update only — list omits the parsed spec to keep payloads small. */
  openApiSpec?: ParsedOpenApiConnectorSpec;
};

type HttpConnectionIndexFile = {
  schema: 'appendo-http-connections-index';
  schemaVersion: '1.0.0';
  updatedAt: string;
  entries: HttpConnectionRecord[];
};

const LOCK_NAME = 'http-connections';

const emptyIndex = (): HttpConnectionIndexFile => ({
  schema: 'appendo-http-connections-index',
  schemaVersion: '1.0.0',
  updatedAt: new Date().toISOString(),
  entries: [],
});

function ensureStoreDirs(): void {
  ensureRuntimeDirs([runtimeDirs.httpConnections, runtimeDirs.httpConnectionsLocks, runtimeDirs.workspaceTemp]);
}

function withStoreLock<T>(fn: () => T): T {
  ensureStoreDirs();
  if (!acquireRuntimeLock(runtimeDirs.httpConnectionsLocks, LOCK_NAME)) {
    throw new Error('HTTP Connections store is busy. Retry in a moment.');
  }
  try {
    return fn();
  } finally {
    releaseRuntimeLock(runtimeDirs.httpConnectionsLocks, LOCK_NAME);
  }
}

const assertNoLegacySecretBlob = (entry: Record<string, unknown>): void => {
  if (isLegacyHttpSecretBlob(entry.secret)) {
    throw new Error(LEGACY_HTTP_SECRET_BLOB_ERROR);
  }
};

function normalizeRecord(entry: HttpConnectionRecord & { secret?: unknown }): HttpConnectionRecord {
  assertNoLegacySecretBlob(entry as unknown as Record<string, unknown>);
  const { secret: _secret, ...rest } = entry;
  return {
    ...rest,
    hasSecret: Boolean(entry.hasSecret),
  };
}

function readIndexUnlocked(): HttpConnectionIndexFile {
  ensureStoreDirs();
  if (!fs.existsSync(HTTP_CONNECTIONS_INDEX_PATH)) {
    return emptyIndex();
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(HTTP_CONNECTIONS_INDEX_PATH, 'utf8')) as Partial<HttpConnectionIndexFile>;
    if (!parsed || parsed.schema !== 'appendo-http-connections-index' || !Array.isArray(parsed.entries)) {
      return emptyIndex();
    }
    return {
      schema: 'appendo-http-connections-index',
      schemaVersion: '1.0.0',
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
      entries: parsed.entries
        .filter((item): item is HttpConnectionRecord => Boolean(item?.id && item.name))
        .map((item) => normalizeRecord(item)),
    };
  } catch (error) {
    if (error instanceof Error && error.message === LEGACY_HTTP_SECRET_BLOB_ERROR) {
      throw error;
    }
    return emptyIndex();
  }
}

function writeIndexUnlocked(index: HttpConnectionIndexFile): void {
  const next: HttpConnectionIndexFile = { ...index, updatedAt: new Date().toISOString() };
  atomicWriteText(HTTP_CONNECTIONS_INDEX_PATH, `${JSON.stringify(next, null, 2)}\n`, runtimeDirs.workspaceTemp);
}

export function toHttpConnectionSummary(
  record: HttpConnectionRecord,
  options: { includeOpenApiSpec?: boolean } = {},
): HttpConnectionSummary {
  const { openApiSpec, ...rest } = record;
  return {
    ...rest,
    hasSecret: Boolean(record.hasSecret),
    hasOpenApiSpec: Boolean(openApiSpec),
    ...(options.includeOpenApiSpec ? { openApiSpec } : {}),
  };
}

export function listHttpConnections(): HttpConnectionSummary[] {
  return withStoreLock(() => readIndexUnlocked().entries
    .map((record) => toHttpConnectionSummary(record))
    .sort((a, b) => a.name.localeCompare(b.name)));
}

/** Internal use only (executor) — metadata only; secrets are in the vault. */
export function getHttpConnectionRecord(id: string): HttpConnectionRecord | null {
  return withStoreLock(() => readIndexUnlocked().entries.find((entry) => entry.id === id) ?? null);
}

export function getHttpConnectionSummary(id: string): HttpConnectionSummary | null {
  const record = getHttpConnectionRecord(id);
  return record ? toHttpConnectionSummary(record, { includeOpenApiSpec: true }) : null;
}

/** Internal use only (Server Function sandbox bridge) — resolves by exact name. */
export function findHttpConnectionRecordByName(name: string): HttpConnectionRecord | null {
  return withStoreLock(() => readIndexUnlocked().entries.find((entry) => entry.name === name) ?? null);
}

export type CreateHttpConnectionInput = {
  name: string;
  baseUrl: string;
  authKind: HttpConnectionAuthKind;
  apiKeyHeaderName?: string;
  basicUsername?: string;
  secretPlaintext?: string;
  openApiSpec?: ParsedOpenApiConnectorSpec;
  createdByUserId: number;
};

export async function createHttpConnection(input: CreateHttpConnectionInput): Promise<HttpConnectionSummary> {
  const id = crypto.randomUUID();
  const secretPlaintext = input.secretPlaintext?.trim() ?? '';
  if (secretPlaintext) {
    await setHttpVaultSecret(HTTP_CONNECTION_VAULT_OWNER_TYPE, id, secretPlaintext);
  }

  return withStoreLock(() => {
    const index = readIndexUnlocked();
    const now = new Date().toISOString();
    const record: HttpConnectionRecord = {
      id,
      name: input.name,
      baseUrl: input.baseUrl,
      authKind: input.authKind,
      apiKeyHeaderName: input.apiKeyHeaderName,
      basicUsername: input.basicUsername,
      hasSecret: Boolean(secretPlaintext),
      openApiSpec: input.openApiSpec,
      createdAt: now,
      updatedAt: now,
      createdByUserId: input.createdByUserId,
    };
    index.entries = [...index.entries, record];
    writeIndexUnlocked(index);
    return toHttpConnectionSummary(record, { includeOpenApiSpec: true });
  });
}

export type UpdateHttpConnectionInput = Partial<{
  name: string;
  baseUrl: string;
  authKind: HttpConnectionAuthKind;
  apiKeyHeaderName: string | null;
  basicUsername: string | null;
  /** Pass to rotate the stored secret; omit to keep the existing one. */
  secretPlaintext: string;
  openApiSpec: ParsedOpenApiConnectorSpec;
}>;

export async function updateHttpConnection(id: string, patch: UpdateHttpConnectionInput): Promise<HttpConnectionSummary | null> {
  const existing = getHttpConnectionRecord(id);
  if (!existing) {
    return null;
  }
  if (patch.secretPlaintext !== undefined && patch.secretPlaintext.trim()) {
    await setHttpVaultSecret(HTTP_CONNECTION_VAULT_OWNER_TYPE, id, patch.secretPlaintext.trim());
  }

  return withStoreLock(() => {
    const index = readIndexUnlocked();
    const existing = index.entries.find((entry) => entry.id === id);
    if (!existing) {
      return null;
    }
    const next: HttpConnectionRecord = {
      ...existing,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.baseUrl !== undefined ? { baseUrl: patch.baseUrl } : {}),
      ...(patch.authKind !== undefined ? { authKind: patch.authKind } : {}),
      ...(patch.apiKeyHeaderName !== undefined ? { apiKeyHeaderName: patch.apiKeyHeaderName ?? undefined } : {}),
      ...(patch.basicUsername !== undefined ? { basicUsername: patch.basicUsername ?? undefined } : {}),
      ...(patch.openApiSpec !== undefined ? { openApiSpec: patch.openApiSpec } : {}),
      ...(patch.secretPlaintext !== undefined && patch.secretPlaintext.trim()
        ? { hasSecret: true }
        : {}),
      updatedAt: new Date().toISOString(),
    };
    index.entries = index.entries.map((entry) => (entry.id === id ? next : entry));
    writeIndexUnlocked(index);
    return toHttpConnectionSummary(next, { includeOpenApiSpec: true });
  });
}

/** Internal use only (migration tooling) - metadata records; secrets are in the vault. */
export function listHttpConnectionRecordsInternal(): HttpConnectionRecord[] {
  return withStoreLock(() => readIndexUnlocked().entries);
}

export async function deleteHttpConnection(id: string): Promise<boolean> {
  const changed = withStoreLock(() => {
    const index = readIndexUnlocked();
    const nextEntries = index.entries.filter((entry) => entry.id !== id);
    const removed = nextEntries.length !== index.entries.length;
    if (removed) {
      index.entries = nextEntries;
      writeIndexUnlocked(index);
    }
    return removed;
  });
  if (changed) {
    await deleteHttpVaultSecrets(HTTP_CONNECTION_VAULT_OWNER_TYPE, id);
  }
  return changed;
}
