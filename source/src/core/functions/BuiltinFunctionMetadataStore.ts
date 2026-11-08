/**
 * BuiltinFunctionMetadataStore — persisted overrides for built-in server function routes.
 * Layout: workspace/server-functions/builtin/{functionId}.metadata.json
 */

import fs from 'fs';
import path from 'path';
import {
  acquireRuntimeLock,
  atomicWriteText,
  cleanupRuntimeTmpFiles,
  ensureRuntimeDirs,
  releaseRuntimeLock,
} from '../runtime/RuntimeFileStore';
import { runtimeDirs } from '../runtime/runtimePaths';
import type { BuiltinFunctionMetadataFile } from '../../server/domain/functions/builtinFunctionTypes';
import {
  normalizeFunctionAccessControl,
  parseFunctionAccessControl,
} from '../../shared/api/contracts/server-functions/accessControl';
import { normalizeServerFunctionHooks } from '../../shared/api/contracts/server-functions/hooks';
import {
  clampMemoryLimitMb,
  clampTimeoutMs,
  normalizeRuntimeVersion,
  normalizeServerFunctionLanguage,
  readUseGlobalConfig,
} from '../../shared/server-functions/runtimeConfig';
import { normalizeManagedFunctionCacheFields } from './managedFunctionPayload';

const LOCK_NAME = 'server-functions-builtin';

export const builtinFunctionStoreDirs = {
  root: runtimeDirs.serverFunctionsBuiltin,
  locks: runtimeDirs.serverFunctionsLocks,
  tmp: runtimeDirs.workspaceTemp,
} as const;

const metadataFilePath = (functionId: string): string => (
  path.join(builtinFunctionStoreDirs.root, `${functionId}.metadata.json`)
);

function makeEmptyMetadata(
  functionId: string,
  method: string,
  routePath: string,
): BuiltinFunctionMetadataFile {
  const now = new Date().toISOString();
  return {
    schema: 'append-builtin-function-metadata',
    schemaVersion: '1.0.0',
    id: functionId,
    method,
    path: routePath,
    createdAt: now,
    createdBy: null,
    updatedAt: now,
    updatedBy: null,
  };
}

export function ensureBuiltinFunctionStoreDirs(): void {
  ensureRuntimeDirs([
    builtinFunctionStoreDirs.root,
    builtinFunctionStoreDirs.locks,
    builtinFunctionStoreDirs.tmp,
  ]);
}

export function cleanupBuiltinFunctionStoreTmpFiles(): void {
  cleanupRuntimeTmpFiles(builtinFunctionStoreDirs.tmp);
}

const normalizeMetadataFile = (
  parsed: Partial<BuiltinFunctionMetadataFile>,
  functionId: string,
): BuiltinFunctionMetadataFile => {
  const cacheFields = (
    parsed.cacheEnabled !== undefined
    || parsed.cacheTtlMs !== undefined
    || parsed.cacheByParam !== undefined
    || parsed.cacheByUser !== undefined
  )
    ? normalizeManagedFunctionCacheFields(parsed)
    : null;

  return {
    ...makeEmptyMetadata(functionId, String(parsed.method || 'GET'), String(parsed.path || '')),
    ...parsed,
    id: functionId,
    accessControl: parsed.accessControl
      ? normalizeFunctionAccessControl(parseFunctionAccessControl(parsed.accessControl))
      : undefined,
    hooks: parsed.hooks !== undefined ? normalizeServerFunctionHooks(parsed.hooks) : undefined,
    enableLogs: typeof parsed.enableLogs === 'boolean' ? parsed.enableLogs : undefined,
    testPayload: typeof parsed.testPayload === 'string' ? parsed.testPayload : undefined,
    metadataJson: parsed.metadataJson === null || typeof parsed.metadataJson === 'string'
      ? parsed.metadataJson
      : undefined,
    language: parsed.language !== undefined
      ? normalizeServerFunctionLanguage(parsed.language)
      : undefined,
    runtimeVersion: parsed.runtimeVersion !== undefined
      ? normalizeRuntimeVersion(parsed.runtimeVersion)
      : undefined,
    memoryLimit: parsed.memoryLimit !== undefined
      ? clampMemoryLimitMb(parsed.memoryLimit)
      : undefined,
    timeoutMs: parsed.timeoutMs !== undefined
      ? clampTimeoutMs(parsed.timeoutMs)
      : undefined,
    useGlobalConfig: parsed.useGlobalConfig !== undefined
      ? readUseGlobalConfig(parsed.useGlobalConfig)
      : undefined,
    cacheEnabled: cacheFields?.cacheEnabled,
    cacheTtlMs: cacheFields?.cacheTtlMs,
    cacheByParam: cacheFields?.cacheByParam,
    cacheByUser: cacheFields?.cacheByUser,
    createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : new Date().toISOString(),
    createdBy: typeof parsed.createdBy === 'string' ? parsed.createdBy : null,
    updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    updatedBy: typeof parsed.updatedBy === 'string' ? parsed.updatedBy : null,
  };
};

export function readBuiltinFunctionMetadata(functionId: string): BuiltinFunctionMetadataFile | null {
  const filePath = metadataFilePath(functionId);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<BuiltinFunctionMetadataFile>;
    return normalizeMetadataFile(parsed, functionId);
  } catch {
    return null;
  }
}

export function listBuiltinFunctionMetadata(): BuiltinFunctionMetadataFile[] {
  ensureBuiltinFunctionStoreDirs();
  if (!fs.existsSync(builtinFunctionStoreDirs.root)) {
    return [];
  }

  return fs.readdirSync(builtinFunctionStoreDirs.root)
    .filter((fileName) => fileName.endsWith('.metadata.json'))
    .map((fileName) => {
      const functionId = fileName.replace(/\.metadata\.json$/, '');
      return readBuiltinFunctionMetadata(functionId);
    })
    .filter((item): item is BuiltinFunctionMetadataFile => item !== null);
}

export function writeBuiltinFunctionMetadata(
  functionId: string,
  method: string,
  routePath: string,
  patch: Partial<BuiltinFunctionMetadataFile>,
  updatedBy: string | null,
): BuiltinFunctionMetadataFile {
  ensureBuiltinFunctionStoreDirs();
  const lockPath = acquireRuntimeLock(builtinFunctionStoreDirs.locks, LOCK_NAME);

  try {
    const existing = readBuiltinFunctionMetadata(functionId);
    const base = existing || makeEmptyMetadata(functionId, method, routePath);
    const next: BuiltinFunctionMetadataFile = normalizeMetadataFile({
      ...base,
      ...patch,
      id: functionId,
      method,
      path: routePath,
      createdAt: base.createdAt,
      createdBy: base.createdBy,
      updatedAt: new Date().toISOString(),
      updatedBy,
    }, functionId);

    atomicWriteText(
      metadataFilePath(functionId),
      `${JSON.stringify(next, null, 2)}\n`,
      builtinFunctionStoreDirs.tmp,
    );

    return next;
  } finally {
    releaseRuntimeLock(lockPath);
  }
}

export function deleteBuiltinFunctionMetadata(functionId: string): void {
  const filePath = metadataFilePath(functionId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
