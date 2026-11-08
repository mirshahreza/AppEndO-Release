import {
  mergeManagedFunctionCacheFields,
  normalizeManagedFunctionCacheFields,
} from '../../core/functions/managedFunctionPayload';
import type {
  ServerFunctionEngineType,
} from '../../shared/api/contracts/server-functions/types';
import {
  normalizeFunctionAccessControl,
  parseFunctionAccessControl,
  type FunctionAccessControl,
} from '../../shared/api/contracts/server-functions/accessControl';
import {
  normalizeServerFunctionHooks,
  parseServerFunctionHooks,
  type ServerFunctionHooksConfig,
} from '../../shared/api/contracts/server-functions/hooks';
import { isCatalogHiddenServerFunction } from '../../shared/api/contracts/server-functions/reservedFunctions';
import {
  buildManagedFunctionId,
  deleteManagedFunction,
  DuplicateFunctionIdentityError,
  DuplicateFunctionPathError,
  findManagedFunctionById,
  findManagedFunctionId,
  insertManagedFunction,
  listManagedFunctions,
  updateManagedFunction,
} from '../domain/functions/functionRepository';
import { HttpError } from '../errors/HttpError';
import type { RequestDbContext } from '../types/requestContext';
import type { SystemFunctionRoute } from '../utils/systemApiRoutes';
import { invalidateSandboxCompileCache } from '../../core/api/sandboxCompileCache';
import { refreshOpenApiDocumentationCaches } from './openApiDocRefresh';
import { applyDerivedMetadataToManagedFunction, materializeManagedFunctionDerivedMetadata } from './functionDerivedMetadata.service';
import { readRouteLoggingEnabled } from '../utils/methodLogConfig';
import { logger } from '../../core/logging/Logger';
import { toHttpMethodLogId } from '../../shared/lib/httpMethodLogId';
import { readUseGlobalConfig } from '../../shared/server-functions/runtimeConfig';
import {
  clampMemoryLimitMb,
  clampTimeoutMs,
  normalizeRuntimeVersion,
  normalizeServerFunctionLanguage,
} from '../../shared/server-functions/runtimeConfig';
import { saveAppLoggingMethodConfigs } from './settings/appSettings.service';
import { INITIAL_FUNCTIONS } from '../../shared/api/contracts/server-functions/initialFunctions';
import { writeBuiltinFunctionMetadata } from '../../core/functions/BuiltinFunctionMetadataStore';
import { listInstalledPackageApiRoutes, resolvePackageApiCatalogEntry, updateInstalledPackageApiHandler } from './package-runtime/packageApiCatalog.service';
import { buildListSystemCatalogItems } from './serverFunctionsCatalog.service';
import { builtinFunctionRegistry } from './builtinFunctionRegistry.service';
import type { UpdateBuiltinFunctionMetadataPayload } from '../domain/functions/builtinFunctionTypes';
import type { BuiltinFunctionMetadataFile } from '../domain/functions/builtinFunctionTypes';
import { managedFunctionRouteRegistry } from './managedFunctionRouteRegistry';
import { deleteOwnedEdgeApiForManagedFunction } from './data-api/edgeCapabilityDeleteCleanup';
import { listUnusedServerFunctions } from './server-functions/serverFunctionStaticUsage.service';

const DEFAULT_ENGINE_TYPE: ServerFunctionEngineType = 'SANDBOX_JS';

const resolveManagedFunctionLoggingFields = (payload: Record<string, unknown>) => ({
  useGlobalConfig: readUseGlobalConfig(payload.useGlobalConfig ?? payload.use_global_config),
  enableLogs: typeof payload.enableLogs === 'boolean'
    ? payload.enableLogs
    : (typeof payload.enable_logs === 'boolean' ? payload.enable_logs : undefined),
});

const syncManagedFunctionRouteLogging = async (
  method: string,
  fnPath: string,
  enableLogs: boolean | undefined,
) => {
  if (typeof enableLogs !== 'boolean') {
    return;
  }

  const logId = toHttpMethodLogId(method, fnPath);
  const currentConfigs = logger.getMethodConfigs() as Record<string, unknown>;
  await saveAppLoggingMethodConfigs(null, {
    ...currentConfigs,
    [logId]: {
      ...(asRecord(currentConfigs[logId]) || {}),
      enabled: enableLogs,
    },
  });
};

const invalidateManagedFunctionCompileCache = (row: {
  code?: string | null;
  language?: string | null;
  runtime_version?: string | null;
}) => {
  if (!row.code?.trim()) {
    return;
  }
  invalidateSandboxCompileCache(
    row.code,
    normalizeServerFunctionLanguage(row.language),
    normalizeRuntimeVersion(row.runtime_version ?? 'v20.x'),
  );
};

const normalizeEngineType = (value: unknown): ServerFunctionEngineType => (
  value === 'DATA_API' ? 'DATA_API' : DEFAULT_ENGINE_TYPE
);

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const parseMetadataObject = (value: unknown): Record<string, unknown> | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    try {
      return asRecord(JSON.parse(trimmed));
    } catch {
      throw new HttpError(400, 'metadata_json must be valid JSON.');
    }
  }
  return asRecord(value);
};

const serializeMetadataJson = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const record = parseMetadataObject(value);
  if (!record) {
    return null;
  }

  return JSON.stringify(record);
};

const resolveAccessControl = (
  payload: Record<string, unknown>,
  existing?: Record<string, unknown>,
): FunctionAccessControl => {
  if (payload.accessControl !== undefined) {
    return normalizeFunctionAccessControl(parseFunctionAccessControl(payload.accessControl));
  }

  if (existing) {
    return parseFunctionAccessControl(existing.access_control ?? existing.accessControl);
  }

  return normalizeFunctionAccessControl(undefined);
};

const resolveHooks = (
  payload: Record<string, unknown>,
  existing?: Record<string, unknown>,
): ServerFunctionHooksConfig => {
  if (payload.hooks !== undefined) {
    return normalizeServerFunctionHooks(parseServerFunctionHooks(payload.hooks));
  }

  if (existing) {
    return parseServerFunctionHooks(existing.hooks);
  }

  return normalizeServerFunctionHooks(undefined);
};

const resolveMetadataJson = (
  payload: Record<string, unknown>,
  existing?: Record<string, unknown>,
): string | null => {
  if ('metadata_json' in payload || 'metadataJson' in payload) {
    return serializeMetadataJson(payload.metadata_json ?? payload.metadataJson);
  }

  const existingValue = existing?.metadata_json ?? existing?.metadataJson;
  if (existingValue === null || existingValue === undefined) {
    return null;
  }

  return typeof existingValue === 'string'
    ? existingValue
    : JSON.stringify(existingValue);
};

const resolveEngineType = (
  payload: Record<string, unknown>,
  existing?: Record<string, unknown>,
): ServerFunctionEngineType => {
  if ('engine_type' in payload || 'engineType' in payload) {
    return normalizeEngineType(payload.engine_type ?? payload.engineType);
  }

  return normalizeEngineType(existing?.engine_type ?? existing?.engineType);
};

const curatedBuiltInById = new Map(
  INITIAL_FUNCTIONS
    .filter((item) => item.isBuiltIn)
    .map((item) => [item.id, item]),
);

const serializeBuiltinMetadataJson = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    return value.trim() ? value : null;
  }
  return JSON.stringify(value);
};

const resolveBuiltinMetadataPatch = (
  payload: UpdateBuiltinFunctionMetadataPayload,
): Partial<BuiltinFunctionMetadataFile> => {
  const patch: Partial<BuiltinFunctionMetadataFile> = {};

  if (payload.accessControl !== undefined) {
    patch.accessControl = resolveAccessControl({ accessControl: payload.accessControl });
  }
  if (payload.hooks !== undefined) {
    patch.hooks = normalizeServerFunctionHooks(payload.hooks);
  }
  if (payload.enableLogs !== undefined) {
    patch.enableLogs = payload.enableLogs;
  }
  if (payload.testPayload !== undefined) {
    patch.testPayload = payload.testPayload;
  }
  if (payload.metadataJson !== undefined) {
    patch.metadataJson = serializeBuiltinMetadataJson(payload.metadataJson);
  }
  if (payload.language !== undefined) {
    patch.language = normalizeServerFunctionLanguage(payload.language);
  }
  if (payload.runtimeVersion !== undefined) {
    patch.runtimeVersion = normalizeRuntimeVersion(payload.runtimeVersion);
  }
  if (payload.memoryLimit !== undefined) {
    patch.memoryLimit = clampMemoryLimitMb(payload.memoryLimit);
  }
  if (payload.timeoutMs !== undefined) {
    patch.timeoutMs = clampTimeoutMs(payload.timeoutMs);
  }
  if (payload.useGlobalConfig !== undefined) {
    patch.useGlobalConfig = readUseGlobalConfig(payload.useGlobalConfig);
  }

  const hasCachePatch = payload.cacheEnabled !== undefined
    || payload.cacheTtlMs !== undefined
    || payload.cacheByParam !== undefined
    || payload.cacheByUser !== undefined;
  if (hasCachePatch) {
    const cache = normalizeManagedFunctionCacheFields(payload);
    patch.cacheEnabled = cache.cacheEnabled;
    patch.cacheTtlMs = cache.cacheTtlMs;
    patch.cacheByParam = cache.cacheByParam;
    patch.cacheByUser = cache.cacheByUser;
  }

  return patch;
};

export type FunctionsServiceDeps = {
  discoverSystemRoutes: () => Promise<SystemFunctionRoute[]>;
};

export class FunctionsService {
  constructor(private readonly deps: FunctionsServiceDeps) {}

  async list(_ctx: RequestDbContext) {
    const items = (await listManagedFunctions())
      .map(materializeManagedFunctionDerivedMetadata)
      .filter((item) => !isCatalogHiddenServerFunction({ id: String(item.id) }));
    return {
      body: {
        success: true as const,
        items: items.map((item) => ({
          ...item,
          enable_logs: typeof item.enable_logs === 'boolean'
            ? item.enable_logs
            : readRouteLoggingEnabled(item.method, item.path),
        })),
      },
    };
  }

  async listSystem() {
    const items = await buildListSystemCatalogItems(this.deps);

    return {
      body: {
        success: true as const,
        items,
      },
    };
  }

  async create(_ctx: RequestDbContext, payload: Record<string, unknown>, actorEmail: string | null = null) {
    const {
      name,
      folder,
      method,
      path: fnPath,
      code,
      language = 'ts',
      testPayload = '{}',
      runtimeVersion = 'v20.x',
      memoryLimit = 128,
      timeoutMs = 1500,
    } = payload;

    const cachePolicy = normalizeManagedFunctionCacheFields({
      cacheEnabled: payload.cacheEnabled as boolean | undefined,
      cacheTtlMs: payload.cacheTtlMs as number | undefined,
      cacheByParam: payload.cacheByParam as boolean | undefined,
      cacheByUser: payload.cacheByUser as boolean | undefined,
    });
    const loggingFields = resolveManagedFunctionLoggingFields(payload);
    const engineType = resolveEngineType(payload);
    const metadataJson = resolveMetadataJson(payload);
    const accessControl = resolveAccessControl(payload);
    const hooks = resolveHooks(payload);
    const derivedFields = applyDerivedMetadataToManagedFunction({
      code: String(code ?? ''),
      method: String(method ?? 'GET'),
      path: String(fnPath ?? ''),
      testPayload: String(testPayload ?? '{}'),
      metadataJson,
    });

    if (!name || !folder || !method || !fnPath || !code) {
      throw new HttpError(400, 'name, folder, method, path and code are required.');
    }

    const id = buildManagedFunctionId(String(folder), String(name));
    try {
      await insertManagedFunction([
        id,
        name,
        folder,
        method,
        fnPath,
        code,
        language === 'js' ? 'js' : 'ts',
        derivedFields.testPayload,
        runtimeVersion,
        memoryLimit,
        timeoutMs,
        cachePolicy.cacheEnabled,
        cachePolicy.cacheTtlMs,
        cachePolicy.cacheByParam,
        cachePolicy.cacheByUser,
        engineType,
        derivedFields.metadataJson,
        accessControl,
        loggingFields.useGlobalConfig,
        loggingFields.enableLogs ?? true,
        actorEmail,
        hooks,
      ]);
    } catch (error) {
      if (error instanceof DuplicateFunctionPathError || error instanceof DuplicateFunctionIdentityError) {
        throw new HttpError(409, error.message);
      }
      throw error;
    }

    await syncManagedFunctionRouteLogging(
      String(method),
      String(fnPath),
      loggingFields.enableLogs ?? true,
    );

    refreshOpenApiDocumentationCaches();
    invalidateManagedFunctionCompileCache({
      code: String(code),
      language: language === 'js' ? 'js' : 'ts',
      runtime_version: runtimeVersion,
    });

    return {
      statusCode: 201,
      body: { success: true as const, id },
    };
  }

  async update(
    _ctx: RequestDbContext,
    functionId: string,
    payload: Record<string, unknown>,
    actorEmail: string | null = null,
  ) {
    const existing = await findManagedFunctionById(functionId);
    if (!existing) {
      throw new HttpError(404, 'Function not found.');
    }

    const cachePolicy = mergeManagedFunctionCacheFields(payload, existing as unknown as Record<string, unknown>);
    const loggingFields = resolveManagedFunctionLoggingFields({
      ...(existing as unknown as Record<string, unknown>),
      ...payload,
    });
    const engineType = resolveEngineType(payload, existing as unknown as Record<string, unknown>);
    const metadataJson = resolveMetadataJson(payload, existing as unknown as Record<string, unknown>);
    const accessControl = resolveAccessControl(payload, existing as unknown as Record<string, unknown>);
    const hooks = resolveHooks(payload, existing as unknown as Record<string, unknown>);
    const nextCode = String(payload.code || existing.code);
    const nextMethod = String(payload.method || existing.method);
    const nextPath = String(payload.path || existing.path);
    const derivedFields = applyDerivedMetadataToManagedFunction({
      code: nextCode,
      method: nextMethod,
      path: nextPath,
      testPayload: String(payload.testPayload ?? existing.test_payload),
      metadataJson,
    });
    try {
      await updateManagedFunction([
        payload.name || existing.name,
        payload.folder || existing.folder,
        payload.method || existing.method,
        payload.path || existing.path,
        payload.code || existing.code,
        payload.language === 'js' ? 'js' : payload.language === 'ts' ? 'ts' : existing.language,
        derivedFields.testPayload,
        payload.runtimeVersion || existing.runtime_version,
        payload.memoryLimit ?? existing.memory_limit,
        payload.timeoutMs ?? existing.timeout_ms,
        cachePolicy.cacheEnabled,
        cachePolicy.cacheTtlMs,
        cachePolicy.cacheByParam,
        cachePolicy.cacheByUser,
        engineType,
        derivedFields.metadataJson,
        accessControl,
        functionId,
        loggingFields.useGlobalConfig,
        typeof loggingFields.enableLogs === 'boolean'
          ? loggingFields.enableLogs
          : existing.enable_logs !== false,
        actorEmail,
        hooks,
      ]);
    } catch (error) {
      if (error instanceof DuplicateFunctionPathError || error instanceof DuplicateFunctionIdentityError) {
        throw new HttpError(409, error.message);
      }
      throw error;
    }

    await syncManagedFunctionRouteLogging(
      nextMethod,
      nextPath,
      typeof loggingFields.enableLogs === 'boolean' ? loggingFields.enableLogs : undefined,
    );

    refreshOpenApiDocumentationCaches(functionId);
    invalidateManagedFunctionCompileCache(existing);
    if (nextCode !== existing.code) {
      invalidateManagedFunctionCompileCache({
        code: nextCode,
        language: payload.language === 'js' ? 'js' : payload.language === 'ts' ? 'ts' : existing.language,
        runtime_version: String(payload.runtimeVersion || existing.runtime_version),
      });
    }

    return { body: { success: true as const } };
  }

  async updateBuiltIn(
    _ctx: RequestDbContext,
    functionId: string,
    payload: UpdateBuiltinFunctionMetadataPayload,
    actorEmail: string | null,
  ) {
    const defaults = curatedBuiltInById.get(functionId);
    if (!defaults) {
      throw new HttpError(404, 'Built-in function not found in catalog.');
    }

    const patch = resolveBuiltinMetadataPatch(payload);

    writeBuiltinFunctionMetadata(
      functionId,
      defaults.method,
      defaults.path,
      patch,
      actorEmail,
    );

    if (typeof payload.enableLogs === 'boolean') {
      await syncManagedFunctionRouteLogging(defaults.method, defaults.path, payload.enableLogs);
    }

    refreshOpenApiDocumentationCaches(functionId, { includeBuiltinRegistry: true });

    return { body: { success: true as const } };
  }

  async updatePackage(_ctx: RequestDbContext, catalogId: string, payload: Record<string, unknown>) {
    const resolved = resolvePackageApiCatalogEntry(catalogId);
    if (!resolved) {
      throw new HttpError(404, 'Package API not found or package is not enabled.');
    }

    const code = payload.code;
    if (typeof code !== 'string' || !code.trim()) {
      throw new HttpError(400, 'code is required.');
    }

    const result = updateInstalledPackageApiHandler(catalogId, code);
    if (!result.ok) {
      throw new HttpError(404, result.error);
    }

    refreshOpenApiDocumentationCaches(catalogId);

    return { body: { success: true as const } };
  }

  async listUnused() {
    return { body: { success: true as const, functions: await listUnusedServerFunctions() } };
  }

  async remove(_ctx: RequestDbContext, functionId: string) {
    const existing = await findManagedFunctionById(functionId);
    if (!existing) {
      throw new HttpError(404, 'Function not found.');
    }
    invalidateManagedFunctionCompileCache(existing);

    const cascadedEdgeApi = deleteOwnedEdgeApiForManagedFunction({
      engineType: existing.engine_type,
      metadataJson: existing.metadata_json,
    });
    if (!cascadedEdgeApi) {
      await deleteManagedFunction(functionId);
    }

    managedFunctionRouteRegistry.invalidate(functionId);
    refreshOpenApiDocumentationCaches(functionId);
    return { body: { success: true as const } };
  }
}
