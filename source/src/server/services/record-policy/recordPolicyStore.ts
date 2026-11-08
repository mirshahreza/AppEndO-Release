import fs from 'fs';
import path from 'path';
import {
  acquireRuntimeLock,
  atomicWriteText,
  ensureRuntimeDirs,
  releaseRuntimeLock,
} from '../../../core/runtime/RuntimeFileStore';
import {
  RECORD_POLICIES_INDEX_PATH,
  runtimeDirs,
} from '../../../core/runtime/runtimePaths';
import {
  normalizeRecordPolicyDocument,
  type RecordPolicyDocument,
} from '../../../shared/api/contracts/record-policy';

type PolicyIndex = {
  schema: 'append-record-policies-index';
  schemaVersion: '1.0.0';
  updatedAt: string;
  policies: Array<{ id: string; fileName: string; edgeModelId: string }>;
};

const LOCK_NAME = 'record-policies';

const makeEmptyIndex = (): PolicyIndex => ({
  schema: 'append-record-policies-index',
  schemaVersion: '1.0.0',
  updatedAt: new Date().toISOString(),
  policies: [],
});

const policyFilePath = (fileName: string): string => path.join(runtimeDirs.recordPolicies, fileName);

export const ensureRecordPolicyStoreDirs = (): void => {
  ensureRuntimeDirs([
    runtimeDirs.recordPolicies,
    runtimeDirs.recordPoliciesLocks,
    runtimeDirs.workspaceTemp,
  ]);
};

const readIndex = (): PolicyIndex => {
  if (!fs.existsSync(RECORD_POLICIES_INDEX_PATH)) {
    return makeEmptyIndex();
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(RECORD_POLICIES_INDEX_PATH, 'utf8')) as PolicyIndex;
    return {
      ...makeEmptyIndex(),
      ...parsed,
      policies: Array.isArray(parsed.policies) ? parsed.policies : [],
    };
  } catch {
    return makeEmptyIndex();
  }
};

const writeIndex = (index: PolicyIndex): void => {
  index.updatedAt = new Date().toISOString();
  atomicWriteText(RECORD_POLICIES_INDEX_PATH, JSON.stringify(index, null, 2), runtimeDirs.workspaceTemp);
};

const readPolicyFile = (fileName: string): RecordPolicyDocument | null => {
  const filePath = policyFilePath(fileName);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    const normalized = normalizeRecordPolicyDocument(parsed);
    return normalized.ok ? normalized.policy : null;
  } catch {
    return null;
  }
};

export const listRecordPolicies = (): RecordPolicyDocument[] => {
  ensureRecordPolicyStoreDirs();
  return readIndex().policies
    .map((entry) => readPolicyFile(entry.fileName))
    .filter((policy): policy is RecordPolicyDocument => Boolean(policy));
};

export const listRecordPoliciesForModel = (edgeModelId: string): RecordPolicyDocument[] => (
  listRecordPolicies().filter((policy) => policy.edgeModelId === edgeModelId)
);

/** Policies that participate in runtime scope compilation (enabled only). */
export const listEnabledRecordPoliciesForModel = (edgeModelId: string): RecordPolicyDocument[] => (
  listRecordPoliciesForModel(edgeModelId).filter((policy) => policy.enabled)
);

export const getRecordPolicyById = (id: string): RecordPolicyDocument | null => {
  const entry = readIndex().policies.find((item) => item.id === id);
  if (!entry) {
    return null;
  }
  return readPolicyFile(entry.fileName);
};

const writePolicyDocument = (policy: RecordPolicyDocument): void => {
  const fileName = `${policy.id}.json`;
  atomicWriteText(policyFilePath(fileName), JSON.stringify(policy, null, 2), runtimeDirs.workspaceTemp);
  const index = readIndex();
  const existing = index.policies.find((item) => item.id === policy.id);
  if (existing) {
    existing.fileName = fileName;
    existing.edgeModelId = policy.edgeModelId;
  } else {
    index.policies.push({ id: policy.id, fileName, edgeModelId: policy.edgeModelId });
  }
  writeIndex(index);
};

/** Keep exactly one enabled policy per model when any policies exist. */
export const enforceSingleEnabledPolicyForModel = (
  edgeModelId: string,
  preferredEnabledId?: string | null,
): void => {
  const policies = listRecordPoliciesForModel(edgeModelId);
  if (policies.length === 0) {
    return;
  }
  const enabled = policies.filter((policy) => policy.enabled);
  let targetId = preferredEnabledId ?? null;
  if (targetId && !policies.some((policy) => policy.id === targetId)) {
    targetId = null;
  }
  if (!targetId) {
    if (enabled.length === 1) {
      return;
    }
    targetId = enabled[0]?.id ?? policies[0]!.id;
  }
  for (const policy of policies) {
    const shouldEnable = policy.id === targetId;
    if (policy.enabled === shouldEnable) {
      continue;
    }
    writePolicyDocument({
      ...policy,
      enabled: shouldEnable,
      version: policy.version + 1,
      updatedAt: new Date().toISOString(),
    });
  }
};

export const saveRecordPolicy = (input: unknown): RecordPolicyDocument => {
  ensureRecordPolicyStoreDirs();
  const normalized = normalizeRecordPolicyDocument(input);
  if (!normalized.ok) {
    throw new Error(normalized.message);
  }
  const policy = {
    ...normalized.policy,
    updatedAt: new Date().toISOString(),
  };
  if (!acquireRuntimeLock(runtimeDirs.recordPoliciesLocks, LOCK_NAME)) {
    throw new Error('Record policy store is locked by another process.');
  }
  try {
    writePolicyDocument(policy);
    if (policy.enabled) {
      enforceSingleEnabledPolicyForModel(policy.edgeModelId, policy.id);
    } else {
      const remaining = listRecordPoliciesForModel(policy.edgeModelId);
      if (remaining.length > 0 && remaining.every((item) => !item.enabled)) {
        enforceSingleEnabledPolicyForModel(policy.edgeModelId, remaining[0]!.id);
      }
    }
    return getRecordPolicyById(policy.id) ?? policy;
  } finally {
    releaseRuntimeLock(runtimeDirs.recordPoliciesLocks, LOCK_NAME);
  }
};

export const deleteRecordPolicy = (id: string): boolean => {
  ensureRecordPolicyStoreDirs();
  if (!acquireRuntimeLock(runtimeDirs.recordPoliciesLocks, LOCK_NAME)) {
    throw new Error('Record policy store is locked by another process.');
  }
  try {
    const index = readIndex();
    const entry = index.policies.find((item) => item.id === id);
    if (!entry) {
      return false;
    }
    const filePath = policyFilePath(entry.fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    index.policies = index.policies.filter((item) => item.id !== id);
    writeIndex(index);
    return true;
  } finally {
    releaseRuntimeLock(runtimeDirs.recordPoliciesLocks, LOCK_NAME);
  }
};
