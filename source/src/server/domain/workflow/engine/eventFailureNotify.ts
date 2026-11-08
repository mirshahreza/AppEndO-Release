import { prisma, fromId } from '../prismaHelpers';
import { ingestWorkflowEvent } from './eventIngressService';
import type { JsonValue } from '../awm/types';
import { logger } from '../../../../core/logging/Logger';

export const WORKFLOW_INSTANCE_FAILED_EVENT = 'workflow.instance.failed';

/**
 * Best-effort ERROR_TRIGGER substitute: emit a correlatable platform event after an instance
 * fails so any EVENT-start workflow bound to `workflow.instance.failed` (or a WAIT_EVENT with
 * the same name) can recover, notify, or open a Work Item. Must never throw into the fail path.
 */
export async function emitWorkflowInstanceFailedEvent(input: {
  workflowInstanceId: number;
  errorCode: string;
}): Promise<void> {
  try {
    const instance = await prisma().workflowInstance.findUnique({
      where: { id: BigInt(input.workflowInstanceId) },
      select: {
        id: true,
        revision: {
          select: {
            id: true,
            definition: { select: { id: true, key: true } },
          },
        },
      },
    });
    if (!instance) return;
    const definitionKey = instance.revision.definition.key;
    const payload: JsonValue = {
      instanceId: fromId(instance.id),
      revisionId: fromId(instance.revision.id),
      definitionId: fromId(instance.revision.definition.id),
      definitionKey,
      errorCode: input.errorCode,
    };
    await ingestWorkflowEvent({
      eventName: WORKFLOW_INSTANCE_FAILED_EVENT,
      eventSourceIdentity: 'workflow-engine',
      payload,
      correlationValue: definitionKey,
      deduplicationKey: `instance-failed:${fromId(instance.id)}`,
      leaseOwnerId: `fail-emit:${fromId(instance.id)}`,
    });
  } catch (error) {
    logger.warn('WorkflowEventFailureNotify', 'Failed to emit workflow.instance.failed', {
      workflowInstanceId: input.workflowInstanceId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
