import { fromUserId, prisma, toUserId } from '../users/prismaHelpers';

export type AgentApplySnapshotRow = {
  id: number;
  session_id: number | null;
  user_id: number;
  proposal_id: string;
  change_sets_json: string;
  snapshots_json: string;
  summary: string | null;
  applied_at: string;
  rolled_back_at: string | null;
};

export type InsertAgentApplySnapshotInput = {
  sessionId?: number;
  userId: number;
  proposalId: string;
  changeSetsJson: string;
  snapshotsJson: string;
  summary?: string;
};

const toIsoString = (value: Date | null | undefined): string =>
  value instanceof Date ? value.toISOString() : String(value ?? '');

const mapApplyRow = (row: {
  id: bigint;
  sessionId: bigint | null;
  userId: bigint;
  proposalId: string;
  changeSetsJson: string;
  snapshotsJson: string;
  summary: string | null;
  appliedAt: Date | null;
  rolledBackAt: Date | null;
}): AgentApplySnapshotRow => ({
  id: fromUserId(row.id),
  session_id: row.sessionId !== null ? fromUserId(row.sessionId) : null,
  user_id: fromUserId(row.userId),
  proposal_id: row.proposalId,
  change_sets_json: row.changeSetsJson,
  snapshots_json: row.snapshotsJson,
  summary: row.summary,
  applied_at: toIsoString(row.appliedAt),
  rolled_back_at: row.rolledBackAt ? toIsoString(row.rolledBackAt) : null,
});

export const insertAgentApplySnapshot = async (
  input: InsertAgentApplySnapshotInput,
): Promise<number> => {
  const row = await prisma().baseAiAgentApplySnapshot.create({
    data: {
      sessionId: input.sessionId !== undefined ? toUserId(input.sessionId) : null,
      userId: toUserId(input.userId),
      proposalId: input.proposalId,
      changeSetsJson: input.changeSetsJson,
      snapshotsJson: input.snapshotsJson,
      summary: input.summary ?? null,
    },
    select: { id: true },
  });

  return fromUserId(row.id);
};

export const getLatestAgentApplySnapshot = async (
  sessionId: number | undefined,
  userId: number,
): Promise<AgentApplySnapshotRow | null> => {
  const row = await prisma().baseAiAgentApplySnapshot.findFirst({
    where: {
      userId: toUserId(userId),
      rolledBackAt: null,
      ...(sessionId !== undefined ? { sessionId: toUserId(sessionId) } : {}),
    },
    orderBy: { appliedAt: 'desc' },
  });

  return row ? mapApplyRow(row) : null;
};

export const getAgentApplySnapshotById = async (
  applyId: number,
  userId: number,
): Promise<AgentApplySnapshotRow | null> => {
  const row = await prisma().baseAiAgentApplySnapshot.findFirst({
    where: {
      id: toUserId(applyId),
      userId: toUserId(userId),
    },
  });
  return row ? mapApplyRow(row) : null;
};

export const updateAgentApplySnapshotsJson = async (
  applyId: number,
  userId: number,
  snapshotsJson: string,
): Promise<boolean> => {
  const updated = await prisma().baseAiAgentApplySnapshot.updateMany({
    where: {
      id: toUserId(applyId),
      userId: toUserId(userId),
      rolledBackAt: null,
    },
    data: { snapshotsJson },
  });

  return updated.count > 0;
};

export const markAgentApplySnapshotRolledBack = async (
  applyId: number,
  userId: number,
): Promise<boolean> => {
  const updated = await prisma().baseAiAgentApplySnapshot.updateMany({
    where: {
      id: toUserId(applyId),
      userId: toUserId(userId),
      rolledBackAt: null,
    },
    data: { rolledBackAt: new Date() },
  });

  if (updated.count === 0) return false;
  const row = await getAgentApplySnapshotById(applyId, userId);
  return Boolean(row?.rolled_back_at);
};

export const listRecentAgentApplySnapshots = async (
  userId: number,
  sessionId?: number,
  limit = 5,
): Promise<AgentApplySnapshotRow[]> => {
  const rows = await prisma().baseAiAgentApplySnapshot.findMany({
    where: {
      userId: toUserId(userId),
      ...(sessionId !== undefined ? { sessionId: toUserId(sessionId) } : {}),
    },
    orderBy: { appliedAt: 'desc' },
    take: limit,
  });
  return rows.map(mapApplyRow);
};
