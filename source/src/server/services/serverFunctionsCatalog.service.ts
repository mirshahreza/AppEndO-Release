import {
  mapApiFunction,
  mapSystemFunction,
  mergeFunctionsCatalog,
} from '../../shared/api/contracts/server-functions/mappers';
import type { ServerFunctionItem } from '../../shared/api/contracts/server-functions/types';
import { listManagedFunctions } from '../domain/functions/functionRepository';
import type { SystemFunctionRoute } from '../utils/systemApiRoutes';
import { readRouteLoggingEnabled } from '../utils/methodLogConfig';
import { builtinFunctionRegistry } from './builtinFunctionRegistry.service';
import { listInstalledPackageApiRoutes } from './package-runtime/packageApiCatalog.service';
import { resolveDiscoveredSystemRoutes } from '../utils/serverRouteDiscoveryRegistry';
import { buildSystemFunctionRouteKey } from '../utils/systemApiRoutes';

export type ServerFunctionsCatalogDeps = {
  discoverSystemRoutes: () => Promise<SystemFunctionRoute[]>;
};

/** Mirrors `FunctionsService.listSystem` item shaping before client `mapSystemFunction`. */
export async function buildListSystemCatalogItems(
  deps: ServerFunctionsCatalogDeps,
): Promise<Record<string, unknown>[]> {
  await builtinFunctionRegistry.ensureLoaded();

  const [discoveredRoutes, packageApiRoutes] = await Promise.all([
    resolveDiscoveredSystemRoutes(deps.discoverSystemRoutes),
    Promise.resolve(listInstalledPackageApiRoutes()),
  ]);
  const discoveredRouteKeys = new Set(
    discoveredRoutes.map((route) => `${route.method} ${route.path}`),
  );
  const routes = [
    ...discoveredRoutes,
    ...packageApiRoutes.filter((route) => !discoveredRouteKeys.has(`${route.method} ${route.path}`)),
  ];
  const mergedByRoute = new Map(
    builtinFunctionRegistry.listMergedRecords().map((record) => [record.routeKey, record]),
  );

  return routes.map((item) => {
    const routeKey = buildSystemFunctionRouteKey(String(item.method), String(item.path));
    const merged = mergedByRoute.get(routeKey);
    if (!merged) {
      return {
        ...item,
        enableLogs: readRouteLoggingEnabled(item.method, item.path),
      };
    }

    return {
      ...item,
      id: merged.id,
      name: merged.name,
      folder: merged.folder,
      enableLogs: merged.enableLogs,
      accessControl: merged.accessControl,
      testPayload: merged.testPayload,
      metadataJson: merged.metadataJson,
      language: merged.language,
      runtimeVersion: merged.runtimeVersion,
      memoryLimit: merged.memoryLimit,
      timeoutMs: merged.timeoutMs,
      useGlobalConfig: merged.useGlobalConfig,
      cacheEnabled: merged.cacheEnabled,
      cacheTtlMs: merged.cacheTtlMs,
      cacheByParam: merged.cacheByParam,
      cacheByUser: merged.cacheByUser,
      created_at: merged.created_at,
      created_by: merged.created_by,
      updated_at: merged.updated_at,
      updated_by: merged.updated_by,
    };
  });
}

/** Same merged catalog as `fetchServerFunctionsCatalog` on the client. */
export async function buildMergedServerFunctionsCatalog(
  deps: ServerFunctionsCatalogDeps,
): Promise<ServerFunctionItem[]> {
  const [listSystemItems, managedRows] = await Promise.all([
    buildListSystemCatalogItems(deps),
    listManagedFunctions(),
  ]);

  const systemItems = listSystemItems.map((item) => mapSystemFunction(item));
  const customItems = managedRows.map((row) => mapApiFunction(row as Record<string, unknown>));

  return mergeFunctionsCatalog(systemItems, customItems);
}
