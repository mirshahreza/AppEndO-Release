import { Router, type Express } from 'express';
import { UserNotificationsController } from '../controllers/userNotifications.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { createUserRateLimiter } from '../middleware/rateLimit';

/** HWF-0.1 — generic per-user in-app notification inbox (list/unread-count/mark-read/mark-all-read). Any authenticated user only ever sees their own rows (`req.auth.userId` scoping inside the controller/service, never a param). ADMIN cross-user browse: GET `/api/notifications/admin`. */
export const mountUserNotificationsRoutes = (app: Express): void => {
  const controller = new UserNotificationsController();
  const authOnly = requireAuth;
  const adminOnly = requireRole('ADMIN');
  const listRateLimit = createUserRateLimiter({ keyPrefix: 'user-notifications-list', maxPerMinute: 240 });
  const mutateRateLimit = createUserRateLimiter({ keyPrefix: 'user-notifications-mutate', maxPerMinute: 120 });
  const router = Router();

  router.get('/admin', adminOnly, listRateLimit, controller.listAllAdmin);
  router.get('/admin/:notificationId', adminOnly, listRateLimit, controller.getByIdAdmin);
  router.get('/', authOnly, listRateLimit, controller.list);
  router.get('/unread-count', authOnly, listRateLimit, controller.unreadCount);
  router.get('/unseen-count', authOnly, listRateLimit, controller.unseenCount);
  router.post('/bell-seen', authOnly, mutateRateLimit, controller.markBellSeen);
  router.post('/:notificationId/read', authOnly, mutateRateLimit, controller.markRead);
  router.post('/read-all', authOnly, mutateRateLimit, controller.markAllRead);
  router.get('/preferences', authOnly, listRateLimit, controller.listPreferences);
  router.put('/preferences', authOnly, mutateRateLimit, controller.upsertPreference);
  router.delete('/preferences/:eventType', authOnly, mutateRateLimit, controller.deletePreference);

  app.use('/api/notifications', router);
};
