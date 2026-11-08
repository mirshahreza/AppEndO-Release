import { prisma, toId, fromId, toIsoString } from './prismaHelpers';

/**
 * HWF-2.4 — Out-of-Office self-service delegation (per user decision 2026-08-30: applies only to
 * NEW Work Item assignment resolution, no sweep of already-open items). A rule redirects a specific
 * resolved-USER assignment target to a delegate while `now()` falls in `[startAt, endAt]`.
 */
export type WorkItemDelegationRuleRecord = {
  id: number;
  userId: number;
  delegateUserId: number;
  startAt: string;
  endAt: string;
  createdAt: string;
};

const mapRow = (row: { id: bigint; userId: bigint; delegateUserId: bigint; startAt: Date; endAt: Date; createdAt: Date }): WorkItemDelegationRuleRecord => ({
  id: fromId(row.id),
  userId: fromId(row.userId),
  delegateUserId: fromId(row.delegateUserId),
  startAt: toIsoString(row.startAt)!,
  endAt: toIsoString(row.endAt)!,
  createdAt: toIsoString(row.createdAt)!,
});

export async function createDelegationRule(input: { userId: number; delegateUserId: number; startAt: string; endAt: string }): Promise<WorkItemDelegationRuleRecord> {
  const row = await prisma().workItemDelegationRule.create({
    data: {
      userId: toId(input.userId),
      delegateUserId: toId(input.delegateUserId),
      startAt: new Date(input.startAt),
      endAt: new Date(input.endAt),
    },
  });
  return mapRow(row);
}

export async function listDelegationRulesForOwner(userId: number): Promise<WorkItemDelegationRuleRecord[]> {
  const rows = await prisma().workItemDelegationRule.findMany({ where: { userId: toId(userId) }, orderBy: { startAt: 'desc' } });
  return rows.map(mapRow);
}

/** Only the rule's own owner may delete it. Returns `false` (not an error) when the rule doesn't exist or belongs to someone else — same idempotent-by-construction convention as `markNotificationRead`. */
export async function deleteOwnDelegationRule(id: number, ownerUserId: number): Promise<boolean> {
  const result = await prisma().workItemDelegationRule.deleteMany({ where: { id: toId(id), userId: toId(ownerUserId) } });
  return result.count > 0;
}

/** Called from `dispatchService.ts` right after a WORK_ITEM assignment resolves to a specific user — resolves to the delegate's id when an active rule covers `now()`, or `null` when none applies. If multiple rules overlap, the most recently created one wins (author's own responsibility not to create overlapping rules; not validated here). */
export async function resolveActiveDelegate(userId: number, atInstant: Date = new Date()): Promise<number | null> {
  const rule = await prisma().workItemDelegationRule.findFirst({
    where: { userId: toId(userId), startAt: { lte: atInstant }, endAt: { gte: atInstant } },
    orderBy: { createdAt: 'desc' },
  });
  return rule ? fromId(rule.delegateUserId) : null;
}
