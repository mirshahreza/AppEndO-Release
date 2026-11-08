import type { NextFunction, Request, Response } from 'express';
import type { NodeCapability } from '../../shared/nodeCapabilities';
import {
  buildNodeCapabilityDeniedMessage,
  nodeSatisfiesRouteCapabilities,
  resolveApiRouteCapabilities,
} from '../../shared/nodeCapabilityRoutes';

export const createNodeCapabilityMiddleware = (
  activeCapabilities: readonly NodeCapability[],
) => (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const pathname = (req.originalUrl || req.url || '').split('?')[0] || '';
  if (!pathname.startsWith('/api')) {
    next();
    return;
  }

  const { required } = resolveApiRouteCapabilities(pathname, req.method);
  if (nodeSatisfiesRouteCapabilities(activeCapabilities, required)) {
    next();
    return;
  }

  res.status(503).json({
    success: false,
    error: buildNodeCapabilityDeniedMessage(required ?? []),
    requiredCapabilities: required,
    activeCapabilities: [...activeCapabilities],
  });
};

export const assertNodeCapabilityForRoute = (
  activeCapabilities: readonly NodeCapability[],
  pathname: string,
  method: string,
): { allowed: true } | { allowed: false; message: string; statusCode: number } => {
  const { required } = resolveApiRouteCapabilities(pathname, method);
  if (nodeSatisfiesRouteCapabilities(activeCapabilities, required)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    statusCode: 503,
    message: buildNodeCapabilityDeniedMessage(required ?? []),
  };
};
