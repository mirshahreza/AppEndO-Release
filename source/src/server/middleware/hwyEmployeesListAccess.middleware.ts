import type { NextFunction, Request, Response } from 'express';

import { resolveHwyEmployeesListAllowRoles } from '../domain/hwy/hwyEmployeesListAccess.service';
import { normalizeAuthRoles } from './auth.middleware';

export const requireHwyEmployeesListAccess = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  void (async () => {
    try {
      const authRoles = normalizeAuthRoles(req);
      if (authRoles.length === 0) {
        res.status(401).json({ success: false, error: 'Unauthorized.' });
        return;
      }
      const allowed = await resolveHwyEmployeesListAllowRoles();
      if (!allowed.some((role) => authRoles.includes(role))) {
        res.status(403).json({ success: false, message: 'Forbidden.' });
        return;
      }
      next();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Access check failed.';
      if (!res.headersSent) {
        res.status(500).json({ success: false, message });
      }
    }
  })();
};
