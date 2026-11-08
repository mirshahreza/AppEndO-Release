import { prisma, toId, fromId, toIsoString, toNullableId } from './prismaHelpers';
import type { WorkItemTransitionRecord, WorkflowActorType, WorkItemEscalationActorType } from './types';

const mapWorkItemTransitionRecord = (row: {
  id: bigint;
  workItemId: bigint;
  fromStatus: string;
  toStatus: string;
  transitionType: string;
  actorType: string;
  actorId: bigint | null;
  reasonCode: string | null;
  evidenceJson: string | null;
  occurredAt: Date | null;
  workItemStateVersionAfter: number;
}): WorkItemTransitionRecord => ({
  id: fromId(row.id),
  workItemId: fromId(row.workItemId),
  fromStatus: row.fromStatus,
  toStatus: row.toStatus,
  transitionType: row.transitionType,
  actorType: row.actorType as WorkflowActorType | WorkItemEscalationActorType,
  actorId: toNullableId(row.actorId),
  reasonCode: row.reasonCode,
  evidenceJson: row.evidenceJson,
  occurredAt: toIsoString(row.occurredAt),
  workItemStateVersionAfter: row.workItemStateVersionAfter,
});

export type RecordWorkItemTransitionInput = {
  workItemId: number;
  fromStatus: string;
  toStatus: string;
  transitionType: string;
  actorType: WorkflowActorType | WorkItemEscalationActorType;
  actorId?: number | null;
  reasonCode?: string;
  evidenceJson?: string;
  workItemStateVersionAfter: number;
};

/** Append-only evidence row — no update method exists (immutable by construction). */
export async function recordWorkItemTransition(input: RecordWorkItemTransitionInput): Promise<WorkItemTransitionRecord> {
  const row = await prisma().workItemTransition.create({
    data: {
      workItemId: toId(input.workItemId),
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      transitionType: input.transitionType,
      actorType: input.actorType,
      actorId: input.actorId != null ? toId(input.actorId) : null,
      reasonCode: input.reasonCode ?? null,
      evidenceJson: input.evidenceJson ?? null,
      workItemStateVersionAfter: input.workItemStateVersionAfter,
    },
  });
  return mapWorkItemTransitionRecord(row);
}

export async function listWorkItemTransitions(workItemId: number): Promise<WorkItemTransitionRecord[]> {
  const rows = await prisma().workItemTransition.findMany({
    where: { workItemId: toId(workItemId) },
    orderBy: { occurredAt: 'asc' },
  });
  return rows.map(mapWorkItemTransitionRecord);
}
