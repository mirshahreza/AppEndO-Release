import type { NextFunction, Request, Response } from 'express';
import type { NodeCapability } from '../../shared/nodeCapabilities';
import { getRequestDbContextFromInput } from '../../core/database/requestDbContext';
import {
  canAccessManagedFunction,
  parseFunctionAccessControl,
} from '../../shared/api/contracts/server-functions/accessControl';
import {
  hasAdminRole,
  normalizeAuthRoles,
} from '../middleware/auth.middleware';
import { getSessionContextForUser } from '../services/attributes/sessionContext.service';
import type { EdgeDbQueryFn } from '../services/server-function.service';
import { ServerFunctionService } from '../services/server-function.service';
import { managedFunctionRouteRegistry } from '../services/managedFunctionRouteRegistry';
import { findManagedFunctionById } from '../domain/functions/functionRepository';
import { isHttpError } from '../errors/HttpError';
import { assertNodeCapabilityForRoute } from './nodeCapability.middleware';
import {
  createDataApiExecutorRunner,
  isDataApiManagedFunction,
} from './dataApiExecutor.middleware';
import {
  isEdgeDomainActionManagedFunction,
  runEdgeDomainActionManagedFunction,
} from '../services/data-api/edgeDomainManagedFunction';
import { getDataSourcesFromSettings } from '../db/dataSourcesStore';
import { recordComponentUsageHit } from '../services/component-usage/componentUsagePersistence.service';

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

type ManagedFunctionProxyOptions = {
  activeCapabilities?: readonly NodeCapability[];
  settingsPath?: string;
};

export const createManagedFunctionProxyMiddleware = (
  edgeDbQuery: EdgeDbQueryFn,
  options: ManagedFunctionProxyOptions = {},
) => {
  const edgeService = new ServerFunctionService();
  const runDataApi = options.settingsPath
    ? createDataApiExecutorRunner({
      getDataSources: () => getDataSourcesFromSettings(options.settingsPath as string),
    })
    : null;

  return async (req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next();
      return;
    }

    const pathname = (req.originalUrl || req.url || '').split('?')[0] || '';
    if (!pathname.startsWith('/api') || managedFunctionRouteRegistry.isReservedApiPath(pathname)) {
      next();
      return;
    }

    try {
      await managedFunctionRouteRegistry.ensureLoaded();
      const match = managedFunctionRouteRegistry.resolve(req.method, pathname);
      if (!match) {
        next();
        return;
      }

      if (options.activeCapabilities) {
        const capabilityCheck = assertNodeCapabilityForRoute(
          options.activeCapabilities,
          pathname,
          req.method,
        );
        if (!capabilityCheck.allowed) {
          res.status(capabilityCheck.statusCode).json({
            success: false,
            error: capabilityCheck.message,
          });
          return;
        }
      }

      const accessControl = parseFunctionAccessControl(
        match.function.access_control ?? match.function.accessControl,
      );
      const isAuthenticated = Boolean(req.auth?.userId);
      const allowed = canAccessManagedFunction({
        isAdmin: hasAdminRole(req),
        isAuthenticated,
        userId: req.auth?.userId,
        email: req.auth?.email,
        roles: normalizeAuthRoles(req),
      }, accessControl);

      if (!allowed) {
        res.status(isAuthenticated ? 403 : 401).json({
          success: false,
          error: isAuthenticated
            ? 'Forbidden: insufficient permissions for this server function.'
            : 'Missing access token.',
        });
        return;
      }

      const functionIdForUsage = String(match.function.id ?? '').trim();
      if (functionIdForUsage) {
        res.on('finish', () => {
          if (res.statusCode < 200 || res.statusCode >= 400) {
            return;
          }
          recordComponentUsageHit({ componentName: functionIdForUsage, kind: 'server-function' });
        });
      }

      const priorBody = req.body;
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        req.body = {};
      }

      req.params = { ...req.params, ...match.params };
      (req.body as Record<string, unknown>).params = {
        ...(typeof (req.body as Record<string, unknown>).params === 'object'
          && (req.body as Record<string, unknown>).params !== null
          && !Array.isArray((req.body as Record<string, unknown>).params)
          ? (req.body as Record<string, unknown>).params as Record<string, unknown>
          : {}),
        ...match.params,
      };

      if (priorBody && typeof priorBody === 'object' && !Array.isArray(priorBody)) {
        const bodyRecord = priorBody as Record<string, unknown>;
        if (bodyRecord.body !== undefined) {
          (req.body as Record<string, unknown>).body = bodyRecord.body;
        } else {
          const flatPayload = Object.fromEntries(
            Object.entries(bodyRecord).filter(([key]) => key !== 'params'),
          );
          if (Object.keys(flatPayload).length > 0) {
            (req.body as Record<string, unknown>).body = flatPayload;
            Object.assign(req.body as Record<string, unknown>, flatPayload);
          }
        }
        const incomingParams = asRecord(bodyRecord.params);
        if (incomingParams) {
          (req.body as Record<string, unknown>).params = {
            ...(asRecord((req.body as Record<string, unknown>).params) || {}),
            ...incomingParams,
          };
        }
      } else if (req.method !== 'GET' && req.method !== 'DELETE') {
        (req.body as Record<string, unknown>).body = priorBody;
      }

      let executionFunction = match.function;
      if (!executionFunction.code?.trim()) {
        const needsSource = !isDataApiManagedFunction(executionFunction)
          || isEdgeDomainActionManagedFunction(executionFunction);
        if (needsSource) {
          const loaded = await findManagedFunctionById(executionFunction.id);
          if (!loaded?.code?.trim()) {
            res.status(500).json({
              success: false,
              error: 'Managed function source is unavailable.',
            });
            return;
          }
          executionFunction = {
            ...executionFunction,
            code: loaded.code,
            language: loaded.language,
            test_payload: loaded.test_payload,
            runtime_version: loaded.runtime_version,
            memory_limit: loaded.memory_limit,
            timeout_ms: loaded.timeout_ms,
            use_global_config: loaded.use_global_config,
            enable_logs: loaded.enable_logs,
            cache_enabled: loaded.cache_enabled,
            cache_ttl_ms: loaded.cache_ttl_ms,
            cache_by_param: loaded.cache_by_param,
            cache_by_user: loaded.cache_by_user,
            engine_type: loaded.engine_type,
            metadata_json: loaded.metadata_json,
            access_control: loaded.access_control,
          };
        }
      }

      if (isEdgeDomainActionManagedFunction(executionFunction)) {
        if (!options.settingsPath) {
          res.status(500).json({
            success: false,
            error: 'Edge domain action runtime is not configured.',
          });
          return;
        }
        await runEdgeDomainActionManagedFunction(
          req,
          res,
          executionFunction,
          match.params,
          {
            getDataSources: () => getDataSourcesFromSettings(options.settingsPath as string),
          },
        );
        return;
      }

      if (isDataApiManagedFunction(executionFunction)) {
        if (!runDataApi) {
          res.status(500).json({
            success: false,
            error: 'Data API executor is not configured.',
          });
          return;
        }
        await runDataApi(req, res, executionFunction, match.params);
        return;
      }

      const runtimeDbContext = getRequestDbContextFromInput({
        headers: req.headers as Record<string, unknown>,
        query: req.query as Record<string, unknown>,
        body: req.body,
      });

      await edgeService.executeManagedFunction(req, res, executionFunction, edgeDbQuery, {
        functionId: executionFunction.id,
        actorUserId: req.auth?.userId,
        authRoles: normalizeAuthRoles(req),
        actorEmail: req.auth?.email,
        sessionContextLoader: req.auth?.userId
          ? (userId) => getSessionContextForUser(userId, req.auth?.role)
          : undefined,
        dbContext: runtimeDbContext.dataSourceId || runtimeDbContext.database
          ? runtimeDbContext
          : undefined,
        edgeCache: {
          requestMethod: req.method,
          requestParams: match.params,
          requestQuery: req.query,
        },
      });
    } catch (error) {
      if (res.headersSent) {
        return;
      }
      if (isHttpError(error)) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          ...error.body,
        });
        return;
      }
      const message = error instanceof Error ? error.message : 'Managed function execution failed.';
      res.status(500).json({ success: false, error: message });
    }
  };
};
