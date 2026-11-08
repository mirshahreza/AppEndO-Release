/**
 * FunctionFileStore — file-based persistence for custom server functions.
 * Layout:
 *   workspace/server-functions/custom/{folder}.{name}.ts
 *   workspace/server-functions/custom/{folder}.{name}.metadata.json
 *   workspace/server-functions/index.json
 */

import fs from 'fs';
import path from 'path';
import {
  buildFunctionMetadataFileName,
  buildFunctionSourceFileName,
  buildManagedFunctionId,
  isFunctionMetadataFileName,
} from './functionNaming';
import {
  acquireRuntimeLock,
  atomicWriteText,
  cleanupRuntimeTmpFiles,
  ensureRuntimeDirs,
  releaseRuntimeLock,
} from '../runtime/RuntimeFileStore';
import {
  SERVER_FUNCTIONS_INDEX_PATH,
  runtimeDirs,
} from '../runtime/runtimePaths';
import type {
  ManagedFunctionApiRow,
  ManagedFunctionCatalogRow,
  ManagedFunctionIndex,
  ManagedFunctionIndexEntry,
  ManagedFunctionMetadataFile,
  ManagedFunctionRecord,
} from '../../server/domain/functions/functionTypes';
import {
  EMPTY_FUNCTION_ACCESS_CONTROL,
  normalizeFunctionAccessControl,
  type FunctionAccessControl,
} from '../../shared/api/contracts/server-functions/accessControl';
import {
  normalizeServerFunctionHooks,
  type ServerFunctionHooksConfig,
} from '../../shared/api/contracts/server-functions/hooks';
import {
  normalizeRuntimeVersion,
  readUseGlobalConfig,
} from '../../shared/server-functions/runtimeConfig';

const LOCK_NAME = 'server-functions';

export const functionStoreDirs = {
  root: runtimeDirs.serverFunctions,
  custom: runtimeDirs.serverFunctionsCustom,
  locks: runtimeDirs.serverFunctionsLocks,
  tmp: runtimeDirs.workspaceTemp,
  index: SERVER_FUNCTIONS_INDEX_PATH,
} as const;

function metadataFilePath(metadataFileName: string): string {
  return path.join(functionStoreDirs.custom, metadataFileName);
}

function sourceFilePath(sourceFileName: string): string {
  return path.join(functionStoreDirs.custom, sourceFileName);
}

function makeEmptyIndex(): ManagedFunctionIndex {
  return {
    schema: 'append-server-functions-index',
    schemaVersion: '2.0.0',
    updatedAt: new Date().toISOString(),
    functions: [],
  };
}

/**
 * Cheap cross-process staleness signal for consumers (e.g. ManagedFunctionRouteRegistry)
 * that cache derived state in-memory per-process — an out-of-process writer (an install
 * script, another server instance) bumps this on every index write; the consumer compares
 * against the value it last saw and reloads if it changed, without needing a restart.
 */
export function getManagedFunctionIndexUpdatedAt(): string {
  return readIndex().updatedAt;
}

function readIndex(): ManagedFunctionIndex {
  if (!fs.existsSync(functionStoreDirs.index)) return makeEmptyIndex();
  try {
    const parsed = JSON.parse(fs.readFileSync(functionStoreDirs.index, 'utf8')) as ManagedFunctionIndex;
    return {
      ...makeEmptyIndex(),
      ...parsed,
      functions: Array.isArray(parsed.functions) ? parsed.functions : [],
    };
  } catch {
    return makeEmptyIndex();
  }
}

function writeIndex(index: ManagedFunctionIndex): void {
  index.updatedAt = new Date().toISOString();
  index.schemaVersion = '2.0.0';
  atomicWriteText(functionStoreDirs.index, JSON.stringify(index, null, 2), functionStoreDirs.tmp);
}

function indexEntriesEqual(
  left: ManagedFunctionIndexEntry[],
  right: ManagedFunctionIndexEntry[],
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function persistReconciledIndex(current: ManagedFunctionIndex): ManagedFunctionIndex {
  const reconciled = reconcileIndexFromFiles(current);
  if (!indexEntriesEqual(current.functions, reconciled.functions)) {
    writeIndex(reconciled);
  }
  return reconciled;
}

// In-process cache for the reconciled index. Every list/lookup call used to re-scan and
// re-parse every metadata+source file in the store (reconcileIndexFromFiles), which turned
// every single Server Function invocation into an O(N) synchronous disk scan on the request
// path. The custom/ directory's mtime changes on any add/rename/delete within it, so it's a
// cheap (single stat) signal for "did the on-disk set of functions change since we cached it" —
// content edits to an existing function are still always read fresh at point of use, this only
// caches the *index* (id/path/method/file-name list), not function code.
let reconciledIndexCache: ManagedFunctionIndex | null = null;
let reconciledIndexCacheDirMtimeMs: number | null = null;

function getCustomDirMtimeMs(): number | null {
  try {
    return fs.statSync(functionStoreDirs.custom).mtimeMs;
  } catch {
    return null;
  }
}

function getReconciledIndex(): ManagedFunctionIndex {
  const currentMtime = getCustomDirMtimeMs();
  if (reconciledIndexCache && currentMtime === reconciledIndexCacheDirMtimeMs) {
    return reconciledIndexCache;
  }
  reconciledIndexCache = persistReconciledIndex(readIndex());
  reconciledIndexCacheDirMtimeMs = getCustomDirMtimeMs();
  return reconciledIndexCache;
}

function invalidateReconciledIndexCache(): void {
  reconciledIndexCache = null;
  reconciledIndexCacheDirMtimeMs = null;
}

function readSourceCode(sourceFileName: string): string {
  const filePath = sourceFilePath(sourceFileName);
  if (!fs.existsSync(filePath)) return '';
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function normalizeEngineTypeValue(value: unknown): 'SANDBOX_JS' | 'DATA_API' {
  if (value === 'DATA_API') return 'DATA_API';
  return 'SANDBOX_JS';
}

function normalizeMetadataFile(raw: ManagedFunctionMetadataFile): ManagedFunctionMetadataFile {
  return {
    ...raw,
    engineType: normalizeEngineTypeValue(raw.engineType),
    metadataJson: typeof raw.metadataJson === 'string' ? raw.metadataJson : null,
    accessControl: normalizeFunctionAccessControl(raw.accessControl),
    hooks: normalizeServerFunctionHooks(raw.hooks),
    runtimeVersion: normalizeRuntimeVersion(raw.runtimeVersion),
    useGlobalConfig: readUseGlobalConfig(raw.useGlobalConfig),
    enableLogs: typeof raw.enableLogs === 'boolean' ? raw.enableLogs : true,
  };
}

function readMetadataFile(filePath: string): ManagedFunctionMetadataFile | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as ManagedFunctionMetadataFile;
    return normalizeMetadataFile(parsed);
  } catch {
    return null;
  }
}

function writeMetadataFile(metadata: ManagedFunctionMetadataFile): void {
  atomicWriteText(
    metadataFilePath(buildFunctionMetadataFileName(metadata.folder, metadata.name)),
    JSON.stringify(metadata, null, 2),
    functionStoreDirs.tmp,
  );
}

function writeSourceFile(sourceFileName: string, code: string): void {
  atomicWriteText(sourceFilePath(sourceFileName), code, functionStoreDirs.tmp);
}

function writeManagedFunctionRecord(record: ManagedFunctionRecord): void {
  writeMetadataFile(record.metadata);
  writeSourceFile(record.metadata.sourceFile, record.code);
}

function toApiRow(record: ManagedFunctionRecord): ManagedFunctionApiRow {
  const fn = record.metadata;
  return {
    id: fn.id,
    name: fn.name,
    folder: fn.folder,
    method: fn.method,
    path: fn.path,
    code: record.code,
    language: fn.language,
    test_payload: fn.testPayload,
    runtime_version: fn.runtimeVersion,
    memory_limit: fn.memoryLimit,
    timeout_ms: fn.timeoutMs,
    use_global_config: fn.useGlobalConfig !== false,
    enable_logs: fn.enableLogs !== false,
    cache_enabled: fn.cacheEnabled,
    cache_ttl_ms: fn.cacheTtlMs,
    cache_by_param: fn.cacheByParam,
    cache_by_user: fn.cacheByUser,
    engine_type: fn.engineType,
    metadata_json: fn.metadataJson,
    access_control: normalizeFunctionAccessControl(fn.accessControl),
    hooks: normalizeServerFunctionHooks(fn.hooks),
    created_at: fn.createdAt,
    updated_at: fn.updatedAt,
    created_by: fn.createdBy,
    updated_by: fn.updatedBy,
  };
}

function toRouteRowFromMetadata(metadata: ManagedFunctionMetadataFile): ManagedFunctionApiRow {
  const fn = metadata;
  return {
    id: fn.id,
    name: fn.name,
    folder: fn.folder,
    method: fn.method,
    path: fn.path,
    code: '',
    language: fn.language,
    test_payload: fn.testPayload,
    runtime_version: fn.runtimeVersion,
    memory_limit: fn.memoryLimit,
    timeout_ms: fn.timeoutMs,
    use_global_config: fn.useGlobalConfig !== false,
    enable_logs: fn.enableLogs !== false,
    cache_enabled: fn.cacheEnabled,
    cache_ttl_ms: fn.cacheTtlMs,
    cache_by_param: fn.cacheByParam,
    cache_by_user: fn.cacheByUser,
    engine_type: fn.engineType,
    metadata_json: fn.metadataJson,
    access_control: normalizeFunctionAccessControl(fn.accessControl),
    hooks: normalizeServerFunctionHooks(fn.hooks),
    created_at: fn.createdAt,
    updated_at: fn.updatedAt,
    created_by: fn.createdBy,
    updated_by: fn.updatedBy,
  };
}

function toIndexEntry(record: ManagedFunctionRecord): ManagedFunctionIndexEntry {
  const fn = record.metadata;
  return {
    id: fn.id,
    name: fn.name,
    folder: fn.folder,
    method: fn.method,
    path: fn.path,
    sourceFile: fn.sourceFile,
    metadataFile: buildFunctionMetadataFileName(fn.folder, fn.name),
    createdAt: fn.createdAt,
    updatedAt: fn.updatedAt,
  };
}

function readManagedFunctionRecordFromMetadata(metadata: ManagedFunctionMetadataFile): ManagedFunctionRecord | null {
  const code = readSourceCode(metadata.sourceFile);
  if (!code && !fs.existsSync(sourceFilePath(metadata.sourceFile))) {
    return null;
  }
  return { metadata, code };
}

function readManagedFunctionRecordByMetadataPath(metadataPath: string): ManagedFunctionRecord | null {
  const metadata = readMetadataFile(metadataPath);
  if (!metadata) return null;
  return readManagedFunctionRecordFromMetadata(metadata);
}

function listCustomStoreFileNames(): string[] {
  if (!fs.existsSync(functionStoreDirs.custom)) return [];
  return fs.readdirSync(functionStoreDirs.custom);
}

function reconcileIndexFromFiles(index: ManagedFunctionIndex): ManagedFunctionIndex {
  if (!fs.existsSync(functionStoreDirs.custom)) {
    return { ...index, functions: [] };
  }

  const entries: ManagedFunctionIndexEntry[] = [];
  for (const fileName of listCustomStoreFileNames()) {
    if (!isFunctionMetadataFileName(fileName)) continue;
    const record = readManagedFunctionRecordByMetadataPath(path.join(functionStoreDirs.custom, fileName));
    if (record) entries.push(toIndexEntry(record));
  }

  entries.sort((a, b) => {
    const aTime = a.createdAt ?? '';
    const bTime = b.createdAt ?? '';
    return bTime.localeCompare(aTime);
  });
  return { ...index, functions: entries };
}

function withLock<T>(fn: () => T): T {
  const acquired = acquireRuntimeLock(functionStoreDirs.locks, LOCK_NAME);
  if (!acquired) {
    throw new Error('Edge function store is locked by another process.');
  }
  try {
    return fn();
  } finally {
    releaseRuntimeLock(functionStoreDirs.locks, LOCK_NAME);
  }
}

function findRecordById(functionId: string): ManagedFunctionRecord | null {
  const index = getReconciledIndex();
  const entry = index.functions.find((item) => item.id === functionId);
  if (entry) {
    const fromIndex = readManagedFunctionRecordByMetadataPath(metadataFilePath(entry.metadataFile));
    if (fromIndex) {
      return fromIndex;
    }
  }

  if (!fs.existsSync(functionStoreDirs.custom)) {
    return null;
  }
  for (const fileName of listCustomStoreFileNames()) {
    if (!isFunctionMetadataFileName(fileName)) continue;
    const record = readManagedFunctionRecordByMetadataPath(path.join(functionStoreDirs.custom, fileName));
    if (record?.metadata.id === functionId) {
      return record;
    }
  }
  return null;
}

function deleteManagedFunctionFiles(metadataFile: string, sourceFile: string): void {
  const metadataPath = metadataFilePath(metadataFile);
  const sourcePath = sourceFilePath(sourceFile);
  if (fs.existsSync(metadataPath)) fs.unlinkSync(metadataPath);
  if (fs.existsSync(sourcePath)) fs.unlinkSync(sourcePath);
}

export function ensureFunctionStoreDirs(): void {
  ensureRuntimeDirs([
    functionStoreDirs.root,
    functionStoreDirs.custom,
    functionStoreDirs.locks,
    functionStoreDirs.tmp,
  ]);
  if (!fs.existsSync(functionStoreDirs.index)) {
    writeIndex(makeEmptyIndex());
  }
}

export function cleanupFunctionStoreTmpFiles(): void {
  cleanupRuntimeTmpFiles(functionStoreDirs.tmp);
}

export class DuplicateFunctionPathError extends Error {
  constructor(method: string, fnPath: string) {
    super(`A function with method ${method} and path ${fnPath} already exists.`);
    this.name = 'DuplicateFunctionPathError';
  }
}

export class DuplicateFunctionIdentityError extends Error {
  constructor(folder: string, name: string) {
    super(`A function named "${name}" already exists in folder "${folder}".`);
    this.name = 'DuplicateFunctionIdentityError';
  }
}

// Reads are intentionally NOT wrapped in withLock: the file store is only ever mutated via
// atomic write+rename (readers always see a complete old or new file, never a partial one), so
// serializing reads behind the same non-blocking cross-process lock as writes just meant any
// concurrent read/write pair could hard-fail with "store is locked by another process" for no
// correctness benefit. Only actual mutations (insert/update/delete below) take the lock.
export function listManagedFunctionsFromStore(): ManagedFunctionApiRow[] {
  ensureFunctionStoreDirs();
  const index = getReconciledIndex();

  return index.functions
    .map((entry) => readManagedFunctionRecordByMetadataPath(metadataFilePath(entry.metadataFile)))
    .filter((record): record is ManagedFunctionRecord => record !== null)
    .map(toApiRow)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function listManagedFunctionCatalogFromStore(): ManagedFunctionCatalogRow[] {
  ensureFunctionStoreDirs();
  const index = getReconciledIndex();

  return index.functions.map((entry) => ({
    id: entry.id,
    name: entry.name,
    folder: entry.folder,
    method: entry.method,
    path: entry.path,
  }));
}

export function countManagedFunctionCatalogFromStore(): number {
  ensureFunctionStoreDirs();
  return getReconciledIndex().functions.length;
}

export function listManagedFunctionRouteRowsFromStore(): ManagedFunctionApiRow[] {
  ensureFunctionStoreDirs();
  const index = getReconciledIndex();

  return index.functions
    .map((entry) => readMetadataFile(metadataFilePath(entry.metadataFile)))
    .filter((metadata): metadata is ManagedFunctionMetadataFile => metadata !== null)
    .map(toRouteRowFromMetadata)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function findManagedFunctionByIdFromStore(functionId: string): ManagedFunctionApiRow | null {
  ensureFunctionStoreDirs();
  const record = findRecordById(functionId);
  return record ? toApiRow(record) : null;
}

export function findManagedFunctionIdFromStore(functionId: string): { id: string } | null {
  const fn = findManagedFunctionByIdFromStore(functionId);
  return fn ? { id: fn.id } : null;
}

function assertUniquePath(
  method: string,
  fnPath: string,
  excludeId?: string,
): void {
  const normalizedMethod = method.toUpperCase();
  const index = reconcileIndexFromFiles(readIndex());
  const conflict = index.functions.find(
    (entry) => entry.method.toUpperCase() === normalizedMethod
      && entry.path === fnPath
      && entry.id !== excludeId,
  );
  if (conflict) {
    throw new DuplicateFunctionPathError(normalizedMethod, fnPath);
  }
}

function assertUniqueIdentity(
  folder: string,
  name: string,
  excludeId?: string,
): void {
  const id = buildManagedFunctionId(folder, name);
  const index = reconcileIndexFromFiles(readIndex());
  const conflict = index.functions.find((entry) => entry.id === id && entry.id !== excludeId);
  if (conflict) {
    throw new DuplicateFunctionIdentityError(folder, name);
  }
}

export interface InsertManagedFunctionInput {
  id: string;
  name: string;
  folder: string;
  method: string;
  path: string;
  code: string;
  language: string;
  testPayload: string;
  runtimeVersion: string;
  memoryLimit: number;
  timeoutMs: number;
  useGlobalConfig?: boolean;
  enableLogs?: boolean;
  cacheEnabled: boolean;
  cacheTtlMs: number;
  cacheByParam: boolean;
  cacheByUser: boolean;
  engineType?: 'SANDBOX_JS' | 'DATA_API';
  metadataJson?: string | null;
  accessControl?: FunctionAccessControl;
  hooks?: ServerFunctionHooksConfig;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export function insertManagedFunctionToStore(input: InsertManagedFunctionInput): void {
  withLock(() => {
    ensureFunctionStoreDirs();
    assertUniquePath(input.method, input.path);
    assertUniqueIdentity(input.folder, input.name);

    const now = new Date().toISOString();
    const language = input.language === 'js' ? 'js' : 'ts';
    const sourceFile = buildFunctionSourceFileName(input.folder, input.name, language);
    const metadata: ManagedFunctionMetadataFile = {
      schema: 'append-server-function-metadata',
      schemaVersion: '2.0.0',
      id: buildManagedFunctionId(input.folder, input.name),
      name: input.name,
      folder: input.folder,
      method: input.method.toUpperCase(),
      path: input.path,
      sourceFile,
      language,
      testPayload: input.testPayload,
      runtimeVersion: input.runtimeVersion,
      memoryLimit: input.memoryLimit,
      timeoutMs: input.timeoutMs,
      useGlobalConfig: readUseGlobalConfig(input.useGlobalConfig),
      enableLogs: input.enableLogs !== false,
      cacheEnabled: input.cacheEnabled,
      cacheTtlMs: input.cacheTtlMs,
      cacheByParam: input.cacheByParam,
      cacheByUser: input.cacheByUser,
      engineType: normalizeEngineTypeValue(input.engineType),
      metadataJson: input.metadataJson ?? null,
      accessControl: normalizeFunctionAccessControl(input.accessControl),
      hooks: normalizeServerFunctionHooks(input.hooks),
      createdAt: now,
      updatedAt: now,
      createdBy: input.createdBy ?? null,
      updatedBy: input.updatedBy ?? null,
    };

    writeManagedFunctionRecord({ metadata, code: input.code });

    const index = reconcileIndexFromFiles(readIndex());
    writeIndex(index);
    invalidateReconciledIndexCache();
  });
}

export interface UpdateManagedFunctionInput {
  name: string;
  folder: string;
  method: string;
  path: string;
  code: string;
  language: string;
  testPayload: string;
  runtimeVersion: string;
  memoryLimit: number;
  timeoutMs: number;
  useGlobalConfig?: boolean;
  enableLogs?: boolean;
  cacheEnabled: boolean;
  cacheTtlMs: number;
  cacheByParam: boolean;
  cacheByUser: boolean;
  engineType?: 'SANDBOX_JS' | 'DATA_API';
  metadataJson?: string | null;
  accessControl?: FunctionAccessControl;
  hooks?: ServerFunctionHooksConfig;
  updatedBy?: string | null;
}

export function updateManagedFunctionInStore(
  functionId: string,
  input: UpdateManagedFunctionInput,
): void {
  withLock(() => {
    ensureFunctionStoreDirs();
    const existing = findRecordById(functionId);
    if (!existing) return;

    assertUniquePath(input.method, input.path, functionId);
    assertUniqueIdentity(input.folder, input.name, functionId);

    const language = input.language === 'js' ? 'js' : 'ts';
    const sourceFile = buildFunctionSourceFileName(input.folder, input.name, language);
    const nextId = buildManagedFunctionId(input.folder, input.name);
    const previousMetadataFile = buildFunctionMetadataFileName(existing.metadata.folder, existing.metadata.name);
    const previousSourceFile = existing.metadata.sourceFile;

    const updatedMetadata: ManagedFunctionMetadataFile = {
      ...existing.metadata,
      id: nextId,
      name: input.name,
      folder: input.folder,
      method: input.method.toUpperCase(),
      path: input.path,
      sourceFile,
      language,
      testPayload: input.testPayload,
      runtimeVersion: input.runtimeVersion,
      memoryLimit: input.memoryLimit,
      timeoutMs: input.timeoutMs,
      useGlobalConfig: readUseGlobalConfig(input.useGlobalConfig),
      enableLogs: input.enableLogs !== false,
      cacheEnabled: input.cacheEnabled,
      cacheTtlMs: input.cacheTtlMs,
      cacheByParam: input.cacheByParam,
      cacheByUser: input.cacheByUser,
      engineType: input.engineType !== undefined
        ? normalizeEngineTypeValue(input.engineType)
        : existing.metadata.engineType,
      metadataJson: input.metadataJson !== undefined
        ? input.metadataJson
        : existing.metadata.metadataJson,
      accessControl: input.accessControl !== undefined
        ? normalizeFunctionAccessControl(input.accessControl)
        : normalizeFunctionAccessControl(existing.metadata.accessControl ?? EMPTY_FUNCTION_ACCESS_CONTROL),
      hooks: input.hooks !== undefined
        ? normalizeServerFunctionHooks(input.hooks)
        : normalizeServerFunctionHooks(existing.metadata.hooks),
      updatedAt: new Date().toISOString(),
      updatedBy: input.updatedBy ?? existing.metadata.updatedBy,
    };

    writeManagedFunctionRecord({ metadata: updatedMetadata, code: input.code });

    if (previousMetadataFile !== buildFunctionMetadataFileName(input.folder, input.name)
      || previousSourceFile !== sourceFile) {
      deleteManagedFunctionFiles(previousMetadataFile, previousSourceFile);
    }

    const index = reconcileIndexFromFiles(readIndex());
    writeIndex(index);
    invalidateReconciledIndexCache();
  });
}

export function deleteManagedFunctionFromStore(functionId: string): void {
  withLock(() => {
    ensureFunctionStoreDirs();
    const existing = findRecordById(functionId);
    if (existing) {
      deleteManagedFunctionFiles(
        buildFunctionMetadataFileName(existing.metadata.folder, existing.metadata.name),
        existing.metadata.sourceFile,
      );
    }
    const index = reconcileIndexFromFiles(readIndex());
    writeIndex(index);
    invalidateReconciledIndexCache();
  });
}

export { buildManagedFunctionId } from './functionNaming';
