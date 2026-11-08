import { prisma, toId, fromId, toIsoString } from './prismaHelpers';

/** HWF-4.1 — comment thread on a Work Item. */
export type WorkItemCommentRecord = {
  id: number;
  workItemId: number;
  authorUserId: number;
  text: string;
  mentionedUserIds: number[];
  createdAt: string;
};

const mapRow = (row: { id: bigint; workItemId: bigint; authorUserId: bigint; text: string; mentionedUserIdsJson: string | null; createdAt: Date }): WorkItemCommentRecord => ({
  id: fromId(row.id),
  workItemId: fromId(row.workItemId),
  authorUserId: fromId(row.authorUserId),
  text: row.text,
  mentionedUserIds: row.mentionedUserIdsJson ? (JSON.parse(row.mentionedUserIdsJson) as number[]) : [],
  createdAt: toIsoString(row.createdAt)!,
});

export async function createWorkItemComment(input: { workItemId: number; authorUserId: number; text: string; mentionedUserIds?: number[] }): Promise<WorkItemCommentRecord> {
  const row = await prisma().workItemComment.create({
    data: {
      workItemId: toId(input.workItemId),
      authorUserId: toId(input.authorUserId),
      text: input.text,
      mentionedUserIdsJson: input.mentionedUserIds?.length ? JSON.stringify(input.mentionedUserIds) : null,
    },
  });
  return mapRow(row);
}

export async function listWorkItemComments(workItemId: number): Promise<WorkItemCommentRecord[]> {
  const rows = await prisma().workItemComment.findMany({ where: { workItemId: toId(workItemId) }, orderBy: { createdAt: 'asc' } });
  return rows.map(mapRow);
}

/** HWF-4.1 — "has this user posted at least one comment on this Work Item" half of the access decision (per user decision 2026-08-30: eligibility OR prior participation, so the circle never shrinks the moment someone claims). */
export async function hasUserCommentedOnWorkItem(workItemId: number, userId: number): Promise<boolean> {
  const existing = await prisma().workItemComment.findFirst({ where: { workItemId: toId(workItemId), authorUserId: toId(userId) }, select: { id: true } });
  return existing !== null;
}
