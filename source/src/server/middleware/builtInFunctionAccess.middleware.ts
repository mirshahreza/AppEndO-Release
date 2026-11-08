import type { NextFunction, Request, Response } from 'express';
import {
  canAccessManagedFunction,
} from '../../shared/api/contracts/server-functions/accessControl';
import {
  hasAdminRole,
  normalizeAuthRoles,
  requireRole,
  tryAttachAuth,
} from './auth.middleware';
import { builtinFunctionRegistry } from '../services/builtinFunctionRegistry.service';
import { createBuiltInRuntimePolicyMiddleware } from './builtInFunctionRuntime.middleware';

const normalizeRequestPath = (path: string): string => {
  const withoutQuery = path.split('?')[0] || '/';
  if (withoutQuery.length > 1 && withoutQuery.endsWith('/')) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery;
};

const resolvePrincipal = (req: Request) => ({
  isAdmin: hasAdminRole(req),
  isAuthenticated: Boolean(req.auth?.userId),
  userId: req.auth?.userId,
  email: req.auth?.email,
  roles: normalizeAuthRoles(req),
});

/**
 * For routers that expose both catalogued built-in routes and admin-only extensions.
 * Catalogued routes use persisted accessControl; other paths fall back to fallbackRoles.
 */
export const createBuiltInRouteGuard = (...fallbackRoles: string[]) => {
  const fallbackMiddleware = fallbackRoles.length > 0
    ? requireRole(...fallbackRoles)
    : (_req: Request, _res: Response, next: NextFunction) => next();
  const runtimePolicy = createBuiltInRuntimePolicyMiddleware();

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await builtinFunctionRegistry.ensureLoaded();
      const pathname = normalizeRequestPath(req.originalUrl || req.url || '');
      const match = builtinFunctionRegistry.resolve(req.method, pathname);

      if (!match) {
        fallbackMiddleware(req, res, next);
        return;
      }

      const accessControl = match.record.accessControl;
      const mode = accessControl.accessMode ?? 'authenticated';
      const isPublic = mode === 'public';

      if (!req.auth?.userId) {
        tryAttachAuth(req);
      }

      const principal = resolvePrincipal(req);

      if (!isPublic && !principal.isAuthenticated) {
        res.status(401).json({
          success: false,
          error: 'Missing access token.',
        });
        return;
      }

      if (!canAccessManagedFunction(principal, accessControl)) {
        res.status(principal.isAuthenticated ? 403 : 401).json({
          success: false,
          error: principal.isAuthenticated
            ? 'Forbidden: insufficient permissions for this server function.'
            : 'Missing access token.',
        });
        return;
      }

      (req as Request & { builtinFunctionRecord?: typeof match.record }).builtinFunctionRecord = match.record;
      await runtimePolicy(req, res, next);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Built-in route access check failed.';
      res.status(500).json({ success: false, error: message });
    }
  };
};

export const ensureBuiltInCatalogAccess = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await builtinFunctionRegistry.ensureLoaded();
    const pathname = normalizeRequestPath(req.originalUrl || req.url || '');
    const match = builtinFunctionRegistry.resolve(req.method, pathname);
    if (!match) {
      next();
      return;
    }

    if (!req.auth?.userId) {
      tryAttachAuth(req);
    }

    const principal = resolvePrincipal(req);
    const accessControl = match.record.accessControl;
    const isPublic = accessControl.accessMode === 'public';

    if (!isPublic && !principal.isAuthenticated) {
      res.status(401).json({ success: false, error: 'Missing access token.' });
      return;
    }

    if (!canAccessManagedFunction(principal, accessControl)) {
      res.status(principal.isAuthenticated ? 403 : 401).json({
        success: false,
        error: principal.isAuthenticated
          ? 'Forbidden: insufficient permissions for this server function.'
          : 'Missing access token.',
      });
      return;
    }

    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Built-in route access check failed.';
    res.status(500).json({ success: false, error: message });
  }
};
