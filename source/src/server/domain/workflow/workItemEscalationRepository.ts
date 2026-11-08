import { prisma, toId, fromId, toIsoString } from './prismaHelpers';
import { WorkflowDomainError } from './errors';
import { nextWorkItemStatus, type WorkItemCommand, type WorkItemStatus } from './transitions';
import type { WorkItemEscalationRecord, WorkItemEscalationStatus } from './types';

const mapWorkItemEscalationRecord = (row: {
  id: bigint;
  workItemId: bigint;
  policyStepKey: string;
  executionNumber: number;
  status: string;
  actionType: string;
  actorType: string;
  startedAt: Date | null;
  completedAt: Date | null;
  errorCode: string | null;
  evidenceJson: string | null;
  createdAt: Date | null;
}): WorkItemEscalationRecord => ({
  id: fromId(row.id),
  workItemId: fromId(row.workItemId),
  policyStepKey: row.policyStepKey,
  executionNumber: row.executionNumber,
  status: row.status as WorkItemEscalationStatus,
  actionType: row.actionType,
  actorType: row.actorType as 'SYSTEM_ESCALATION',
  startedAt: toIsoString(row.startedAt),
  completedAt: toIsoString(row.completedAt),
  errorCode: row.errorCode,
  evidenceJson: row.evidenceJson,
  createdAt: toIsoString(row.createdAt),
});

export type CreateEscalationExecutionInput = {
  workItemId: number;
  expectedWorkItemStateVersion: number;
  policyStepKey: string;
  executionNumber: number;
  actionType: string;
  workItemCommand: WorkItemCommand;
  evidenceJson?: string;
};

/**
 * Atomic co-write: creates one WorkItemEscalation execution row (unique
 * `(workItemId, policyStepKey, executionNumber)` replay fence, doc 03 section 17) and applies the
 * matching WorkItem transition in the same transaction, when the escalation and the Work Item
 * transition are one domain decision.
 */
export async function createEscalationExecutionWithWorkItemTransition(
  input: CreateEscalationExecutionInput,
): Promise<{ escalation: WorkItemEscalationRecord; workItemStateVersionAfter: number }> {
  return prisma().$transaction(async (tx) => {
    const workItem = await tx.workItem.findUniqueOrThrow({ where: { id: toId(input.workItemId) } });
    const nextStatus = nextWorkItemStatus(workItem.status as WorkItemStatus, input.workItemCommand);
    if (!nextStatus) {
      throw new WorkflowDomainError(
        'WF_EXEC_WORK_ITEM_NOT_ACTIVE',
        `Illegal Work Item command ${input.workItemCommand} from ${workItem.status}.`,
        input,
      );
    }

    const workItemUpdate = await tx.workItem.updateMany({
      where: { id: toId(input.workItemId), stateVersion: input.expectedWorkItemStateVersion },
      data: { status: nextStatus, stateVersion: { increment: 1 } },
    });
    if (workItemUpdate.count === 0) {
      throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_NOT_ACTIVE', 'WorkItem stateVersion is stale.', input);
    }

    const escalationRow = await tx.workItemEscalation.create({
      data: {
        workItemId: toId(input.workItemId),
        policyStepKey: input.policyStepKey,
        executionNumber: input.executionNumber,
        status: 'STARTED',
        actionType: input.actionType,
        actorType: 'SYSTEM_ESCALATION',
        evidenceJson: input.evidenceJson ?? null,
      },
    });

    return {
      escalation: mapWorkItemEscalationRecord(escalationRow),
      workItemStateVersionAfter: input.expectedWorkItemStateVersion + 1,
    };
  });
}

export async function getEscalationById(id: number): Promise<WorkItemEscalationRecord | undefined> {
  const row = await prisma().workItemEscalation.findUnique({ where: { id: toId(id) } });
  return row ? mapWorkItemEscalationRecord(row) : undefined;
}

/** Doc 03 section 17 `maxExecutions` gating — total executions ever created for one policy step, regardless of outcome. */
export async function countEscalationExecutions(workItemId: number, policyStepKey: string): Promise<number> {
  return prisma().workItemEscalation.count({ where: { workItemId: toId(workItemId), policyStepKey } });
}

export async function listEscalationsForWorkItem(workItemId: number): Promise<WorkItemEscalationRecord[]> {
  const rows = await prisma().workItemEscalation.findMany({ where: { workItemId: toId(workItemId) }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  return rows.map(mapWorkItemEscalationRecord);
}

/** CAS terminal update for an escalation execution's own STARTED -> SUCCEEDED|FAILED result (separate from the WorkItem transition it may have triggered). */
export async function completeEscalationExecution(
  id: number,
  outcome: 'SUCCEEDED' | 'FAILED',
  errorCode?: string,
): Promise<WorkItemEscalationRecord> {
  const result = await prisma().workItemEscalation.updateMany({
    where: { id: toId(id), status: 'STARTED' },
    data: { status: outcome, completedAt: new Date(), errorCode: errorCode ?? null },
  });
  if (result.count === 0) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'WorkItemEscalation is not STARTED (already terminal).', { id });
  }
  return (await getEscalationById(id))!;
}
