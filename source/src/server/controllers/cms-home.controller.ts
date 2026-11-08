import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { listCmsHomeReviewQueue } from '../services/cms/cmsHomeReviewQueue.service';
import { normalizeAuthRoles } from '../middleware/auth.middleware';

const actorFromRequest = (req: Request) => {
  const userId = req.auth?.userId;
  if (typeof userId !== 'number' || !Number.isFinite(userId)) {
    return null;
  }
  const roles = normalizeAuthRoles(req);
  const isAdmin = roles.some((role) => role.toUpperCase() === 'ADMIN');
  return {
    userId,
    email: req.auth?.email?.trim() || 'unknown',
    roles,
    isAdmin,
  };
};

export class CmsHomeController {
  reviewQueue = asyncHandler(async (req: Request, res: Response) => {
    const actor = actorFromRequest(req);
    if (!actor) {
      res.status(401).json({ success: false, error: 'Missing access token.' });
      return;
    }
    const result = await listCmsHomeReviewQueue(actor);
    res.json({ success: true, ...result });
  }, 'Failed to load the CMS review queue.');
}
