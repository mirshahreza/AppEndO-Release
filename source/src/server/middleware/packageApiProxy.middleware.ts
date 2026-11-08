import type { NextFunction, Request, Response } from 'express';
import type { NodeCapability } from '../../shared/nodeCapabilities';
import {
  hasAdminRole,
  normalizeAuthRoles,
  tryAttachAuth,
} from '../middleware/auth.middleware';
import { assertNodeCapabilityForRoute } from '../middleware/nodeCapability.middleware';
import {
  executePluginApiHandler,
  resolvePackageApiRoute,
} from '../services/package-runtime/packageApiRuntime.service';

type PackageApiProxyOptions = {
  activeCapabilities?: readonly NodeCapability[];
};

export const createPackageApiProxyMiddleware = (options: PackageApiProxyOptions = {}) => (
  async (req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next();
      return;
    }

    const pathname = (req.originalUrl || req.url || '').split('?')[0] || '';
    // Hawiety public portal routes are mounted on core Express — never package API handlers.
    if (pathname.startsWith('/api/hwy/public/')) {
      next();
      return;
    }
    const match = resolvePackageApiRoute(req.method, pathname);
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

    const authLevel = match.api.auth ?? 'admin';
    if (authLevel === 'public') {
      tryAttachAuth(req);
    } else {
      if (!tryAttachAuth(req)) {
        res.status(401).json({ success: false, error: 'Missing access token.' });
        return;
      }
      if (authLevel === 'admin' && !hasAdminRole(req)) {
        res.status(403).json({ success: false, error: 'Forbidden.' });
        return;
      }
    }

    const result = await executePluginApiHandler(
      match,
      {
        body: req.body,
        query: req.query,
        params: req.params,
        method: req.method,
        headers: req.headers,
      },
      res,
      { authRoles: normalizeAuthRoles(req) },
    );

    if (!result.ok && !res.headersSent) {
      res.status(result.statusCode).json({ success: false, error: result.error });
    }
  }
);
