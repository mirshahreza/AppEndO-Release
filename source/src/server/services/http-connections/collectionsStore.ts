import crypto from "node:crypto";
import fs from "node:fs";
import {
  acquireRuntimeLock,
  atomicWriteText,
  ensureRuntimeDirs,
  releaseRuntimeLock,
} from "../../../core/runtime/RuntimeFileStore";
import { runtimeDirs, HTTP_WORKSHOP_COLLECTIONS_INDEX_PATH } from "../../../core/runtime/runtimePaths";
import {
  HTTP_WORKSHOP_VAULT_OWNER_TYPE,
  LEGACY_HTTP_SECRET_BLOB_ERROR,
  copyHttpVaultSecret,
  deleteHttpVaultSecrets,
  isLegacyHttpSecretBlob,
  setHttpVaultSecret,
} from "./httpConnectionVault";
import {
  INHERIT_AUTH,
  toHttpWorkshopAuthSummary,
  type HttpWorkshopAuth,
  type HttpWorkshopAuthInput,
  type HttpWorkshopAuthSummary,
  type HttpWorkshopCollection,
  type HttpWorkshopFolder,
  type HttpWorkshopRequest,
  type HttpWorkshopAssertion,
  type HttpWorkshopKeyValue,
  type HttpWorkshopFormField,
  type HttpWorkshopBodyMode,
  type HttpWorkshopMethod,
} from "./apiTalkTypes";

type IndexFile = {
  schema: "appendo-http-workshop-collections-index";
  schemaVersion: "1.0.0";
  updatedAt: string;
  collections: HttpWorkshopCollection[];
  folders: HttpWorkshopFolder[];
  requests: HttpWorkshopRequest[];
};

const LOCK_NAME = "http-workshop-collections";

const emptyIndex = (): IndexFile => ({
  schema: "appendo-http-workshop-collections-index",
  schemaVersion: "1.0.0",
  updatedAt: new Date().toISOString(),
  collections: [],
  folders: [],
  requests: [],
});

function ensureStoreDirs(): void {
  ensureRuntimeDirs([runtimeDirs.httpConnections, runtimeDirs.httpConnectionsLocks, runtimeDirs.workspaceTemp]);
}

function withStoreLock<T>(fn: () => T): T {
  ensureStoreDirs();
  if (!acquireRuntimeLock(runtimeDirs.httpConnectionsLocks, LOCK_NAME)) {
    throw new Error("API Talk collections store is busy. Retry in a moment.");
  }
  try {
    return fn();
  } finally {
    releaseRuntimeLock(runtimeDirs.httpConnectionsLocks, LOCK_NAME);
  }
}

async function withStoreLockAsync<T>(fn: () => Promise<T>): Promise<T> {
  ensureStoreDirs();
  if (!acquireRuntimeLock(runtimeDirs.httpConnectionsLocks, LOCK_NAME)) {
    throw new Error("API Talk collections store is busy. Retry in a moment.");
  }
  try {
    return await fn();
  } finally {
    releaseRuntimeLock(runtimeDirs.httpConnectionsLocks, LOCK_NAME);
  }
}

function readIndexUnlocked(): IndexFile {
  ensureStoreDirs();
  if (!fs.existsSync(HTTP_WORKSHOP_COLLECTIONS_INDEX_PATH)) {
    return emptyIndex();
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(HTTP_WORKSHOP_COLLECTIONS_INDEX_PATH, "utf8")) as Partial<IndexFile>;
    if (!parsed || parsed.schema !== "appendo-http-workshop-collections-index") {
      return emptyIndex();
    }
    return {
      schema: "appendo-http-workshop-collections-index",
      schemaVersion: "1.0.0",
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
      collections: Array.isArray(parsed.collections)
        ? parsed.collections
          .filter((item): item is HttpWorkshopCollection => Boolean(item?.id && item.name))
          .map((item) => ({ ...item, auth: normalizeAuth(item.auth) }))
        : [],
      folders: Array.isArray(parsed.folders)
        ? parsed.folders
          .filter((item): item is HttpWorkshopFolder => Boolean(item?.id && item.collectionId))
          .map((item) => ({ ...item, auth: normalizeAuth(item.auth) }))
        : [],
      requests: Array.isArray(parsed.requests)
        ? parsed.requests
          .filter((item): item is HttpWorkshopRequest => Boolean(item?.id && item.collectionId))
          .map((item) => ({ ...item, auth: normalizeAuth(item.auth) }))
        : [],
    };
  } catch (error) {
    if (error instanceof Error && error.message === LEGACY_HTTP_SECRET_BLOB_ERROR) {
      throw error;
    }
    return emptyIndex();
  }
}

function writeIndexUnlocked(index: IndexFile): void {
  const next: IndexFile = { ...index, updatedAt: new Date().toISOString() };
  atomicWriteText(HTTP_WORKSHOP_COLLECTIONS_INDEX_PATH, `${JSON.stringify(next, null, 2)}\n`, runtimeDirs.workspaceTemp);
}

const assertNoLegacyAuthBlob = (auth: HttpWorkshopAuth & { secret?: unknown }): void => {
  if (isLegacyHttpSecretBlob(auth.secret)) {
    throw new Error(LEGACY_HTTP_SECRET_BLOB_ERROR);
  }
};

const normalizeAuth = (auth: HttpWorkshopAuth & { secret?: unknown } | undefined): HttpWorkshopAuth => {
  if (!auth) {
    return { ...INHERIT_AUTH };
  }
  assertNoLegacyAuthBlob(auth);
  const { secret: _secret, ...rest } = auth;
  return { ...rest, hasSecret: Boolean(auth.hasSecret) };
};

async function persistAuthSecret(
  ownerId: string,
  input: HttpWorkshopAuthInput | undefined,
  previous?: HttpWorkshopAuth,
): Promise<HttpWorkshopAuth> {
  if (!input) {
    return previous ?? { ...INHERIT_AUTH };
  }
  const next: HttpWorkshopAuth = {
    kind: input.kind,
    apiKeyHeaderName: input.apiKeyHeaderName,
    basicUsername: input.basicUsername,
    customHeaders: input.customHeaders,
    hasSecret: Boolean(previous?.hasSecret),
  };
  if (input.secretPlaintext !== undefined) {
    const trimmed = input.secretPlaintext.trim();
    if (trimmed) {
      await setHttpVaultSecret(HTTP_WORKSHOP_VAULT_OWNER_TYPE, ownerId, trimmed);
      next.hasSecret = true;
    }
  }
  return next;
}

async function copyAuthSecret(
  fromOwnerId: string,
  toOwnerId: string,
  auth: HttpWorkshopAuth,
): Promise<HttpWorkshopAuth> {
  if (!auth.hasSecret) {
    return { ...auth, hasSecret: false };
  }
  const copied = await copyHttpVaultSecret(HTTP_WORKSHOP_VAULT_OWNER_TYPE, fromOwnerId, toOwnerId);
  return { ...auth, hasSecret: copied };
}

export type HttpWorkshopCollectionSummary = Omit<HttpWorkshopCollection, "auth"> & { auth: HttpWorkshopAuthSummary };
export type HttpWorkshopFolderSummary = Omit<HttpWorkshopFolder, "auth"> & { auth: HttpWorkshopAuthSummary };

function toCollectionSummary(record: HttpWorkshopCollection): HttpWorkshopCollectionSummary {
  return { ...record, auth: toHttpWorkshopAuthSummary(record.auth) };
}

function toFolderSummary(record: HttpWorkshopFolder): HttpWorkshopFolderSummary {
  return { ...record, auth: toHttpWorkshopAuthSummary(record.auth) };
}

// ---- Collections ----

export function listCollections(): HttpWorkshopCollectionSummary[] {
  return withStoreLock(() => readIndexUnlocked().collections
    .map(toCollectionSummary)
    .sort((a, b) => a.name.localeCompare(b.name)));
}

export function getCollectionSummary(id: string): HttpWorkshopCollectionSummary | null {
  return withStoreLock(() => {
    const record = readIndexUnlocked().collections.find((entry) => entry.id === id);
    return record ? toCollectionSummary(record) : null;
  });
}

/** Internal use only (executor/migration) — metadata; secrets are in the credential vault. */
export function getCollectionRecord(id: string): HttpWorkshopCollection | null {
  return withStoreLock(() => readIndexUnlocked().collections.find((entry) => entry.id === id) ?? null);
}

export type CreateCollectionInput = {
  name: string;
  description?: string;
  auth?: HttpWorkshopAuthInput;
  migratedFromLegacyId?: string;
  createdByUserId: number;
};

export async function createCollection(input: CreateCollectionInput): Promise<HttpWorkshopCollectionSummary> {
  const id = crypto.randomUUID();
  const auth = await persistAuthSecret(id, input.auth);
  return withStoreLock(() => {
    const index = readIndexUnlocked();
    const now = new Date().toISOString();
    const record: HttpWorkshopCollection = {
      id,
      name: input.name,
      description: input.description,
      auth,
      migratedFromLegacyId: input.migratedFromLegacyId,
      createdAt: now,
      updatedAt: now,
      createdByUserId: input.createdByUserId,
    };
    index.collections = [...index.collections, record];
    writeIndexUnlocked(index);
    return toCollectionSummary(record);
  });
}

/** Idempotency helper for the legacy migration script - find a collection already migrated from a given legacy record id. */
export function findCollectionByMigratedLegacyId(legacyId: string): HttpWorkshopCollection | null {
  return withStoreLock(() => readIndexUnlocked().collections.find((entry) => entry.migratedFromLegacyId === legacyId) ?? null);
}

export type UpdateCollectionInput = Partial<{
  name: string;
  description: string | null;
  auth: HttpWorkshopAuthInput;
}>;

export async function updateCollection(id: string, patch: UpdateCollectionInput): Promise<HttpWorkshopCollectionSummary | null> {
  const existing = withStoreLock(() => readIndexUnlocked().collections.find((entry) => entry.id === id) ?? null);
  if (!existing) {
    return null;
  }
  const auth = patch.auth !== undefined
    ? await persistAuthSecret(id, patch.auth, existing.auth)
    : existing.auth;
  return withStoreLock(() => {
    const index = readIndexUnlocked();
    const current = index.collections.find((entry) => entry.id === id);
    if (!current) {
      return null;
    }
    const next: HttpWorkshopCollection = {
      ...current,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description ?? undefined } : {}),
      auth,
      updatedAt: new Date().toISOString(),
    };
    index.collections = index.collections.map((entry) => (entry.id === id ? next : entry));
    writeIndexUnlocked(index);
    return toCollectionSummary(next);
  });
}

function collectDescendantFolderIds(folders: HttpWorkshopFolder[], rootFolderIds: string[]): Set<string> {
  const result = new Set(rootFolderIds);
  let grew = true;
  while (grew) {
    grew = false;
    for (const folder of folders) {
      if (folder.parentFolderId && result.has(folder.parentFolderId) && !result.has(folder.id)) {
        result.add(folder.id);
        grew = true;
      }
    }
  }
  return result;
}

export async function deleteCollection(id: string): Promise<boolean> {
  const removedIds = withStoreLock(() => {
    const index = readIndexUnlocked();
    const nextCollections = index.collections.filter((entry) => entry.id !== id);
    const changed = nextCollections.length !== index.collections.length;
    if (!changed) {
      return [] as string[];
    }
    const folderIds = index.folders.filter((entry) => entry.collectionId === id).map((entry) => entry.id);
    const requestIds = index.requests.filter((entry) => entry.collectionId === id).map((entry) => entry.id);
    index.collections = nextCollections;
    index.folders = index.folders.filter((entry) => entry.collectionId !== id);
    index.requests = index.requests.filter((entry) => entry.collectionId !== id);
    writeIndexUnlocked(index);
    return [id, ...folderIds, ...requestIds];
  });
  for (const ownerId of removedIds) {
    await deleteHttpVaultSecrets(HTTP_WORKSHOP_VAULT_OWNER_TYPE, ownerId);
  }
  return removedIds.length > 0;
}

// ---- Folders ----

export function listFolders(collectionId: string): HttpWorkshopFolderSummary[] {
  return withStoreLock(() => readIndexUnlocked().folders
    .filter((entry) => entry.collectionId === collectionId)
    .map(toFolderSummary)
    .sort((a, b) => a.sortOrder - b.sortOrder));
}

export function getFolderRecord(id: string): HttpWorkshopFolder | null {
  return withStoreLock(() => readIndexUnlocked().folders.find((entry) => entry.id === id) ?? null);
}

export type CreateFolderInput = {
  collectionId: string;
  parentFolderId?: string | null;
  name: string;
  auth?: HttpWorkshopAuthInput;
  sortOrder?: number;
};

export async function createFolder(input: CreateFolderInput): Promise<HttpWorkshopFolderSummary> {
  const id = crypto.randomUUID();
  const auth = await persistAuthSecret(id, input.auth);
  return withStoreLock(() => {
    const index = readIndexUnlocked();
    const now = new Date().toISOString();
    const siblingCount = index.folders.filter((entry) => entry.collectionId === input.collectionId
      && entry.parentFolderId === (input.parentFolderId ?? null)).length;
    const record: HttpWorkshopFolder = {
      id,
      collectionId: input.collectionId,
      parentFolderId: input.parentFolderId ?? null,
      name: input.name,
      auth,
      sortOrder: input.sortOrder ?? siblingCount,
      createdAt: now,
      updatedAt: now,
    };
    index.folders = [...index.folders, record];
    writeIndexUnlocked(index);
    return toFolderSummary(record);
  });
}

export type UpdateFolderInput = Partial<{
  name: string;
  parentFolderId: string | null;
  auth: HttpWorkshopAuthInput;
  sortOrder: number;
}>;

export async function updateFolder(id: string, patch: UpdateFolderInput): Promise<HttpWorkshopFolderSummary | null> {
  const existing = withStoreLock(() => readIndexUnlocked().folders.find((entry) => entry.id === id) ?? null);
  if (!existing) {
    return null;
  }
  const auth = patch.auth !== undefined
    ? await persistAuthSecret(id, patch.auth, existing.auth)
    : existing.auth;
  return withStoreLock(() => {
    const index = readIndexUnlocked();
    const current = index.folders.find((entry) => entry.id === id);
    if (!current) {
      return null;
    }
    const next: HttpWorkshopFolder = {
      ...current,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.parentFolderId !== undefined ? { parentFolderId: patch.parentFolderId } : {}),
      auth,
      ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
      updatedAt: new Date().toISOString(),
    };
    index.folders = index.folders.map((entry) => (entry.id === id ? next : entry));
    writeIndexUnlocked(index);
    return toFolderSummary(next);
  });
}

export async function deleteFolder(id: string): Promise<boolean> {
  const removedIds = withStoreLock(() => {
    const index = readIndexUnlocked();
    const existing = index.folders.find((entry) => entry.id === id);
    if (!existing) {
      return [] as string[];
    }
    const doomedFolderIds = collectDescendantFolderIds(index.folders, [id]);
    const requestIds = index.requests
      .filter((entry) => entry.folderId && doomedFolderIds.has(entry.folderId))
      .map((entry) => entry.id);
    index.folders = index.folders.filter((entry) => !doomedFolderIds.has(entry.id));
    index.requests = index.requests.filter((entry) => !(entry.folderId && doomedFolderIds.has(entry.folderId)));
    writeIndexUnlocked(index);
    return [...doomedFolderIds, ...requestIds];
  });
  for (const ownerId of removedIds) {
    await deleteHttpVaultSecrets(HTTP_WORKSHOP_VAULT_OWNER_TYPE, ownerId);
  }
  return removedIds.length > 0;
}

// ---- Requests ----

export type HttpWorkshopRequestSummary = Omit<HttpWorkshopRequest, "auth"> & { auth: HttpWorkshopAuthSummary };

function toRequestSummary(record: HttpWorkshopRequest): HttpWorkshopRequestSummary {
  return { ...record, auth: toHttpWorkshopAuthSummary(record.auth) };
}

export function listRequests(collectionId: string, folderId?: string | null): HttpWorkshopRequestSummary[] {
  return withStoreLock(() => readIndexUnlocked().requests
    .filter((entry) => entry.collectionId === collectionId && (folderId === undefined || entry.folderId === folderId))
    .map(toRequestSummary)
    .sort((a, b) => a.sortOrder - b.sortOrder));
}

export function getRequestSummary(id: string): HttpWorkshopRequestSummary | null {
  return withStoreLock(() => {
    const record = readIndexUnlocked().requests.find((entry) => entry.id === id);
    return record ? toRequestSummary(record) : null;
  });
}

/** Internal use only (executor) — metadata; secrets are in the credential vault. */
export function getRequestRecord(id: string): HttpWorkshopRequest | null {
  return withStoreLock(() => readIndexUnlocked().requests.find((entry) => entry.id === id) ?? null);
}

export type CreateRequestInput = {
  collectionId: string;
  folderId?: string | null;
  name: string;
  method: HttpWorkshopMethod;
  url: string;
  queryParams?: HttpWorkshopKeyValue[];
  headers?: HttpWorkshopKeyValue[];
  bodyMode?: HttpWorkshopBodyMode;
  bodyRaw?: string;
  bodyForm?: HttpWorkshopFormField[];
  auth?: HttpWorkshopAuthInput;
  assertions?: HttpWorkshopAssertion[];
  sortOrder?: number;
};

export async function createRequest(input: CreateRequestInput): Promise<HttpWorkshopRequestSummary> {
  const id = crypto.randomUUID();
  const auth = await persistAuthSecret(id, input.auth);
  return withStoreLock(() => {
    const index = readIndexUnlocked();
    const now = new Date().toISOString();
    const siblingCount = index.requests.filter((entry) => entry.collectionId === input.collectionId
      && entry.folderId === (input.folderId ?? null)).length;
    const record: HttpWorkshopRequest = {
      id,
      collectionId: input.collectionId,
      folderId: input.folderId ?? null,
      name: input.name,
      method: input.method,
      url: input.url,
      queryParams: input.queryParams ?? [],
      headers: input.headers ?? [],
      bodyMode: input.bodyMode ?? "none",
      bodyRaw: input.bodyRaw,
      bodyForm: input.bodyForm,
      auth,
      assertions: input.assertions ?? [],
      sortOrder: input.sortOrder ?? siblingCount,
      createdAt: now,
      updatedAt: now,
    };
    index.requests = [...index.requests, record];
    writeIndexUnlocked(index);
    return toRequestSummary(record);
  });
}

export type UpdateRequestInput = Partial<{
  name: string;
  folderId: string | null;
  method: HttpWorkshopMethod;
  url: string;
  queryParams: HttpWorkshopKeyValue[];
  headers: HttpWorkshopKeyValue[];
  bodyMode: HttpWorkshopBodyMode;
  bodyRaw: string;
  bodyForm: HttpWorkshopFormField[];
  auth: HttpWorkshopAuthInput;
  assertions: HttpWorkshopAssertion[];
  sortOrder: number;
}>;

export async function updateRequest(id: string, patch: UpdateRequestInput): Promise<HttpWorkshopRequestSummary | null> {
  const existing = withStoreLock(() => readIndexUnlocked().requests.find((entry) => entry.id === id) ?? null);
  if (!existing) {
    return null;
  }
  const auth = patch.auth !== undefined
    ? await persistAuthSecret(id, patch.auth, existing.auth)
    : existing.auth;
  return withStoreLock(() => {
    const index = readIndexUnlocked();
    const current = index.requests.find((entry) => entry.id === id);
    if (!current) {
      return null;
    }
    const next: HttpWorkshopRequest = {
      ...current,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.folderId !== undefined ? { folderId: patch.folderId } : {}),
      ...(patch.method !== undefined ? { method: patch.method } : {}),
      ...(patch.url !== undefined ? { url: patch.url } : {}),
      ...(patch.queryParams !== undefined ? { queryParams: patch.queryParams } : {}),
      ...(patch.headers !== undefined ? { headers: patch.headers } : {}),
      ...(patch.bodyMode !== undefined ? { bodyMode: patch.bodyMode } : {}),
      ...(patch.bodyRaw !== undefined ? { bodyRaw: patch.bodyRaw } : {}),
      ...(patch.bodyForm !== undefined ? { bodyForm: patch.bodyForm } : {}),
      auth,
      ...(patch.assertions !== undefined ? { assertions: patch.assertions } : {}),
      ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
      updatedAt: new Date().toISOString(),
    };
    index.requests = index.requests.map((entry) => (entry.id === id ? next : entry));
    writeIndexUnlocked(index);
    return toRequestSummary(next);
  });
}

export async function deleteRequest(id: string): Promise<boolean> {
  const changed = withStoreLock(() => {
    const index = readIndexUnlocked();
    const nextRequests = index.requests.filter((entry) => entry.id !== id);
    const removed = nextRequests.length !== index.requests.length;
    if (removed) {
      index.requests = nextRequests;
      writeIndexUnlocked(index);
    }
    return removed;
  });
  if (changed) {
    await deleteHttpVaultSecrets(HTTP_WORKSHOP_VAULT_OWNER_TYPE, id);
  }
  return changed;
}

function duplicateLabel(name: string): string {
  return `${name} copy`;
}

function cloneAuthMetadata(auth: HttpWorkshopAuth): HttpWorkshopAuth {
  return {
    kind: auth.kind,
    apiKeyHeaderName: auth.apiKeyHeaderName,
    basicUsername: auth.basicUsername,
    customHeaders: auth.customHeaders?.map((header) => ({ ...header })),
    hasSecret: Boolean(auth.hasSecret),
  };
}

async function cloneRequestInto(
  index: IndexFile,
  source: HttpWorkshopRequest,
  collectionId: string,
  folderId: string | null,
  name: string,
  now: string,
): Promise<HttpWorkshopRequest> {
  const siblingCount = index.requests.filter((entry) => entry.collectionId === collectionId && entry.folderId === folderId).length;
  const id = crypto.randomUUID();
  const record: HttpWorkshopRequest = {
    id,
    collectionId,
    folderId,
    name,
    method: source.method,
    url: source.url,
    queryParams: source.queryParams.map((item) => ({ ...item })),
    headers: source.headers.map((item) => ({ ...item })),
    bodyMode: source.bodyMode,
    bodyRaw: source.bodyRaw,
    bodyForm: source.bodyForm?.map((item) => ({ ...item })),
    auth: await copyAuthSecret(source.id, id, cloneAuthMetadata(source.auth)),
    assertions: source.assertions.map((item) => ({ ...item })),
    sortOrder: siblingCount,
    createdAt: now,
    updatedAt: now,
  };
  index.requests = [...index.requests, record];
  return record;
}

async function cloneFolderTree(
  index: IndexFile,
  sourceFolderId: string,
  collectionId: string,
  parentFolderId: string | null,
  rename: boolean,
  now: string,
): Promise<HttpWorkshopFolder | null> {
  const source = index.folders.find((entry) => entry.id === sourceFolderId);
  if (!source) {
    return null;
  }
  const siblingCount = index.folders.filter((entry) => entry.collectionId === collectionId && entry.parentFolderId === parentFolderId).length;
  const childFolderIds = index.folders
    .filter((entry) => entry.parentFolderId === sourceFolderId)
    .map((entry) => entry.id);
  const childRequests = index.requests.filter((entry) => entry.folderId === sourceFolderId);
  const id = crypto.randomUUID();
  const cloned: HttpWorkshopFolder = {
    id,
    collectionId,
    parentFolderId,
    name: rename ? duplicateLabel(source.name) : source.name,
    auth: await copyAuthSecret(source.id, id, cloneAuthMetadata(source.auth)),
    sortOrder: siblingCount,
    createdAt: now,
    updatedAt: now,
  };
  index.folders = [...index.folders, cloned];
  for (const request of childRequests) {
    await cloneRequestInto(index, request, collectionId, cloned.id, request.name, now);
  }
  for (const childId of childFolderIds) {
    await cloneFolderTree(index, childId, collectionId, cloned.id, false, now);
  }
  return cloned;
}

export async function duplicateCollection(id: string): Promise<HttpWorkshopCollectionSummary | null> {
  return withStoreLockAsync(async () => {
    const index = readIndexUnlocked();
    const existing = index.collections.find((entry) => entry.id === id);
    if (!existing) {
      return null;
    }
    const now = new Date().toISOString();
    const clonedId = crypto.randomUUID();
    const cloned: HttpWorkshopCollection = {
      ...existing,
      id: clonedId,
      name: duplicateLabel(existing.name),
      auth: await copyAuthSecret(existing.id, clonedId, cloneAuthMetadata(existing.auth)),
      createdAt: now,
      updatedAt: now,
    };
    index.collections = [...index.collections, cloned];
    const rootFolders = index.folders.filter((entry) => entry.collectionId === id && entry.parentFolderId === null);
    for (const folder of rootFolders) {
      await cloneFolderTree(index, folder.id, cloned.id, null, false, now);
    }
    const rootRequests = index.requests.filter((entry) => entry.collectionId === id && entry.folderId === null);
    for (const request of rootRequests) {
      await cloneRequestInto(index, request, cloned.id, null, request.name, now);
    }
    writeIndexUnlocked(index);
    return toCollectionSummary(cloned);
  });
}

export async function duplicateFolder(id: string): Promise<HttpWorkshopFolderSummary | null> {
  return withStoreLockAsync(async () => {
    const index = readIndexUnlocked();
    const existing = index.folders.find((entry) => entry.id === id);
    if (!existing) {
      return null;
    }
    const cloned = await cloneFolderTree(
      index,
      id,
      existing.collectionId,
      existing.parentFolderId,
      true,
      new Date().toISOString(),
    );
    if (!cloned) {
      return null;
    }
    writeIndexUnlocked(index);
    return toFolderSummary(cloned);
  });
}

export async function duplicateRequest(id: string): Promise<HttpWorkshopRequestSummary | null> {
  return withStoreLockAsync(async () => {
    const index = readIndexUnlocked();
    const existing = index.requests.find((entry) => entry.id === id);
    if (!existing) {
      return null;
    }
    const now = new Date().toISOString();
    const record = await cloneRequestInto(
      index,
      existing,
      existing.collectionId,
      existing.folderId,
      duplicateLabel(existing.name),
      now,
    );
    writeIndexUnlocked(index);
    return toRequestSummary(record);
  });
}

export type ResolvedHttpWorkshopAuth = HttpWorkshopAuth & { vaultOwnerId?: string };

/**
 * Walks Request -> Folder (up the parent chain) -> Collection to resolve the first
 * non-inherit auth config, matching Postman collection/folder/request inheritance.
 * `vaultOwnerId` is the record that actually holds the secret in the credential vault.
 */
export function resolveEffectiveAuth(requestId: string): ResolvedHttpWorkshopAuth {
  return withStoreLock(() => {
    const index = readIndexUnlocked();
    const request = index.requests.find((entry) => entry.id === requestId);
    if (!request) {
      return { kind: "none", hasSecret: false };
    }
    if (request.auth.kind !== "inherit") {
      return { ...request.auth, vaultOwnerId: request.id };
    }
    let folderId = request.folderId;
    while (folderId) {
      const folder = index.folders.find((entry) => entry.id === folderId);
      if (!folder) {
        break;
      }
      if (folder.auth.kind !== "inherit") {
        return { ...folder.auth, vaultOwnerId: folder.id };
      }
      folderId = folder.parentFolderId;
    }
    const collection = index.collections.find((entry) => entry.id === request.collectionId);
    if (collection && collection.auth.kind !== "inherit") {
      return { ...collection.auth, vaultOwnerId: collection.id };
    }
    return { kind: "none", hasSecret: false };
  });
}
