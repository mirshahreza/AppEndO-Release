import type { Prisma } from '../../../generated/prisma/client';
import { prisma } from '../../domain/users/prismaHelpers';
import { listRoleMemberSummaries } from '../../domain/users/userRoleRepository';
import { invalidatePersonalInboxProjection } from '../personal-inbox/personalInboxProjectionInvalidate';
import {
  patchPersonalInboxProjectionAttention,
  removePersonalInboxProjectionItem,
} from '../personal-inbox/personalInboxProjectionSync';

export type CreateUserNotificationInput = {
  userId: number;
  title: string;
  body: string;
  severity?: string;
  href?: string | null;
  source?: string;
  metadata?: unknown;
};

const parsePositiveInt = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    return Number.isInteger(n) && n > 0 ? n : null;
  }
  return null;
};

export async function createUserNotification(input: CreateUserNotificationInput): Promise<{ id: number }> {
  const row = await prisma().baseUserNotification.create({
    data: {
      userId: BigInt(input.userId),
      title: input.title,
      body: input.body,
      severity: input.severity?.trim() || 'info',
      href: input.href ?? null,
      source: input.source?.trim() || 'workflow',
      metadataJson: input.metadata === undefined ? null : JSON.stringify(input.metadata),
    },
    select: { id: true },
  });
  invalidatePersonalInboxProjection(input.userId);
  return { id: Number(row.id) };
}

export async function createNotificationsForRole(input: {
  roleId: string;
  title: string;
  body: string;
  severity?: string;
  href?: string | null;
  source?: string;
  metadata?: unknown;
}): Promise<{ created: number; userIds: number[] }> {
  const listed = await listRoleMemberSummaries(input.roleId);
  if ('roleMissing' in listed) {
    return { created: 0, userIds: [] };
  }
  const userIds = listed.members
    .map((m) => parsePositiveInt(m.userId))
    .filter((id): id is number => id !== null);
  const unique = [...new Set(userIds)];
  for (const userId of unique) {
    await createUserNotification({
      userId,
      title: input.title,
      body: input.body,
      severity: input.severity,
      href: input.href,
      source: input.source,
      metadata: input.metadata,
    });
  }
  return { created: unique.length, userIds: unique };
}

export type UserNotificationRecord = {
  id: number;
  title: string;
  body: string;
  severity: string;
  href: string | null;
  source: string;
  metadataJson: string | null;
  readAt: string | null;
  seenAt: string | null;
  createdAt: string;
};

const mapNotificationRow = (row: {
  id: bigint;
  title: string;
  body: string;
  severity: string;
  href: string | null;
  source: string;
  metadataJson: string | null;
  readAt: Date | null;
  seenAt: Date | null;
  createdAt: Date;
}): UserNotificationRecord => ({
  id: Number(row.id),
  title: row.title,
  body: row.body,
  severity: row.severity,
  href: row.href,
  source: row.source,
  metadataJson: row.metadataJson,
  readAt: row.readAt ? row.readAt.toISOString() : null,
  seenAt: row.seenAt ? row.seenAt.toISOString() : null,
  createdAt: row.createdAt.toISOString(),
});

export async function getUserNotificationForUser(
  userId: number,
  notificationId: number,
): Promise<UserNotificationRecord | null> {
  const row = await prisma().baseUserNotification.findFirst({
    where: { id: BigInt(notificationId), userId: BigInt(userId) },
  });
  return row ? mapNotificationRow(row) : null;
}

export async function listUserNotifications(userId: number, options?: { unreadOnly?: boolean; skip?: number; take?: number }): Promise<UserNotificationRecord[]> {
  const rows = await prisma().baseUserNotification.findMany({
    where: { userId: BigInt(userId), ...(options?.unreadOnly ? { readAt: null } : {}) },
    orderBy: { createdAt: 'desc' },
    skip: options?.skip ?? 0,
    take: Math.min(options?.take ?? 20, 100),
  });
  return rows.map(mapNotificationRow);
}

export async function countUnreadNotifications(userId: number): Promise<number> {
  return prisma().baseUserNotification.count({ where: { userId: BigInt(userId), readAt: null } });
}

/** MSGI F1 — shell bell badge: rows the user has not opened the bell for since arrival. */
export async function countUnseenNotifications(userId: number): Promise<number> {
  return prisma().baseUserNotification.count({ where: { userId: BigInt(userId), seenAt: null } });
}

/** Stamp `seen_at` when the bell panel opens; does not set `read_at`. */
export async function markNotificationsBellSeen(userId: number): Promise<{ updated: number }> {
  const now = new Date();
  const result = await prisma().baseUserNotification.updateMany({
    where: { userId: BigInt(userId), seenAt: null },
    data: { seenAt: now },
  });
  invalidatePersonalInboxProjection(userId);
  return { updated: result.count };
}

/** No-op (not an error) if the notification doesn't belong to `userId` or is already read — mark-read is idempotent by construction. */
/** Returns false when the row does not exist or belongs to another user — delete is idempotent by construction. */
export async function deleteUserNotification(userId: number, notificationId: number): Promise<boolean> {
  const result = await prisma().baseUserNotification.deleteMany({
    where: { id: BigInt(notificationId), userId: BigInt(userId) },
  });
  if (result.count === 0) {
    return false;
  }
  await removePersonalInboxProjectionItem(userId, `alert:${notificationId}`);
  invalidatePersonalInboxProjection(userId);
  return true;
}

export async function markNotificationUnread(userId: number, notificationId: number): Promise<void> {
  await prisma().baseUserNotification.updateMany({
    where: { id: BigInt(notificationId), userId: BigInt(userId) },
    data: { readAt: null },
  });
  await patchPersonalInboxProjectionAttention(userId, `alert:${notificationId}`, 'unread');
  invalidatePersonalInboxProjection(userId);
}

export async function markNotificationRead(userId: number, notificationId: number): Promise<void> {
  const now = new Date();
  await prisma().baseUserNotification.updateMany({
    where: { id: BigInt(notificationId), userId: BigInt(userId), readAt: null },
    data: { readAt: now, seenAt: now },
  });
  await prisma().baseUserNotification.updateMany({
    where: { id: BigInt(notificationId), userId: BigInt(userId), readAt: { not: null }, seenAt: null },
    data: { seenAt: now },
  });
  await patchPersonalInboxProjectionAttention(userId, `alert:${notificationId}`, 'none');
  invalidatePersonalInboxProjection(userId);
}

export async function markAllNotificationsRead(userId: number): Promise<{ updated: number }> {
  const now = new Date();
  const result = await prisma().baseUserNotification.updateMany({
    where: { userId: BigInt(userId), readAt: null },
    data: { readAt: now, seenAt: now },
  });
  await prisma().baseUserNotification.updateMany({
    where: { userId: BigInt(userId), readAt: { not: null }, seenAt: null },
    data: { seenAt: now },
  });
  invalidatePersonalInboxProjection(userId);
  return { updated: result.count };
}

const ADMIN_LIST_DEFAULT_PAGE_SIZE = 25;
const ADMIN_LIST_MAX_PAGE_SIZE = 100;

export type ListAllUserNotificationsQuery = {
  search?: string;
  userId?: number;
  unreadOnly?: boolean;
  source?: string;
  page?: number;
  pageSize?: number;
};

export type UserNotificationAdminRecord = UserNotificationRecord & {
  userId: number;
  username: string;
};

const buildAdminNotificationListWhere = (query: ListAllUserNotificationsQuery): Prisma.BaseUserNotificationWhereInput => {
  const where: Prisma.BaseUserNotificationWhereInput = {};
  if (query.userId !== undefined) {
    where.userId = BigInt(query.userId);
  }
  if (query.unreadOnly) {
    where.readAt = null;
  }
  const source = query.source?.trim();
  if (source) {
    where.source = source;
  }
  const search = query.search?.trim();
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { body: { contains: search } },
      { user: { username: { contains: search } } },
    ];
  }
  return where;
};

/** ADMIN Records — cross-user browse of live in-app bell rows (`base_user_notifications`). */
export async function listAllUserNotifications(
  query: ListAllUserNotificationsQuery = {},
): Promise<{ items: UserNotificationAdminRecord[]; totalCount: number; page: number; pageSize: number }> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(
    Math.max(1, query.pageSize ?? ADMIN_LIST_DEFAULT_PAGE_SIZE),
    ADMIN_LIST_MAX_PAGE_SIZE,
  );
  const where = buildAdminNotificationListWhere(query);
  const skip = (page - 1) * pageSize;

  const [rows, totalCount] = await Promise.all([
    prisma().baseUserNotification.findMany({
      where,
      include: { user: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma().baseUserNotification.count({ where }),
  ]);

  return {
    items: rows.map((row) => ({
      ...mapNotificationRow(row),
      userId: Number(row.userId),
      username: row.user.username,
    })),
    totalCount,
    page,
    pageSize,
  };
}

export async function getUserNotificationByIdAdmin(notificationId: number): Promise<UserNotificationAdminRecord | null> {
  const row = await prisma().baseUserNotification.findUnique({
    where: { id: BigInt(notificationId) },
    include: { user: { select: { username: true } } },
  });
  if (!row) {
    return null;
  }
  return {
    ...mapNotificationRow(row),
    userId: Number(row.userId),
    username: row.user.username,
  };
}

export { parsePositiveInt as parseNotificationUserId };
