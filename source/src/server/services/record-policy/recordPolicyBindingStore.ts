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
  normalizeRecordPolicyBindingDocument,
  type RecordPolicyBindingDocument,
} from '../../../shared/api/contracts/record-policy';

const LOCK_NAME = 'record-policy-bindings';

const bindingFilePath = (edgeModelId: string): string => (
  path.join(runtimeDirs.recordPolicyBindings, `${edgeModelId}.json`)
);

export const ensureRecordPolicyBindingStoreDirs = (): void => {
  ensureRuntimeDirs([
    runtimeDirs.recordPolicyBindings,
    runtimeDirs.recordPolicyBindingsLocks,
    runtimeDirs.workspaceTemp,
  ]);
};

export const getRecordPolicyBinding = (edgeModelId: string): RecordPolicyBindingDocument | null => {
  ensureRecordPolicyBindingStoreDirs();
  const filePath = bindingFilePath(edgeModelId);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    const normalized = normalizeRecordPolicyBindingDocument(parsed);
    return normalized.ok ? normalized.binding : null;
  } catch {
    return null;
  }
};

/** Default binding when no sidecar exists — recordScope off. */
export const getRecordPolicyBindingOrDefault = (edgeModelId: string): RecordPolicyBindingDocument => (
  getRecordPolicyBinding(edgeModelId) ?? {
    edgeModelId,
    recordScope: 'off',
    forceScopeForAdmin: false,
    bindings: [],
    allowedUserAttrKeys: [],
  }
);

export const saveRecordPolicyBinding = (input: unknown): RecordPolicyBindingDocument => {
  ensureRecordPolicyBindingStoreDirs();
  const normalized = normalizeRecordPolicyBindingDocument(input);
  if (!normalized.ok) {
    throw new Error(normalized.message);
  }
  const binding = {
    ...normalized.binding,
    updatedAt: new Date().toISOString(),
  };
  if (!acquireRuntimeLock(runtimeDirs.recordPolicyBindingsLocks, LOCK_NAME)) {
    throw new Error('Record policy binding store is locked by another process.');
  }
  try {
    atomicWriteText(
      bindingFilePath(binding.edgeModelId),
      JSON.stringify(binding, null, 2),
      runtimeDirs.workspaceTemp,
    );
    return binding;
  } finally {
    releaseRuntimeLock(runtimeDirs.recordPolicyBindingsLocks, LOCK_NAME);
  }
};

export const deleteRecordPolicyBinding = (edgeModelId: string): boolean => {
  ensureRecordPolicyBindingStoreDirs();
  const filePath = bindingFilePath(edgeModelId);
  if (!fs.existsSync(filePath)) {
    return false;
  }
  if (!acquireRuntimeLock(runtimeDirs.recordPolicyBindingsLocks, LOCK_NAME)) {
    throw new Error('Record policy binding store is locked by another process.');
  }
  try {
    fs.unlinkSync(filePath);
    return true;
  } finally {
    releaseRuntimeLock(runtimeDirs.recordPolicyBindingsLocks, LOCK_NAME);
  }
};
