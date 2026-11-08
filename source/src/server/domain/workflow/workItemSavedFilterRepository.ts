import { prisma, toId, fromId, toIsoString } from './prismaHelpers';

/** HWF-4.3 — server-side saved Inbox filter (per user decision 2026-08-30: explicitly not localStorage-only). */
export type WorkItemSavedFilterRecord = {
  id: number;
  userId: number;
  name: string;
  filterJson: string;
  createdAt: string;
};

const mapRow = (row: { id: bigint; userId: bigint; name: string; filterJson: string; createdAt: Date }): WorkItemSavedFilterRecord => ({
  id: fromId(row.id),
  userId: fromId(row.userId),
  name: row.name,
  filterJson: row.filterJson,
  createdAt: toIsoString(row.createdAt)!,
});

export async function createSavedFilter(input: { userId: number; name: string; filterJson: string }): Promise<WorkItemSavedFilterRecord> {
  const row = await prisma().workItemSavedFilter.create({
    data: { userId: toId(input.userId), name: input.name, filterJson: input.filterJson },
  });
  return mapRow(row);
}

export async function listSavedFiltersForOwner(userId: number): Promise<WorkItemSavedFilterRecord[]> {
  const rows = await prisma().workItemSavedFilter.findMany({ where: { userId: toId(userId) }, orderBy: { createdAt: 'desc' } });
  return rows.map(mapRow);
}

/** Only the filter's own owner may delete it — same idempotent-by-construction convention as `markNotificationRead`/`deleteOwnDelegationRule`. */
export async function deleteOwnSavedFilter(id: number, ownerUserId: number): Promise<boolean> {
  const result = await prisma().workItemSavedFilter.deleteMany({ where: { id: toId(id), userId: toId(ownerUserId) } });
  return result.count > 0;
}
