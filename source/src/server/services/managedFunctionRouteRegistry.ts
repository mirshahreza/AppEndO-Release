import {
  isPublicFunctionAccessControl,
  parseFunctionAccessControl,
  type FunctionAccessControl,
} from '../../shared/api/contracts/server-functions/accessControl';
import {
  parseServerFunctionHooks,
} from '../../shared/api/contracts/server-functions/hooks';
import { listManagedFunctionRouteRows } from '../domain/functions/functionRepository';
import { getManagedFunctionIndexUpdatedAt } from '../../core/functions/FunctionFileStore';
import type { ManagedFunctionExecutionRecord } from './server-function.service';

export type ManagedFunctionRouteMatch = {
  function: ManagedFunctionExecutionRecord;
  params: Record<string, string>;
};

type ManagedFunctionRouteEntry = ManagedFunctionExecutionRecord & {
  pathRegex: RegExp;
  paramNames: string[];
};

const RESERVED_API_PREFIXES = [
  '/api/auth',
  '/api/users',
  '/api/roles',
  '/api/functions',
  '/api/data-sources',
  '/api/db-enrichment',
  '/api/data-api',
  '/api/core',
  '/api/packages',
  '/api/cache',
  '/api/git',
  '/api/logs',
  '/api/hwy/family-household',
  '/api/hwy/org-membership-transfer',
  '/api/hwy/geo-responsibility',
  '/api/hwy/member-rashh-picker',
  '/api/hwy/targhin-requests',
  '/api/hwy/targhin-members',
  '/api/hwy/etl-console',
  '/api/hwy/business-rules',
  '/api/hwy/membership',
  '/api/hwy/member-nakhebin',
  '/api/hwy/member-institutes',
  '/api/record-events',
  '/api/retention',
  '/api/settings',
  '/api/profile',
  '/api/base-info',
  '/api/health',
  '/api/project-standards',
  '/api/ai',
  '/api/component-designer',
  '/api/docs',
  '/api/mcp',
  '/api/platform/web-fonts',
  '/api/cms-site',
  '/api/idea-foundry',
  '/api/workbooks',
];

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

const toManagedFunctionRecord = (row: Record<string, unknown>): ManagedFunctionExecutionRecord => ({
  id: String(row.id || ''),
  name: String(row.name || ''),
  folder: String(row.folder || ''),
  method: String(row.method || 'GET'),
  path: String(row.path || ''),
  code: String(row.code || ''),
  language: typeof row.language === 'string' ? row.language : undefined,
  test_payload: row.test_payload,
  testPayload: typeof row.test_payload === 'string' ? row.test_payload : undefined,
  runtime_version: typeof row.runtime_version === 'string' ? row.runtime_version : undefined,
  runtimeVersion: typeof row.runtime_version === 'string' ? row.runtime_version : undefined,
  memory_limit: typeof row.memory_limit === 'number' ? row.memory_limit : undefined,
  memoryLimit: typeof row.memory_limit === 'number' ? row.memory_limit : undefined,
  use_global_config: row.use_global_config !== false,
  useGlobalConfig: row.use_global_config !== false,
  enable_logs: typeof row.enable_logs === 'boolean' ? row.enable_logs : undefined,
  enableLogs: typeof row.enable_logs === 'boolean' ? row.enable_logs : undefined,
  timeout_ms: typeof row.timeout_ms === 'number' ? row.timeout_ms : undefined,
  timeoutMs: typeof row.timeout_ms === 'number' ? row.timeout_ms : undefined,
  cache_enabled: row.cache_enabled === true,
  cacheEnabled: row.cache_enabled === true,
  cache_ttl_ms: typeof row.cache_ttl_ms === 'number' ? row.cache_ttl_ms : undefined,
  cacheTtlMs: typeof row.cache_ttl_ms === 'number' ? row.cache_ttl_ms : undefined,
  cache_by_param: row.cache_by_param === true,
  cacheByParam: row.cache_by_param === true,
  cache_by_user: row.cache_by_user === true,
  cacheByUser: row.cache_by_user === true,
  engine_type: row.engine_type === 'DATA_API' ? 'DATA_API' : 'SANDBOX_JS',
  engineType: row.engine_type === 'DATA_API' ? 'DATA_API' : 'SANDBOX_JS',
  metadata_json: typeof row.metadata_json === 'string'
    ? row.metadata_json
    : (row.metadata_json === null || row.metadata_json === undefined
      ? null
      : JSON.stringify(row.metadata_json)),
  metadataJson: typeof row.metadata_json === 'string'
    ? (row.metadata_json ? JSON.parse(row.metadata_json) as Record<string, unknown> : null)
    : ((row.metadata_json as Record<string, unknown> | null | undefined) ?? null),
  access_control: parseFunctionAccessControl(row.access_control ?? row.accessControl),
  accessControl: parseFunctionAccessControl(row.access_control ?? row.accessControl),
  hooks: parseServerFunctionHooks(row.hooks),
});

const resolveEntryAccessControl = (entry: ManagedFunctionRouteEntry): FunctionAccessControl => (
  parseFunctionAccessControl(entry.access_control ?? entry.accessControl)
);

export class ManagedFunctionRouteRegistry {
  /** L1 resolve cache: `${METHOD}:${path}` → match or null */
  private resolveCache = new Map<string, ManagedFunctionRouteMatch | null>();

  private entries: ManagedFunctionRouteEntry[] = [];

  private loaded = false;

  private loading: Promise<void> | null = null;

  /** Cross-process staleness signal — see getManagedFunctionIndexUpdatedAt(). */
  private lastSeenIndexUpdatedAt: string | null = null;

  isReservedApiPath(pathname: string): boolean {
    const normalized = normalizeRequestPath(pathname);
    return RESERVED_API_PREFIXES.some((prefix) => (
      normalized === prefix || normalized.startsWith(`${prefix}/`)
    ));
  }

  /**
   * An out-of-process writer (install script, another server instance) can change
   * managed functions on disk without ever touching this process's `loaded`/`resolveCache`
   * state. Cheap check on every ensureLoaded() call so stale routes/definitionIds don't
   * linger until a restart.
   */
  private isIndexStale(): boolean {
    const currentUpdatedAt = getManagedFunctionIndexUpdatedAt();
    return currentUpdatedAt !== this.lastSeenIndexUpdatedAt;
  }

  async ensureLoaded(): Promise<void> {
    if (this.loading) {
      await this.loading;
      return;
    }
    if (this.loaded && !this.isIndexStale()) {
      return;
    }

    this.loading = this.reload().finally(() => {
      this.loading = null;
    });
    await this.loading;
  }

  private scheduleReload(): void {
    if (this.loading || (this.loaded && !this.isIndexStale())) {
      return;
    }
    this.loading = this.reload().finally(() => {
      this.loading = null;
    });
  }

  async reload(): Promise<void> {
    this.lastSeenIndexUpdatedAt = getManagedFunctionIndexUpdatedAt();
    const rows = await listManagedFunctionRouteRows();
    this.entries = rows
      .map((row) => {
        const record = toManagedFunctionRecord(row as unknown as Record<string, unknown>);
        const compiled = compileRoutePattern(record.path || '');
        return {
          ...record,
          ...compiled,
        };
      })
      .sort((left, right) => (right.path?.length || 0) - (left.path?.length || 0));

    this.resolveCache.clear();
    this.loaded = true;
  }

  invalidate(functionId?: string): void {
    this.loaded = false;
    this.resolveCache.clear();
    if (functionId) {
      this.entries = this.entries.filter((entry) => entry.id !== functionId);
    }
    this.scheduleReload();
  }

  isPublicManagedRoute(httpMethod: string, requestPath: string): boolean {
    const match = this.resolve(httpMethod, requestPath);
    if (!match) {
      return false;
    }
    return isPublicFunctionAccessControl(resolveEntryAccessControl(match.function as ManagedFunctionRouteEntry));
  }

  resolve(httpMethod: string, requestPath: string): ManagedFunctionRouteMatch | null {
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
        const value = match[index + 1];
        if (value !== undefined) {
          params[name] = decodeURIComponent(value);
        }
      });

      const resolved: ManagedFunctionRouteMatch = {
        function: entry,
        params,
      };
      this.resolveCache.set(cacheKey, resolved);
      return resolved;
    }

    this.resolveCache.set(cacheKey, null);
    return null;
  }
}

export const managedFunctionRouteRegistry = new ManagedFunctionRouteRegistry();
