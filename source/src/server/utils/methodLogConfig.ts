import { LogLevel, logger, type MethodLogConfig } from '../../core/logging/Logger';
import {
  resolveDefaultRouteLoggingEnabled,
  toHttpMethodLogId,
} from '../../shared/lib/httpMethodLogId';
import type { SystemFunctionRoute } from './systemApiRoutes';
import { sanitizeMethodLogConfigs } from './httpLogging';

export function buildDefaultMethodConfigsFromRoutes(
  routes: ReadonlyArray<Pick<SystemFunctionRoute, 'method' | 'path'>>,
): Record<string, Partial<MethodLogConfig>> {
  const output: Record<string, Partial<MethodLogConfig>> = {};

  routes.forEach((route) => {
    const id = toHttpMethodLogId(route.method, route.path);
    output[id] = {
      enabled: resolveDefaultRouteLoggingEnabled(route.path),
      minLevel: LogLevel.INFO,
    };
  });

  return output;
}

export function applyBootstrapMethodLogConfigs(
  routes: ReadonlyArray<Pick<SystemFunctionRoute, 'method' | 'path'>>,
  savedConfigs: unknown,
): void {
  logger.setMethodConfigs({
    ...buildDefaultMethodConfigsFromRoutes(routes),
    ...sanitizeMethodLogConfigs(savedConfigs),
  });
}

export function readRouteLoggingEnabled(method: string, path: string): boolean {
  return logger.getMethodConfig(toHttpMethodLogId(method, path)).enabled;
}
