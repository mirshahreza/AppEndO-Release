import type { ManagedFunctionApiRow } from '../../server/domain/functions/functionTypes';
import { parseFunctionAccessControl } from '../../shared/api/contracts/server-functions/accessControl';
import { ensureFunctionDerivedMetadata } from '../../shared/api/server-functions/buildFunctionDerivedMetadata';
import { updateManagedFunctionInStore } from '../../core/functions/FunctionFileStore';

export const materializeManagedFunctionDerivedMetadata = (
  row: ManagedFunctionApiRow,
): ManagedFunctionApiRow => {
  const ensured = ensureFunctionDerivedMetadata({
    code: row.code,
    method: row.method,
    path: row.path,
    metadataJson: row.metadata_json,
    testPayload: row.test_payload,
    isBuiltIn: false,
  });

  if (!ensured.changed) {
    return row;
  }

  updateManagedFunctionInStore(row.id, {
    name: row.name,
    folder: row.folder,
    method: row.method,
    path: row.path,
    code: row.code,
    language: row.language,
    testPayload: ensured.testPayload,
    runtimeVersion: row.runtime_version,
    memoryLimit: row.memory_limit,
    timeoutMs: row.timeout_ms,
    cacheEnabled: row.cache_enabled,
    cacheTtlMs: row.cache_ttl_ms,
    cacheByParam: row.cache_by_param,
    cacheByUser: row.cache_by_user,
    engineType: row.engine_type,
    metadataJson: ensured.metadataJson,
    accessControl: parseFunctionAccessControl(row.access_control),
  });

  return {
    ...row,
    test_payload: ensured.testPayload,
    metadata_json: ensured.metadataJson,
  };
};

export const applyDerivedMetadataToManagedFunction = (input: {
  code: string;
  method: string;
  path: string;
  testPayload?: string;
  metadataJson?: string | null;
  isBuiltIn?: boolean;
}): { testPayload: string; metadataJson: string | null } => {
  const ensured = ensureFunctionDerivedMetadata({
    code: input.code,
    method: input.method,
    path: input.path,
    metadataJson: input.metadataJson ?? null,
    testPayload: input.testPayload ?? '{}',
    isBuiltIn: input.isBuiltIn,
  });

  return {
    testPayload: ensured.testPayload,
    metadataJson: ensured.metadataJson,
  };
};
