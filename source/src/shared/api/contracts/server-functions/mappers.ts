import { resolveDefaultRouteLoggingEnabled } from '../../../lib/httpMethodLogId';
import { DEFAULT_SERVER_FUNCTION_LANGUAGE, BUILTIN_FUNCTION_PERSISTABLE_KEYS } from './constants';
import { BUILTIN_DEVELOPER_ACCESS_CONTROL, INITIAL_FUNCTIONS } from './initialFunctions';
import { parseFunctionAccessControl } from './accessControl';
import { getActiveSourceLanguage, normalizeFunctionForEditor } from './templates';
import { isCatalogHiddenServerFunction } from './reservedFunctions';
import type { ServerFunctionEngineType, ServerFunctionItem, EdgeRunnerDataSource, ServerFunctionMetadataJson } from './types';
import type { CreateServerFunctionPayload } from './payloads';
import { normalizeCatalogTags } from '../../../lib/catalogTags';

const parseMetadataJson = (value: unknown): ServerFunctionMetadataJson | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    const record = value as ServerFunctionMetadataJson;
    if (record.catalogTags) {
      return { ...record, catalogTags: normalizeCatalogTags(record.catalogTags) };
    }
    return record;
  }

  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    const record = parsed as ServerFunctionMetadataJson;
    if (record.catalogTags) {
      return { ...record, catalogTags: normalizeCatalogTags(record.catalogTags) };
    }
    return record;
  } catch {
    return null;
  }
};

const mapEngineType = (value: unknown): ServerFunctionEngineType => {
  if (value === 'DATA_API') return 'DATA_API';
  return 'SANDBOX_JS';
};

export const buildDefaultTestPayload = (method: ServerFunctionItem['method'], routePath: string) => {
  const normalizedPath = routePath.toLowerCase();

  if (method === 'POST' && normalizedPath === '/api/auth/login') {
    return JSON.stringify({ body: { email: 'admin@append.os', password: 'admin123' } }, null, 2);
  }

  if (method === 'GET' && normalizedPath === '/api/profile') {
    return JSON.stringify({ query: { userId: 1 } }, null, 2);
  }

  if (method === 'PUT' && normalizedPath === '/api/profile') {
    return JSON.stringify({ body: { userId: 1, fullName: 'Admin User', phone: '+989120000000' } }, null, 2);
  }

  if (method === 'GET' && normalizedPath === '/api/users') {
    return JSON.stringify({ query: { limit: 10, page: 1 } }, null, 2);
  }

  if (method === 'POST' && normalizedPath === '/api/users') {
    return JSON.stringify({ body: { email: 'newuser@example.com', password: 'secret123', role: 'DEVELOPER' } }, null, 2);
  }

  if (method === 'PUT' && normalizedPath === '/api/users/:id') {
    return JSON.stringify({ params: { id: '2' }, body: { email: 'updated@example.com', role: 'ADMIN' } }, null, 2);
  }

  if (method === 'PUT' && normalizedPath === '/api/users/:id/profile') {
    return JSON.stringify({ params: { id: '2' }, body: { fullName: 'Updated Profile', nickname: 'U2', genderCode: '100001' } }, null, 2);
  }

  if (method === 'PUT' && normalizedPath === '/api/users/:id/roles') {
    return JSON.stringify({ params: { id: '2' }, body: { roles: ['DEVELOPER', 'ADMIN'] } }, null, 2);
  }

  if (method === 'DELETE' && normalizedPath === '/api/users/:id') {
    return JSON.stringify({ params: { id: '2' } }, null, 2);
  }

  if (method === 'GET' && normalizedPath === '/api/roles') {
    return JSON.stringify({ query: { limit: 10, page: 1 } }, null, 2);
  }

  if (method === 'POST' && normalizedPath === '/api/roles') {
    return JSON.stringify({ body: { name: 'MODERATOR', description: 'Content moderator role' } }, null, 2);
  }

  if (method === 'PUT' && normalizedPath === '/api/roles/:id') {
    return JSON.stringify({ params: { id: '3' }, body: { description: 'Updated description' } }, null, 2);
  }

  if (method === 'DELETE' && normalizedPath === '/api/roles/:id') {
    return JSON.stringify({ params: { id: '3' } }, null, 2);
  }

  const paramMatches: string[] = routePath.match(/:([a-zA-Z0-9_]+)/g) ?? [];
  const params = paramMatches.reduce((acc, token) => {
    const key = token.slice(1);
    acc[key] = key.toLowerCase().includes('id') ? '1' : 'sample';
    return acc;
  }, {} as Record<string, string>);

  const payload: Record<string, unknown> = {};
  if (Object.keys(params).length > 0) {
    payload.params = params;
  }

  if (method === 'GET') {
    payload.query = { limit: 10, page: 1 };
  } else {
    payload.body = { sample: true };
  }

  return JSON.stringify(payload, null, 2);
};

const readAuditString = (value: unknown): string | null | undefined => {
  if (typeof value === 'string') {
    return value;
  }
  if (value === null) {
    return null;
  }
  return undefined;
};

export const mapApiFunction = (item: Record<string, unknown>): ServerFunctionItem => ({
  id: String(item.id),
  name: String(item.name || 'unnamed'),
  folder: String(item.folder || 'general'),
  method: (item.method || 'GET') as ServerFunctionItem['method'],
  path: String(item.path || '/api/unknown'),
  code: String(item.code || ''),
  language: DEFAULT_SERVER_FUNCTION_LANGUAGE,
  testPayload: String(item.test_payload ?? item.testPayload ?? '{}'),
  created_at: readAuditString(item.created_at ?? item.createdAt),
  created_by: readAuditString(item.created_by ?? item.createdBy) ?? null,
  updated_at: readAuditString(item.updated_at ?? item.updatedAt),
  updated_by: readAuditString(item.updated_by ?? item.updatedBy) ?? null,
  memoryLimit: Number(item.memory_limit ?? item.memoryLimit ?? 128),
  timeoutMs: Number(item.timeout_ms ?? item.timeoutMs ?? 1500),
  runtimeVersion: (item.runtime_version ?? item.runtimeVersion ?? 'v20.x') as 'v18.x' | 'v20.x',
  useGlobalConfig: item.use_global_config !== false && item.useGlobalConfig !== false,
  enableLogs: typeof item.enable_logs === 'boolean'
    ? item.enable_logs
    : (typeof item.enableLogs === 'boolean' ? item.enableLogs : true),
  isBuiltIn: false,
  cacheEnabled: Boolean(item.cache_enabled ?? item.cacheEnabled),
  cacheTtlMs: Number(item.cache_ttl_ms ?? item.cacheTtlMs ?? 180000),
  cacheByParam: Boolean(item.cache_by_param ?? item.cacheByParam),
  cacheByUser: Boolean(item.cache_by_user ?? item.cacheByUser),
  engineType: mapEngineType(item.engine_type ?? item.engineType),
  metadataJson: parseMetadataJson(item.metadata_json ?? item.metadataJson),
  accessControl: parseFunctionAccessControl(item.access_control ?? item.accessControl),
});

export const getFallbackBuiltInCode = (
  method: ServerFunctionItem['method'],
  path: string,
): string | undefined => (
  INITIAL_FUNCTIONS.find((item) => item.isBuiltIn && item.method === method && item.path === path)?.code
);

export const mapSystemFunction = (item: Record<string, unknown>): ServerFunctionItem => {
  const method = (item.method || 'GET') as ServerFunctionItem['method'];
  const path = String(item.path || '/api/unknown');
  const fallbackCode = getFallbackBuiltInCode(method, path);

  return {
  id: String(item.id),
  name: String(item.name || 'system-route'),
  folder: String(item.folder || 'system'),
  method,
  path,
  code: String(item.code || fallbackCode || ''),
  language: DEFAULT_SERVER_FUNCTION_LANGUAGE,
  testPayload: String(
    item.testPayload
      ?? item.test_payload
      ?? buildDefaultTestPayload(
        (item.method || 'GET') as ServerFunctionItem['method'],
        String(item.path || '/api/unknown'),
      ),
  ),
  memoryLimit: 128,
  timeoutMs: 1500,
  runtimeVersion: 'v20.x',
  useGlobalConfig: true,
  enableLogs: typeof item.enableLogs === 'boolean'
    ? item.enableLogs
    : (typeof item.enable_logs === 'boolean'
      ? item.enable_logs
      : resolveDefaultRouteLoggingEnabled(path)),
  isBuiltIn: item.isBuiltIn === false ? false : true,
  packageId: typeof item.packageId === 'string' ? item.packageId : undefined,
  packageDisplayName: typeof item.packageDisplayName === 'string' ? item.packageDisplayName : undefined,
  cacheEnabled: false,
  cacheTtlMs: 3600000,
  cacheByParam: false,
  cacheByUser: false,
  accessControl: parseFunctionAccessControl(
    item.accessControl ?? item.access_control ?? BUILTIN_DEVELOPER_ACCESS_CONTROL,
  ),
  metadataJson: parseMetadataJson(item.metadataJson ?? item.metadata_json),
  created_at: readAuditString(item.created_at ?? item.createdAt),
  created_by: readAuditString(item.created_by ?? item.createdBy) ?? null,
  updated_at: readAuditString(item.updated_at ?? item.updatedAt),
  updated_by: readAuditString(item.updated_by ?? item.updatedBy) ?? null,
};
};

const mergeCuratedBuiltInRoute = (
  discovered: ServerFunctionItem,
  curated: ServerFunctionItem,
): ServerFunctionItem => ({
  ...discovered,
  id: curated.id,
  name: curated.name,
  folder: curated.folder,
  code: curated.code,
  testPayload: curated.testPayload,
  memoryLimit: curated.memoryLimit,
  timeoutMs: curated.timeoutMs,
  runtimeVersion: curated.runtimeVersion,
  cacheEnabled: curated.cacheEnabled,
  cacheTtlMs: curated.cacheTtlMs,
  cacheByParam: curated.cacheByParam ?? false,
  cacheByUser: curated.cacheByUser ?? false,
  accessControl: curated.accessControl,
  enableLogs: curated.enableLogs,
  isBuiltIn: true,
  created_at: discovered.created_at ?? curated.created_at,
  created_by: discovered.created_by ?? curated.created_by,
  updated_at: discovered.updated_at ?? curated.updated_at,
  updated_by: discovered.updated_by ?? curated.updated_by,
});

export const mergeFunctionsCatalog = (
  systemItems: ServerFunctionItem[],
  customItems: ServerFunctionItem[],
): ServerFunctionItem[] => {
  const curatedByRoute = new Map<string, ServerFunctionItem>();
  INITIAL_FUNCTIONS.map(normalizeFunctionForEditor).forEach((fn) => {
    curatedByRoute.set(`${fn.method} ${fn.path}`, fn);
  });

  const builtInByRoute = new Map<string, ServerFunctionItem>();
  systemItems.forEach((fn) => {
    const routeKey = `${fn.method} ${fn.path}`;
    const curated = curatedByRoute.get(routeKey);
    builtInByRoute.set(routeKey, curated ? mergeCuratedBuiltInRoute(fn, curated) : fn);
  });

  curatedByRoute.forEach((fn, routeKey) => {
    if (!builtInByRoute.has(routeKey)) {
      builtInByRoute.set(routeKey, fn);
    }
  });

  const customWithoutSupersededRoutes = customItems.filter(
    (fn) => !builtInByRoute.has(`${fn.method} ${fn.path}`) && !isCatalogHiddenServerFunction(fn),
  );
  const merged = [...builtInByRoute.values(), ...customWithoutSupersededRoutes];
  merged.sort((a, b) => {
    const folderCompare = a.folder.localeCompare(b.folder);
    if (folderCompare !== 0) return folderCompare;
    const nameCompare = a.name.localeCompare(b.name);
    if (nameCompare !== 0) return nameCompare;
    return a.method.localeCompare(b.method);
  });

  return merged;
};

export const mapDataSources = (items: unknown[]): EdgeRunnerDataSource[] => (
  items
    .map((raw) => {
      const item = raw as Record<string, unknown>;
      return {
        id: String(item.id || ''),
        name: String(item.name || ''),
        type: String(item.type || ''),
        database: String(item.database || ''),
        isDefault: Boolean(item.isDefault ?? item.is_default),
        status: String(item.status || ''),
      };
    })
    .filter((item) => item.id && item.name)
);

export const buildManagedFunctionPayload = (fn: ServerFunctionItem): CreateServerFunctionPayload => ({
  name: fn.name,
  folder: fn.folder,
  method: fn.method,
  path: fn.path,
  code: fn.code,
  language: getActiveSourceLanguage(fn.language),
  testPayload: fn.testPayload,
  runtimeVersion: fn.runtimeVersion,
  memoryLimit: fn.memoryLimit,
  timeoutMs: fn.timeoutMs,
  useGlobalConfig: fn.useGlobalConfig,
  enableLogs: fn.enableLogs,
  cacheEnabled: fn.cacheEnabled,
  cacheTtlMs: fn.cacheTtlMs,
  cacheByParam: fn.cacheByParam,
  cacheByUser: fn.cacheByUser,
  engineType: fn.engineType ?? 'SANDBOX_JS',
  metadataJson: fn.metadataJson ?? null,
  accessControl: fn.accessControl,
  hooks: fn.hooks,
});

export const buildBuiltinFunctionMetadataPayload = (
  fn: Pick<ServerFunctionItem, typeof BUILTIN_FUNCTION_PERSISTABLE_KEYS[number]>,
) => BUILTIN_FUNCTION_PERSISTABLE_KEYS.reduce<Record<string, unknown>>((acc, key) => {
  const value = fn[key];
  if (value !== undefined) {
    acc[key] = key === 'metadataJson' ? (value ?? null) : value;
  }
  return acc;
}, {});
