import { Router, type Express, type Request, type Response } from 'express';

import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { createUserRateLimiter } from '../middleware/rateLimit';
import { listAllUserMessageDispatchesForAdmin } from '../services/notifications/userMessageDispatch.service';

const readQueryInt = (value: unknown, fallback: number): number => {
  const parsed = Number(typeof value === 'string' ? value.trim() : value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export const mountAdminUserMessageDispatchesRoutes = (app: Express): void => {
  const router = Router();
  const limiter = createUserRateLimiter({ keyPrefix: 'admin-user-message-dispatches', maxPerMinute: 120 });

  router.get(
    '/',
    requireAuth,
    requireRole('ADMIN'),
    limiter,
    async (req: Request, res: Response) => {
      const page = readQueryInt(req.query.page, 0);
      const pageSize = Math.min(readQueryInt(req.query.pageSize, 25), 200);
      const userIdRaw = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
      const userId = userIdRaw ? Number(userIdRaw) : undefined;
      const data = await listAllUserMessageDispatchesForAdmin({
        channel: typeof req.query.channel === 'string' ? req.query.channel : undefined,
        deliveryStatus: typeof req.query.deliveryStatus === 'string' ? req.query.deliveryStatus : undefined,
        eventType: typeof req.query.eventType === 'string' ? req.query.eventType : undefined,
        userId: userId != null && Number.isFinite(userId) ? userId : undefined,
        skip: page * pageSize,
        take: pageSize,
      });
      res.json({
        success: true,
        data: {
          total: data.total,
          rows: data.rows,
          page,
          pageSize,
        },
      });
    },
  );

  app.use('/api/admin/user-message-dispatches', router);
};
