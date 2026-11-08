import { prisma, toUserId as toId, fromUserId as fromId } from './prismaHelpers';

/**
 * HWF-4.2 — per-user, per-event-type notification channel preference. No row for
 * (userId, eventType) means the untouched default (IN_APP, immediate) — opt-in only.
 */
export type UserNotificationPreferenceRecord = {
  id: number;
  userId: number;
  eventType: string;
  channel: 'IN_APP' | 'EMAIL';
  digest: boolean;
  createdAt: string;
  updatedAt: string;
};

const mapRow = (row: {
  id: bigint;
  userId: bigint;
  eventType: string;
  channel: string;
  digest: boolean;
  createdAt: Date;
  updatedAt: Date;
}): UserNotificationPreferenceRecord => ({
  id: fromId(row.id),
  userId: fromId(row.userId),
  eventType: row.eventType,
  channel: row.channel === 'EMAIL' ? 'EMAIL' : 'IN_APP',
  digest: row.digest,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export async function getUserNotificationPreference(userId: number, eventType: string): Promise<UserNotificationPreferenceRecord | undefined> {
  const row = await prisma().userNotificationPreference.findUnique({ where: { userId_eventType: { userId: toId(userId), eventType } } });
  return row ? mapRow(row) : undefined;
}

export async function listUserNotificationPreferences(userId: number): Promise<UserNotificationPreferenceRecord[]> {
  const rows = await prisma().userNotificationPreference.findMany({ where: { userId: toId(userId) }, orderBy: { eventType: 'asc' } });
  return rows.map(mapRow);
}

export async function upsertUserNotificationPreference(input: { userId: number; eventType: string; channel: 'IN_APP' | 'EMAIL'; digest: boolean }): Promise<UserNotificationPreferenceRecord> {
  const row = await prisma().userNotificationPreference.upsert({
    where: { userId_eventType: { userId: toId(input.userId), eventType: input.eventType } },
    create: { userId: toId(input.userId), eventType: input.eventType, channel: input.channel, digest: input.digest },
    update: { channel: input.channel, digest: input.digest },
  });
  return mapRow(row);
}

/** No-op (not an error) if the caller never had a preference for this eventType — deleting reverts to the untouched IN_APP/immediate default, so idempotent-by-construction matches that semantic. */
export async function deleteUserNotificationPreference(userId: number, eventType: string): Promise<void> {
  await prisma().userNotificationPreference.deleteMany({ where: { userId: toId(userId), eventType } });
}
