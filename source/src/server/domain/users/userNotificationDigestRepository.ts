import { prisma, toUserId as toId, fromUserId as fromId } from './prismaHelpers';

/**
 * HWF-4.2 — EMAIL+digest queue. An item lands here instead of an immediate send when the user's
 * preference for its eventType is `channel: 'EMAIL', digest: true`; `notificationDigestScanner.ts`
 * periodically batches a user's pending items into one summary email and stamps `sentAt`.
 */
export type UserNotificationDigestItemRecord = {
  id: number;
  userId: number;
  title: string;
  body: string;
  href: string | null;
  source: string;
  metadataJson: string | null;
  createdAt: string;
  sentAt: string | null;
};

const mapRow = (row: {
  id: bigint;
  userId: bigint;
  title: string;
  body: string;
  href: string | null;
  source: string;
  metadataJson: string | null;
  createdAt: Date;
  sentAt: Date | null;
}): UserNotificationDigestItemRecord => ({
  id: fromId(row.id),
  userId: fromId(row.userId),
  title: row.title,
  body: row.body,
  href: row.href,
  source: row.source,
  metadataJson: row.metadataJson,
  createdAt: row.createdAt.toISOString(),
  sentAt: row.sentAt ? row.sentAt.toISOString() : null,
});

export async function queueNotificationDigestItem(input: { userId: number; title: string; body: string; href?: string | null; source: string; metadata?: unknown }): Promise<UserNotificationDigestItemRecord> {
  const row = await prisma().userNotificationDigestItem.create({
    data: {
      userId: toId(input.userId),
      title: input.title,
      body: input.body,
      href: input.href ?? null,
      source: input.source,
      metadataJson: input.metadata === undefined ? null : JSON.stringify(input.metadata),
    },
  });
  return mapRow(row);
}

/** Escalation-scanner-style source query (doc 07 section 5's shape, not its domain) — every distinct user with at least one pending (`sentAt: null`) digest item, oldest-pending-first so the scanner can decide per user whether that user's digest window has elapsed. */
export async function listUsersWithPendingDigestItems(): Promise<Array<{ userId: number; oldestPendingCreatedAt: string }>> {
  const rows = await prisma().userNotificationDigestItem.groupBy({
    by: ['userId'],
    where: { sentAt: null },
    _min: { createdAt: true },
  });
  return rows
    .filter((r): r is typeof r & { _min: { createdAt: Date } } => r._min.createdAt !== null)
    .map((r) => ({ userId: fromId(r.userId), oldestPendingCreatedAt: r._min.createdAt.toISOString() }));
}

export async function listPendingDigestItemsForUser(userId: number): Promise<UserNotificationDigestItemRecord[]> {
  const rows = await prisma().userNotificationDigestItem.findMany({
    where: { userId: toId(userId), sentAt: null },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(mapRow);
}

export async function markNotificationDigestItemsSent(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await prisma().userNotificationDigestItem.updateMany({
    where: { id: { in: ids.map((id) => toId(id)) } },
    data: { sentAt: new Date() },
  });
}
