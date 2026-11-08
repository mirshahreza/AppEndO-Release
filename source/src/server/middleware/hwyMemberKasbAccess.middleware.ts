import type { NextFunction, Request, Response } from 'express';

import { viewerCanManageHwyMemberKasbLinks } from '../../domain/hwy/hwyMemberKasbLegacyAccess';
import { resolveHwyMemberKasbLinkAllowRoles } from '../domain/hwy/hwyMemberKasbAccess.service';
import { normalizeAuthRoles } from './auth.middleware';

export const requireHwyMemberKasbLinkAccess = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  void (async () => {
    const authRoles = normalizeAuthRoles(req);
    if (authRoles.length === 0) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }
    const allowed = await resolveHwyMemberKasbLinkAllowRoles();
    if (!viewerCanManageHwyMemberKasbLinks(authRoles, allowed)) {
      res.status(403).json({ success: false, message: 'Forbidden.' });
      return;
    }
    next();
  })();
};
