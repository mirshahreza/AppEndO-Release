import type { NextFunction, Request, Response } from 'express';

import { hwyCandidatePipelineStageFromSegment } from '../../domain/hwy/hwyCandidatePipelineCatalog';
import { resolveHwyCandidatePipelinePortalAllowRoles } from '../domain/hwy/hwyCandidatePipelineAccess.service';
import { normalizeAuthRoles } from './auth.middleware';

export const requireHwyCandidatePipelineAccess = (
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
      const allowed = await resolveHwyCandidatePipelinePortalAllowRoles();
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

export const readCandidatePipelineStageParam = (req: Request) => {
  const raw = req.params.stage?.trim().toLowerCase();
  return hwyCandidatePipelineStageFromSegment(raw ?? '');
};
