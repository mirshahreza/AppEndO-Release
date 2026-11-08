import type { Express } from 'express';
import {
  collectSystemApiRoutes,
  type CollectSystemApiRoutesOptions,
  type SystemFunctionRoute,
} from './systemApiRoutes';
import { applyBootstrapMethodLogConfigs } from './methodLogConfig';

let registeredApp: Express | null = null;
let pendingMethodLogConfigs: unknown = null;
let methodLogConfigsApplied = false;

const routeCache = new Map<string, SystemFunctionRoute[]>();
const routeDiscoveryPromises = new Map<string, Promise<SystemFunctionRoute[]>>();

const buildRouteCacheKey = (options: CollectSystemApiRoutesOptions): string => (
  options.includePreviewCode ? 'preview' : 'summary'
);

/** Registers the full Express app used for live route discovery. */
export function registerRouteDiscoveryApp(app: Express): void {
  registeredApp = app;
  routeCache.clear();
  routeDiscoveryPromises.clear();
}

/** Saved method configs applied at boot; route-derived defaults merge on first discovery. */
export function configureDeferredMethodLogConfigs(savedConfigs: unknown): void {
  pendingMethodLogConfigs = savedConfigs;
  methodLogConfigsApplied = false;
}

const applyDeferredMethodLogConfigs = (routes: SystemFunctionRoute[]): void => {
  if (methodLogConfigsApplied || pendingMethodLogConfigs === null) {
    return;
  }
  applyBootstrapMethodLogConfigs(routes, pendingMethodLogConfigs);
  methodLogConfigsApplied = true;
};

async function ensureSystemApiRoutes(
  options: CollectSystemApiRoutesOptions = {},
): Promise<SystemFunctionRoute[]> {
  const cacheKey = buildRouteCacheKey(options);
  const cached = routeCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const inFlight = routeDiscoveryPromises.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const discoveryPromise = (async () => {
    if (!registeredApp) {
      return [];
    }

    const routes = await collectSystemApiRoutes(registeredApp, options);
    routeCache.set(cacheKey, routes);

    if (!options.includePreviewCode) {
      applyDeferredMethodLogConfigs(routes);
    } else {
      const summaryRoutes = routeCache.get('summary');
      if (summaryRoutes) {
        applyDeferredMethodLogConfigs(summaryRoutes);
      } else {
        applyDeferredMethodLogConfigs(routes);
      }
    }

    return routes;
  })();

  routeDiscoveryPromises.set(cacheKey, discoveryPromise);

  try {
    return await discoveryPromise;
  } finally {
    routeDiscoveryPromises.delete(cacheKey);
  }
}

export function createSystemRouteDiscovery(
  options: CollectSystemApiRoutesOptions = {},
): () => Promise<SystemFunctionRoute[]> {
  return () => ensureSystemApiRoutes(options);
}

/**
 * Resolves discovered API routes, preferring the largest result set so entity
 * access and the Server Functions catalog always see the full mounted surface.
 */
export async function resolveDiscoveredSystemRoutes(
  discoverFromDeps?: () => Promise<SystemFunctionRoute[]>,
): Promise<SystemFunctionRoute[]> {
  const candidates: SystemFunctionRoute[][] = [];

  if (discoverFromDeps) {
    try {
      candidates.push(await discoverFromDeps());
    } catch {
      // Fall through to the registered app scan.
    }
  }

  if (registeredApp) {
    try {
      candidates.push(await ensureSystemApiRoutes());
    } catch {
      // Return whatever deps discovery produced.
    }
  }

  if (candidates.length === 0) {
    return [];
  }

  return candidates.reduce((best, current) => (
    current.length > best.length ? current : best
  ));
}
