import { WorkflowDomainError } from './errors';
import type { PrismaTransactionClient } from './prismaHelpers';
import { toId } from './prismaHelpers';

/** SQL Server UNIQUE allows only one NULL in `base_workflow_waits.work_item_id` — never use Prisma updateMany/deleteMany on waits. */
async function deleteWorkflowWaitsForCascade(
  tx: PrismaTransactionClient,
  instanceIdList: readonly bigint[],
  workItemIds: readonly bigint[],
): Promise<void> {
  const parentWaits = await tx.workflowWait.findMany({
    where: { childInstanceId: { in: [...instanceIdList] } },
    select: { id: true },
  });
  for (const { id } of parentWaits) {
    await tx.$executeRaw`UPDATE base_workflow_waits SET child_instance_id = NULL WHERE id = ${id}`;
  }

  const waits = await tx.workflowWait.findMany({
    where: {
      OR: [
        { workflowInstanceId: { in: [...instanceIdList] } },
        ...(workItemIds.length > 0 ? [{ workItemId: { in: [...workItemIds] } }] : []),
      ],
    },
    select: { id: true },
  });

  for (const { id } of waits) {
    await tx.$executeRaw`DELETE FROM base_workflow_waits WHERE id = ${id}`;
  }
}

/**
 * FK-safe durable delete order for Workflow execution rows — aligned with
 * `scripts/cleanup-workflow-test-debris.ts` and `scripts/reset-all-workflows.ts`
 * (no ON DELETE CASCADE on Workflow tables).
 */
export async function deleteWorkflowInstancesCascade(
  tx: PrismaTransactionClient,
  instanceIds: readonly bigint[],
): Promise<void> {
  if (instanceIds.length === 0) {
    return;
  }

  const instanceIdList = [...instanceIds];

  const nodeIds = (
    await tx.workflowNodeInstance.findMany({
      where: { workflowInstanceId: { in: instanceIdList } },
      select: { id: true },
    })
  ).map((row) => row.id);

  const workItemRows = await tx.workItem.findMany({
    where: {
      OR: [
        { workflowInstanceId: { in: instanceIdList } },
        ...(nodeIds.length > 0 ? [{ nodeInstanceId: { in: nodeIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const workItemIds = workItemRows.map((row) => row.id);

  if (workItemIds.length > 0) {
    await tx.workItemEscalation.deleteMany({ where: { workItemId: { in: workItemIds } } });
    await tx.workItemTransition.deleteMany({ where: { workItemId: { in: workItemIds } } });
  }

  await deleteWorkflowWaitsForCascade(tx, instanceIdList, workItemIds);

  if (workItemIds.length > 0) {
    await tx.workItem.deleteMany({ where: { id: { in: workItemIds } } });
  }
  await tx.workItem.deleteMany({ where: { workflowInstanceId: { in: instanceIdList } } });

  if (nodeIds.length > 0) {
    await tx.workflowExecutionAttempt.deleteMany({ where: { nodeInstanceId: { in: nodeIds } } });
  }
  await tx.workflowExecutionAttempt.deleteMany({ where: { workflowInstanceId: { in: instanceIdList } } });
  await tx.workflowTrace.deleteMany({ where: { workflowInstanceId: { in: instanceIdList } } });
  await tx.workflowJoinArrival.deleteMany({ where: { workflowInstanceId: { in: instanceIdList } } });
  await tx.workflowNodeInstance.deleteMany({ where: { workflowInstanceId: { in: instanceIdList } } });
  await tx.workflowBranchToken.deleteMany({ where: { workflowInstanceId: { in: instanceIdList } } });
  await tx.workflowInstance.deleteMany({ where: { id: { in: instanceIdList } } });
}

/** Deletes every row owned by a workflow definition (instances, revisions, designer/simulation/validation artifacts). */
export async function deleteWorkflowDefinitionOwnedRows(
  tx: PrismaTransactionClient,
  definitionId: number,
  expectedDefinitionStateVersion: number,
): Promise<void> {
  const definitionIdBig = toId(definitionId);

  const definition = await tx.workflowDefinition.findUnique({ where: { id: definitionIdBig } });
  if (!definition) {
    throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowDefinition not found.', { workflowDefinitionId: definitionId });
  }
  if (definition.stateVersion !== expectedDefinitionStateVersion) {
    throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowDefinition stateVersion is stale.', {
      workflowDefinitionId: definitionId,
      expectedDefinitionStateVersion,
    });
  }
  if (definition.currentPublishedRevisionId !== null) {
    throw new WorkflowDomainError('WF_DEF_NOT_STARTABLE', 'Only unpublished workflows can be deleted.', { workflowDefinitionId: definitionId });
  }

  const revisionIds = (
    await tx.workflowRevision.findMany({
      where: { workflowDefinitionId: definitionIdBig },
      select: { id: true },
    })
  ).map((row) => row.id);

  const instanceIds = revisionIds.length > 0
    ? (
      await tx.workflowInstance.findMany({
        where: { workflowRevisionId: { in: revisionIds } },
        select: { id: true },
      })
    ).map((row) => row.id)
    : [];

  await deleteWorkflowInstancesCascade(tx, instanceIds);

  const revisionScope = revisionIds.length > 0 ? [{ sourceRevisionId: { in: revisionIds } }] : [];
  await tx.workflowSimulationRun.deleteMany({
    where: {
      OR: [
        { workflowDefinitionId: definitionIdBig },
        ...revisionScope,
      ],
    },
  });

  const revisionReportScope = revisionIds.length > 0 ? [{ revisionId: { in: revisionIds } }] : [];
  await tx.workflowValidationReport.deleteMany({
    where: {
      OR: [
        { workflowDefinitionId: definitionIdBig },
        ...revisionReportScope,
      ],
    },
  });

  const revisionViewScope = revisionIds.length > 0 ? [{ workflowRevisionId: { in: revisionIds } }] : [];
  await tx.workflowDesignerView.deleteMany({
    where: {
      OR: [
        { workflowDefinitionId: definitionIdBig },
        ...revisionViewScope,
      ],
    },
  });

  await tx.workflowDefinition.updateMany({
    where: { createdFromDefinitionId: definitionIdBig },
    data: { createdFromDefinitionId: null, createdFromRevisionId: null },
  });

  await tx.workflowDefinition.updateMany({
    where: { id: definitionIdBig },
    data: { currentPublishedRevisionId: null },
  });

  await tx.workflowRevision.deleteMany({ where: { workflowDefinitionId: definitionIdBig } });

  const deleted = await tx.workflowDefinition.deleteMany({
    where: { id: definitionIdBig, stateVersion: expectedDefinitionStateVersion },
  });
  if (deleted.count === 0) {
    throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowDefinition stateVersion is stale.', {
      workflowDefinitionId: definitionId,
      expectedDefinitionStateVersion,
    });
  }
}
