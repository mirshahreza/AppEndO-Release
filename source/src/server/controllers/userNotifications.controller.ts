import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import {
  listUserNotifications,
  countUnreadNotifications,
  countUnseenNotifications,
  markNotificationsBellSeen,
  markNotificationRead,
  markAllNotificationsRead,
  listAllUserNotifications,
  getUserNotificationByIdAdmin,
  type ListAllUserNotificationsQuery,
} from '../services/notifications/userNotification.service';
import {
  listUserNotificationPreferences,
  upsertUserNotificationPreference,
  deleteUserNotificationPreference,
} from '../domain/users/userNotificationPreferenceRepository';

const parseAdminListQuery = (query: Record<string, unknown>): ListAllUserNotificationsQuery => {
  const page = Number(query.page);
  const pageSize = Number(query.pageSize);
  const userId = Number(query.userId);
  return {
    search: typeof query.search === 'string' ? query.search : undefined,
    userId: Number.isInteger(userId) && userId > 0 ? userId : undefined,
    unreadOnly: query.unreadOnly === 'true',
    source: typeof query.source === 'string' ? query.source.trim() : undefined,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 25,
  };
};

/**
 * HWF-0.1 — the first consumer-facing surface for `BaseUserNotification`. Until this controller
 * existed, the notification primitive was write-only (workflow escalation NOTIFY steps and the
 * `communication.notification-send` Action could create rows, but nothing ever listed/read them
 * back to the recipient).
 */
export class UserNotificationsController {
  listAllAdmin = asyncHandler(async (req: Request, res: Response) => {
    const result = await listAllUserNotifications(parseAdminListQuery(req.query as Record<string, unknown>));
    res.json({ success: true, ...result });
  }, 'Failed to list in-app notifications.');

  getByIdAdmin = asyncHandler(async (req: Request, res: Response) => {
    const notificationId = Number(req.params.notificationId);
    if (!Number.isInteger(notificationId) || notificationId <= 0) {
      res.status(400).json({ success: false, error: 'Invalid notification id.' });
      return;
    }
    const item = await getUserNotificationByIdAdmin(notificationId);
    if (!item) {
      res.status(404).json({ success: false, error: 'Notification not found.' });
      return;
    }
    res.json({ success: true, item });
  }, 'Failed to load in-app notification.');

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const unreadOnly = req.query.unreadOnly === 'true';
    const skip = req.query.skip !== undefined ? Number(req.query.skip) : 0;
    const take = req.query.take !== undefined ? Number(req.query.take) : 20;
    const items = await listUserNotifications(userId, { unreadOnly, skip, take });
    res.json({ success: true, items });
  }, 'Failed to list notifications.');

  unreadCount = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const count = await countUnreadNotifications(userId);
    res.json({ success: true, count });
  }, 'Failed to count unread notifications.');

  unseenCount = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const count = await countUnseenNotifications(userId);
    res.json({ success: true, count });
  }, 'Failed to count unseen notifications.');

  markBellSeen = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const result = await markNotificationsBellSeen(userId);
    res.json({ success: true, updated: result.updated });
  }, 'Failed to mark notifications as seen.');

  markRead = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const notificationId = Number(req.params.notificationId);
    if (!Number.isInteger(notificationId) || notificationId <= 0) {
      res.status(400).json({ success: false, error: 'Invalid notification id.' });
      return;
    }
    await markNotificationRead(userId, notificationId);
    res.json({ success: true });
  }, 'Failed to mark notification as read.');

  markAllRead = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const result = await markAllNotificationsRead(userId);
    res.json({ success: true, updated: result.updated });
  }, 'Failed to mark notifications as read.');

  /** HWF-4.2 — self-service channel preference, one row per (own userId, eventType). No row means the untouched IN_APP/immediate default. */
  listPreferences = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const preferences = await listUserNotificationPreferences(userId);
    res.json({ success: true, preferences });
  }, 'Failed to list notification preferences.');

  upsertPreference = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const { eventType, channel, digest } = req.body as { eventType?: string; channel?: string; digest?: boolean };
    if (!eventType?.trim()) {
      res.status(400).json({ success: false, error: 'eventType is required.' });
      return;
    }
    if (channel !== 'IN_APP' && channel !== 'EMAIL') {
      res.status(400).json({ success: false, error: 'channel must be IN_APP or EMAIL.' });
      return;
    }
    const preference = await upsertUserNotificationPreference({ userId, eventType: eventType.trim(), channel, digest: Boolean(digest) });
    res.json({ success: true, preference });
  }, 'Failed to update notification preference.');

  deletePreference = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    await deleteUserNotificationPreference(userId, req.params.eventType);
    res.json({ success: true });
  }, 'Failed to delete notification preference.');
}
