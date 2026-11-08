import { prisma } from '../prismaHelpers';
import { startWorkflowInstance } from './startService';
import type { JsonValue, WorkflowModel } from '../awm/types';
import { logger } from '../../../../core/logging/Logger';

export type EventStartFanoutSummary = { scanned: number; started: number; skipped: number; failed: number };

const parseEventStart = (definitionJson: string): { eventName: string } | null => {
  try {
    const model = JSON.parse(definitionJson) as WorkflowModel;
    if (model.start?.type !== 'EVENT') return null;
    const eventName = typeof model.start.eventName === 'string' ? model.start.eventName.trim() : '';
    return eventName ? { eventName } : null;
  } catch {
    return null;
  }
};

/**
 * Workflow-scoped event bus subscriber: every ACTIVE published definition whose start type is
 * EVENT and whose authored `eventName` matches is started with the event payload as workflow input.
 * Failures in one subscriber must not block the others (or WAIT_EVENT correlation that already ran).
 */
export async function startWorkflowsForEvent(input: {
  eventName: string;
  payload: JsonValue;
  excludeWorkflowDefinitionId?: number;
}): Promise<EventStartFanoutSummary> {
  const definitions = await prisma().workflowDefinition.findMany({
    where: { lifecycleStatus: 'ACTIVE', currentPublishedRevisionId: { not: null } },
    select: {
      id: true,
      currentPublishedRevision: { select: { id: true, definitionJson: true } },
    },
  });

  const summary: EventStartFanoutSummary = { scanned: definitions.length, started: 0, skipped: 0, failed: 0 };
  for (const definition of definitions) {
    if (input.excludeWorkflowDefinitionId !== undefined && Number(definition.id) === input.excludeWorkflowDefinitionId) {
      summary.skipped += 1;
      continue;
    }
    const revision = definition.currentPublishedRevision;
    if (!revision) {
      summary.skipped += 1;
      continue;
    }
    const start = parseEventStart(revision.definitionJson);
    if (!start || start.eventName !== input.eventName) {
      summary.skipped += 1;
      continue;
    }
    try {
      await startWorkflowInstance({
        workflowRevisionId: Number(revision.id),
        input: input.payload,
        startedByType: 'SYSTEM',
        startType: 'EVENT',
      });
      summary.started += 1;
    } catch (error) {
      summary.failed += 1;
      logger.warn('WorkflowEventStartFanout', 'Failed to start EVENT-bound workflow', {
        definitionId: Number(definition.id),
        eventName: input.eventName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return summary;
}
