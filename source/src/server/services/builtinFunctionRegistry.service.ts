import { BUILTIN_AUTHENTICATED_ACCESS_CONTROL, INITIAL_FUNCTIONS } from '../../shared/api/contracts/server-functions/initialFunctions';
import {
  isPublicFunctionAccessControl,
  normalizeFunctionAccessControl,
  parseFunctionAccessControl,
  type FunctionAccessControl,
} from '../../shared/api/contracts/server-functions/accessControl';
import { normalizeServerFunctionHooks } from '../../shared/api/contracts/server-functions/hooks';
import type { ServerFunctionItem } from '../../shared/api/contracts/server-functions/types';
import {
  listBuiltinFunctionMetadata,
  readBuiltinFunctionMetadata,
} from '../../core/functions/BuiltinFunctionMetadataStore';
import { deriveSystemFunctionDisplayName } from '../utils/systemApiRoutes';
import type { BuiltinFunctionMetadataOverride } from '../domain/functions/builtinFunctionTypes';
import {
  builtinRuntimeDefaultsFromCatalog,
  normalizeBuiltinRuntimeFields,
} from '../../core/functions/builtinFunctionRuntimeFields';

export type MergedBuiltinFunctionRecord = ServerFunctionItem & {
  routeKey: string;
};

export type BuiltinFunctionRouteMatch = {
  record: MergedBuiltinFunctionRecord;
  params: Record<string, string>;
};

type BuiltinFunctionRouteEntry = MergedBuiltinFunctionRecord & {
  pathRegex: RegExp;
  paramNames: string[];
};

const normalizeRequestPath = (path: string): string => {
  const withoutQuery = path.split('?')[0] || '/';
  if (withoutQuery.length > 1 && withoutQuery.endsWith('/')) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery;
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const compileRoutePattern = (routePath: string): { pathRegex: RegExp; paramNames: string[] } => {
  const normalizedPath = normalizeRequestPath(routePath);
  const segments = normalizedPath.split('/').filter(Boolean);
  const paramNames: string[] = [];

  const regexBody = segments.map((segment) => {
    if (segment.startsWith(':')) {
      paramNames.push(segment.slice(1));
      return '([^/]+)';
    }
    return escapeRegex(segment);
  }).join('/');

  return {
    pathRegex: new RegExp(`^/${regexBody}/?$`),
    paramNames,
  };
};

const buildRouteKey = (method: string, routePath: string): string => (
  `${method.toUpperCase()} ${normalizeRequestPath(routePath)}`
);

export const mergeBuiltinFunctionDefaults = (
  defaults: ServerFunctionItem,
  override?: BuiltinFunctionMetadataOverride | null,
): MergedBuiltinFunctionRecord => {
  const accessControl = override?.accessControl
    ? normalizeFunctionAccessControl(parseFunctionAccessControl(override.accessControl))
    : normalizeFunctionAccessControl(parseFunctionAccessControl(defaults.accessControl));

  let metadataJson = defaults.metadataJson ?? null;
  if (override?.metadataJson === null) {
    metadataJson = null;
  } else if (typeof override?.metadataJson === 'string' && override.metadataJson.trim()) {
    try {
      metadataJson = JSON.parse(override.metadataJson) as ServerFunctionItem['metadataJson'];
    } catch {
      metadataJson = defaults.metadataJson ?? null;
    }
  }

  return {
    ...defaults,
    accessControl,
    hooks: override?.hooks !== undefined
      ? normalizeServerFunctionHooks(override.hooks)
      : normalizeServerFunctionHooks(defaults.hooks),
    enableLogs: typeof override?.enableLogs === 'boolean'
      ? override.enableLogs
      : defaults.enableLogs,
    testPayload: typeof override?.testPayload === 'string'
      ? override.testPayload
      : defaults.testPayload,
    metadataJson,
    ...normalizeBuiltinRuntimeFields(
      override ?? undefined,
      builtinRuntimeDefaultsFromCatalog(defaults),
    ),
    isBuiltIn: true,
    created_at: override?.createdAt ?? defaults.created_at,
    created_by: override?.createdBy ?? defaults.created_by ?? 'system',
    updated_at: override?.updatedAt ?? defaults.updated_at,
    updated_by: override?.updatedBy ?? defaults.updated_by ?? null,
    routeKey: buildRouteKey(defaults.method, defaults.path),
  };
};

const curatedBuiltIns = INITIAL_FUNCTIONS
  .filter((item) => item.isBuiltIn)
  .map((item) => item as ServerFunctionItem);

const buildMetadataOnlyBuiltin = (
  metadata: NonNullable<ReturnType<typeof readBuiltinFunctionMetadata>>,
): ServerFunctionItem => ({
  id: metadata.id,
  name: deriveSystemFunctionDisplayName(metadata.method, metadata.path),
  folder: metadata.path.split('/').filter(Boolean)[1] || 'system',
  method: metadata.method as ServerFunctionItem['method'],
  path: metadata.path,
  code: '// Discovered built-in route metadata\n',
  language: 'ts',
  testPayload: '{}',
  memoryLimit: 128,
  timeoutMs: 1500,
  runtimeVersion: 'v20.x',
  useGlobalConfig: true,
  enableLogs: metadata.enableLogs ?? true,
  isBuiltIn: true,
  accessControl: metadata.accessControl
    ? normalizeFunctionAccessControl(parseFunctionAccessControl(metadata.accessControl))
    : normalizeFunctionAccessControl(BUILTIN_AUTHENTICATED_ACCESS_CONTROL),
});

const overridesById = (): Map<string, BuiltinFunctionMetadataOverride> => {
  const map = new Map<string, BuiltinFunctionMetadataOverride>();
  for (const item of listBuiltinFunctionMetadata()) {
    map.set(item.id, {
      accessControl: item.accessControl,
      hooks: item.hooks,
      enableLogs: item.enableLogs,
      testPayload: item.testPayload,
      metadataJson: item.metadataJson,
      language: item.language,
      runtimeVersion: item.runtimeVersion,
      memoryLimit: item.memoryLimit,
      timeoutMs: item.timeoutMs,
      useGlobalConfig: item.useGlobalConfig,
      cacheEnabled: item.cacheEnabled,
      cacheTtlMs: item.cacheTtlMs,
      cacheByParam: item.cacheByParam,
      cacheByUser: item.cacheByUser,
      createdAt: item.createdAt,
      createdBy: item.createdBy,
      updatedAt: item.updatedAt,
      updatedBy: item.updatedBy,
    });
  }
  return map;
};

export class BuiltinFunctionRegistry {
  private resolveCache = new Map<string, BuiltinFunctionRouteMatch | null>();

  private entries: BuiltinFunctionRouteEntry[] = [];

  private recordsById = new Map<string, MergedBuiltinFunctionRecord>();

  private loaded = false;

  private loading: Promise<void> | null = null;

  async ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return;
    }
    if (this.entries.length > 0) {
      this.scheduleReload();
      return;
    }
    if (this.loading) {
      await this.loading;
      return;
    }

    this.loading = this.reload().finally(() => {
      this.loading = null;
    });
    await this.loading;
  }

  private scheduleReload(): void {
    if (this.loading) {
      return;
    }
    this.loading = this.reload().finally(() => {
      this.loading = null;
    });
  }

  async reload(): Promise<void> {
    const overrides = overridesById();
    const curatedIds = new Set(curatedBuiltIns.map((item) => item.id));
    const metadataOnlyBuiltIns = listBuiltinFunctionMetadata()
      .filter((item) => !curatedIds.has(item.id) && item.method && item.path)
      .map((item) => buildMetadataOnlyBuiltin(item));

    this.entries = [...curatedBuiltIns, ...metadataOnlyBuiltIns]
      .map((defaults) => mergeBuiltinFunctionDefaults(defaults, overrides.get(defaults.id)))
      .map((record) => {
        const compiled = compileRoutePattern(record.path);
        return {
          ...record,
          ...compiled,
        };
      })
      .sort((left, right) => (right.path.length || 0) - (left.path.length || 0));

    this.recordsById.clear();
    for (const entry of this.entries) {
      this.recordsById.set(entry.id, entry);
    }

    this.resolveCache.clear();
    this.loaded = true;
  }

  invalidate(): void {
    this.loaded = false;
    this.resolveCache.clear();
    this.scheduleReload();
  }

  listMergedRecords(): MergedBuiltinFunctionRecord[] {
    return [...this.recordsById.values()];
  }

  getMergedRecordById(functionId: string): MergedBuiltinFunctionRecord | null {
    return this.recordsById.get(functionId) ?? null;
  }

  getMergedAccessControl(functionId: string): FunctionAccessControl | null {
    return this.recordsById.get(functionId)?.accessControl ?? null;
  }

  isPublicBuiltInRoute(httpMethod: string, requestPath: string): boolean {
    const match = this.resolve(httpMethod, requestPath);
    if (!match) {
      return false;
    }
    return isPublicFunctionAccessControl(match.record.accessControl);
  }

  resolve(httpMethod: string, requestPath: string): BuiltinFunctionRouteMatch | null {
    const normalizedMethod = httpMethod.toUpperCase();
    const normalizedPath = normalizeRequestPath(requestPath);
    const cacheKey = `${normalizedMethod}:${normalizedPath}`;

    if (this.resolveCache.has(cacheKey)) {
      return this.resolveCache.get(cacheKey) ?? null;
    }

    for (const entry of this.entries) {
      if (entry.method.toUpperCase() !== normalizedMethod) {
        continue;
      }

      const match = normalizedPath.match(entry.pathRegex);
      if (!match) {
        continue;
      }

      const params: Record<string, string> = {};
      entry.paramNames.forEach((name, index) => {
        params[name] = decodeURIComponent(match[index + 1] || '');
      });

      const resolved: BuiltinFunctionRouteMatch = {
        record: entry,
        params,
      };
      this.resolveCache.set(cacheKey, resolved);
      return resolved;
    }

    this.resolveCache.set(cacheKey, null);
    return null;
  }
}

export const builtinFunctionRegistry = new BuiltinFunctionRegistry();

export const readBuiltinOverride = (functionId: string) => readBuiltinFunctionMetadata(functionId);
