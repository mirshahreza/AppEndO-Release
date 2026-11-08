import type { Request } from 'express';
import type { FunctionDocAccessPrincipal } from '../../shared/api/openapi/buildManagedFunctionOpenApi';
import { hasAdminRole, normalizeAuthRoles } from '../middleware/auth.middleware';

export const toFunctionDocAccessPrincipal = (req: Request): FunctionDocAccessPrincipal => ({
  isAdmin: hasAdminRole(req),
  userId: req.auth?.userId,
  email: req.auth?.email,
  roles: normalizeAuthRoles(req),
});
