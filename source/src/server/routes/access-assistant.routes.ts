import { Router, type Express, type NextFunction, type Request, type Response } from 'express';
import { AccessAssistantController } from '../controllers/access-assistant.controller';
import { hasAdminRole, normalizeAuthRoles, tryAttachAuth } from '../middleware/auth.middleware';
import type { EntityFunctionAccessServiceDeps } from '../services/entityFunctionAccess.service';
import type { SystemFunctionRoute } from '../utils/systemApiRoutes';

export type AccessAssistantRoutesDeps = EntityFunctionAccessServiceDeps & {
  discoverSystemRoutes: () => Promise<SystemFunctionRoute[]>;
};

const requireAdminOrDeveloper = (req: Request, res: Response, next: NextFunction) => {
  if (hasAdminRole(req)) {
    next();
    return;
  }
  const roles = normalizeAuthRoles(req).map((role) => role.toUpperCase());
  if (roles.includes('DEVELOPER')) {
    next();
    return;
  }
  res.status(403).json({ success: false, error: 'Forbidden.' });
};

export const mountAccessAssistantRoutes = (app: Express, deps: AccessAssistantRoutesDeps): void => {
  const controller = new AccessAssistantController(deps);
  const router = Router();

  router.get('/eligibility', controller.getEligibility);
  router.get('/context', controller.getContext);
  router.put('/context', controller.saveContext);

  app.use('/api/access-assistant', (req, res, next) => {
    tryAttachAuth(req);
    requireAdminOrDeveloper(req, res, next);
  }, router);
};
