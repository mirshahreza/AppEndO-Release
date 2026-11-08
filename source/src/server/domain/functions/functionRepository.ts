import {
  buildManagedFunctionId,
  deleteManagedFunctionFromStore,
  DuplicateFunctionIdentityError,
  DuplicateFunctionPathError,
  findManagedFunctionByIdFromStore,
  findManagedFunctionIdFromStore,
  insertManagedFunctionToStore,
  listManagedFunctionCatalogFromStore,
  countManagedFunctionCatalogFromStore,
  listManagedFunctionRouteRowsFromStore,
  listManagedFunctionsFromStore,
  updateManagedFunctionInStore,
  type InsertManagedFunctionInput,
} from '../../../core/functions/FunctionFileStore';
import {
  normalizeFunctionAccessControl,
  type FunctionAccessControl,
} from '../../../shared/api/contracts/server-functions/accessControl';
import {
  normalizeServerFunctionHooks,
  type ServerFunctionHooksConfig,
} from '../../../shared/api/contracts/server-functions/hooks';

export { buildManagedFunctionId, DuplicateFunctionIdentityError, DuplicateFunctionPathError };

export async function listManagedFunctions() {
  return listManagedFunctionsFromStore();
}

export async function listManagedFunctionRouteRows() {
  return listManagedFunctionRouteRowsFromStore();
}

export async function listManagedFunctionCatalogRows() {
  return listManagedFunctionCatalogFromStore();
}

export async function countManagedFunctionCatalogRows() {
  return countManagedFunctionCatalogFromStore();
}

export async function findManagedFunctionById(functionId: string) {
  return findManagedFunctionByIdFromStore(functionId);
}

export async function findManagedFunctionId(functionId: string) {
  return findManagedFunctionIdFromStore(functionId);
}

/**
 * Typed insert path for internal/system callers that already have a well-formed record (as
 * opposed to `insertManagedFunction`'s positional `unknown[]` shape, built for SQL-param-style
 * callers). Used by Workflow's reserved SCHEDULE-start function bootstrap (WFV2-3) — the identity
 * (`id`) actually persisted is `buildManagedFunctionId(folder, name)`, not `input.id` verbatim; see
 * `FunctionFileStore.insertManagedFunctionToStore`.
 */
export async function insertManagedFunctionRecord(input: InsertManagedFunctionInput): Promise<void> {
  insertManagedFunctionToStore(input);
}

export async function insertManagedFunction(params: unknown[]) {
  const [
    id,
    name,
    folder,
    method,
    fnPath,
    code,
    language,
    testPayload,
    runtimeVersion,
    memoryLimit,
    timeoutMs,
    cacheEnabled,
    cacheTtlMs,
    cacheByParam,
    cacheByUser,
    engineType,
    metadataJson,
    accessControl,
    useGlobalConfig,
    enableLogs,
    createdBy,
    hooks,
  ] = params;

  insertManagedFunctionToStore({
    id: String(id),
    name: String(name),
    folder: String(folder),
    method: String(method),
    path: String(fnPath),
    code: String(code),
    language: String(language),
    testPayload: String(testPayload ?? '{}'),
    runtimeVersion: String(runtimeVersion ?? 'v20.x'),
    memoryLimit: Number(memoryLimit ?? 128),
    timeoutMs: Number(timeoutMs ?? 1500),
    cacheEnabled: Boolean(cacheEnabled),
    cacheTtlMs: Number(cacheTtlMs ?? 180000),
    cacheByParam: Boolean(cacheByParam),
    cacheByUser: Boolean(cacheByUser),
    engineType: engineType === 'DATA_API' ? 'DATA_API' : 'SANDBOX_JS',
    metadataJson: metadataJson === null || metadataJson === undefined
      ? null
      : String(metadataJson),
    accessControl: normalizeFunctionAccessControl(accessControl as FunctionAccessControl | undefined),
    hooks: normalizeServerFunctionHooks(hooks as ServerFunctionHooksConfig | undefined),
    useGlobalConfig: useGlobalConfig !== false,
    enableLogs: enableLogs !== false,
    createdBy: typeof createdBy === 'string' ? createdBy : null,
    updatedBy: typeof createdBy === 'string' ? createdBy : null,
  });
}

export async function updateManagedFunction(params: unknown[]) {
  const [
    name,
    folder,
    method,
    fnPath,
    code,
    language,
    testPayload,
    runtimeVersion,
    memoryLimit,
    timeoutMs,
    cacheEnabled,
    cacheTtlMs,
    cacheByParam,
    cacheByUser,
    engineType,
    metadataJson,
    accessControl,
    functionId,
    useGlobalConfig,
    enableLogs,
    updatedBy,
    hooks,
  ] = params;

  updateManagedFunctionInStore(String(functionId), {
    name: String(name),
    folder: String(folder),
    method: String(method),
    path: String(fnPath),
    code: String(code),
    language: String(language),
    testPayload: String(testPayload ?? '{}'),
    runtimeVersion: String(runtimeVersion ?? 'v20.x'),
    memoryLimit: Number(memoryLimit ?? 128),
    timeoutMs: Number(timeoutMs ?? 1500),
    cacheEnabled: Boolean(cacheEnabled),
    cacheTtlMs: Number(cacheTtlMs ?? 180000),
    cacheByParam: Boolean(cacheByParam),
    cacheByUser: Boolean(cacheByUser),
    engineType: engineType === 'DATA_API' ? 'DATA_API' : 'SANDBOX_JS',
    metadataJson: metadataJson === null || metadataJson === undefined
      ? null
      : String(metadataJson),
    accessControl: accessControl === undefined
      ? undefined
      : normalizeFunctionAccessControl(accessControl as FunctionAccessControl | undefined),
    hooks: hooks === undefined
      ? undefined
      : normalizeServerFunctionHooks(hooks as ServerFunctionHooksConfig | undefined),
    useGlobalConfig: useGlobalConfig !== false,
    enableLogs: enableLogs !== false,
    updatedBy: typeof updatedBy === 'string' || updatedBy === null ? updatedBy : undefined,
  });
}

export async function deleteManagedFunction(functionId: string) {
  deleteManagedFunctionFromStore(functionId);
}
