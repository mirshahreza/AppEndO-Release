import fs from 'fs';
import path from 'path';
import {
  acquireRuntimeLock,
  atomicWriteText,
  ensureRuntimeDirs,
  releaseRuntimeLock,
} from '../../../core/runtime/RuntimeFileStore';
import { runtimeDirs } from '../../../core/runtime/runtimePaths';
import {
  normalizeQuerySurfaceBindingDocument,
  type QuerySurfaceBindingDocument,
} from '../../../shared/api/contracts/data-api';

const LOCK_NAME = 'query-surface-bindings';

const bindingFilePath = (edgeModelId: string): string => (
  path.join(runtimeDirs.querySurfaceBindings, `${edgeModelId}.json`)
);

export const ensureQuerySurfaceBindingStoreDirs = (): void => {
  ensureRuntimeDirs([
    runtimeDirs.querySurfaceBindings,
    runtimeDirs.querySurfaceBindingsLocks,
    runtimeDirs.workspaceTemp,
  ]);
};

export const getQuerySurfaceBinding = (edgeModelId: string): QuerySurfaceBindingDocument | null => {
  ensureQuerySurfaceBindingStoreDirs();
  const filePath = bindingFilePath(edgeModelId);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    const normalized = normalizeQuerySurfaceBindingDocument(parsed);
    return normalized.ok ? normalized.binding : null;
  } catch {
    return null;
  }
};

export const getQuerySurfaceBindingOrDefault = (edgeModelId: string): QuerySurfaceBindingDocument => (
  getQuerySurfaceBinding(edgeModelId) ?? {
    edgeModelId,
    columnWhereGrants: {},
    presetGrants: {},
  }
);

export const deleteQuerySurfaceBinding = (edgeModelId: string): void => {
  ensureQuerySurfaceBindingStoreDirs();
  const filePath = bindingFilePath(edgeModelId);
  if (!fs.existsSync(filePath)) {
    return;
  }
  if (!acquireRuntimeLock(runtimeDirs.querySurfaceBindingsLocks, LOCK_NAME)) {
    throw new Error('Query surface binding store is locked by another process.');
  }
  try {
    fs.unlinkSync(filePath);
  } finally {
    releaseRuntimeLock(runtimeDirs.querySurfaceBindingsLocks, LOCK_NAME);
  }
};

export const saveQuerySurfaceBinding = (input: unknown): QuerySurfaceBindingDocument => {
  ensureQuerySurfaceBindingStoreDirs();
  const normalized = normalizeQuerySurfaceBindingDocument(input);
  if (!normalized.ok) {
    throw new Error(normalized.message);
  }
  const binding = {
    ...normalized.binding,
    updatedAt: new Date().toISOString(),
  };
  if (!acquireRuntimeLock(runtimeDirs.querySurfaceBindingsLocks, LOCK_NAME)) {
    throw new Error('Query surface binding store is locked by another process.');
  }
  try {
    atomicWriteText(
      bindingFilePath(binding.edgeModelId),
      JSON.stringify(binding, null, 2),
      runtimeDirs.workspaceTemp,
    );
    return binding;
  } finally {
    releaseRuntimeLock(runtimeDirs.querySurfaceBindingsLocks, LOCK_NAME);
  }
};
