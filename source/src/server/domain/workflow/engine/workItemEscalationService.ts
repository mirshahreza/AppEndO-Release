import { WorkflowDomainError, isWorkflowDomainError } from '../errors';
import { listActiveWorkItems, getWorkItemById } from '../workItemRepository';
import { getNodeInstanceById } from '../workflowNodeInstanceRepository';
import { getWorkflowInstanceById } from '../workflowInstanceRepository';
import { getWorkflowRevisionById } from '../workflowRevisionRepository';
import { countEscalationExecutions } from '../workItemEscalationRepository';
import { loadNodeOutputsForInstance, parseJsonOrNull, parseVariables, buildEvaluationContext } from './evaluationContext';
import { evaluateMapping } from './expressionEvaluator';
import { resolveWorkItemCompletionPlan } from './workItemService';
import { applyEscalationReassign, applyEscalationRaisePriority, applyEscalationFailWorkflowNode, applyEscalationNotify, applyWorkItemCompletion } from './workItemContinuationApply';
import { parseNotificationUserId } from '../../../services/notifications/userNotification.service';
import { dispatchNotification, dispatchNotificationForRole } from '../../../services/notifications/notificationDispatch';
import { getBusinessHoursCalendar } from '../workflowBusinessHoursCalendarRepository';
import { addBusinessMilliseconds } from './businessHoursCalendar';
import type { WorkflowModel, WorkItemNodeDefinition, WorkItemEscalationStep } from '../awm/types';
import type { WorkItemRecord, WorkflowInstanceRecord, WorkflowNodeInstanceRecord } from '../types';

/**
 * Escalation runtime and scanner (doc 07 section 5, doc 03 section 17) — same "periodic invocation
 * by AppEndO Job infrastructure, plain importable function" pattern as `dueTimerScannerService.ts`
 * and `recoveryService.ts`.
 *
 * Design decision on recurrence (frozen contract is genuinely ambiguous here — `AFTER_OPEN_MS` is a
 * single fixed trigger instant, yet `maxExecutions >= 1` implies a step may run more than once):
 * this scanner treats each due-and-not-yet-exhausted step as eligible for exactly one new execution
 * attempt per scan pass once its due instant has passed, indefinitely, until `maxExecutions` is
 * reached — i.e. `maxExecutions` bounds how many independent (row-level) domain executions may ever
 * be created for that step, not a recurring re-trigger timer. What is NOT built: intra-execution
 * retry-delay scheduling per a step's own `retryPolicy` (doc 07 section 8's "a step's retry policy
 * governs failed executions of that same execution") — every execution here runs to a terminal
 * SUCCEEDED/FAILED synchronously within one scan pass; a `retryPolicy`-driven backoff between
 * scanner passes for the SAME execution row is a documented scope boundary, not a silent gap.
 */

const RACE_CODES = new Set(['WF_EXEC_WORK_ITEM_NOT_ACTIVE', 'WF_EXEC_STALE_STATE_VERSION', 'WF_EXEC_ENGINE_INVARIANT', 'WF_EXEC_INSTANCE_NOT_EXECUTABLE']);

function parseEscalationUserId(raw: string, stepKey: string): number {
  const userId = Number(raw);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new WorkflowDomainError('WF_EXEC_ASSIGNMENT_RESOLUTION_FAILED', `Escalation step "${stepKey}" REASSIGN_USER userId must be a positive integer user id string.`, { raw });
  }
  return userId;
}

async function runEscalationStep(
  workItem: WorkItemRecord,
  node: WorkflowNodeInstanceRecord,
  instance: WorkflowInstanceRecord,
  step: WorkItemEscalationStep,
  executionNumber: number,
): Promise<void> {
  switch (step.action.type) {
    case 'REASSIGN_USER': {
      const userId = parseEscalationUserId(step.action.userId, step.key);
      const evidence = { strategy: 'USER', resolvedType: 'USER', resolvedUserId: userId, resolutionReason: `escalation step "${step.key}" REASSIGN_USER` };
      await applyEscalationReassign({
        workItemId: workItem.id,
        expectedWorkItemStateVersion: workItem.stateVersion,
        newAssignmentEvidenceJson: JSON.stringify(evidence),
        policyStepKey: step.key,
        executionNumber,
        maxExecutions: step.maxExecutions,
      });
      return;
    }
    case 'REASSIGN_ROLE': {
      const evidence = { strategy: 'ROLE', resolvedType: 'ROLE', resolvedRoleId: step.action.roleId, resolutionReason: `escalation step "${step.key}" REASSIGN_ROLE` };
      await applyEscalationReassign({
        workItemId: workItem.id,
        expectedWorkItemStateVersion: workItem.stateVersion,
        newAssignmentEvidenceJson: JSON.stringify(evidence),
        policyStepKey: step.key,
        executionNumber,
        maxExecutions: step.maxExecutions,
      });
      return;
    }
    case 'RAISE_PRIORITY': {
      await applyEscalationRaisePriority({
        workItemId: workItem.id,
        expectedWorkItemStateVersion: workItem.stateVersion,
        requestedPriority: step.action.priority,
        policyStepKey: step.key,
        executionNumber,
        maxExecutions: step.maxExecutions,
      });
      return;
    }
    case 'COMPLETE_WITH_OUTCOME': {
      const nodeOutputs = await loadNodeOutputsForInstance(instance.id);
      const variables = parseVariables(instance.contextJson);
      const workflowInput = parseJsonOrNull(instance.inputJson);
      const evaluationContext = buildEvaluationContext({ workflowInput, variables, nodeOutputs, currentNodeInput: null });
      const output = evaluateMapping(step.action.output, evaluationContext);
      const plan = await resolveWorkItemCompletionPlan(workItem, step.action.outcomeKey, output);
      await applyWorkItemCompletion({
        workItemId: workItem.id,
        expectedWorkItemStateVersion: workItem.stateVersion,
        outcome: step.action.outcomeKey,
        outputJson: JSON.stringify(output),
        evidence: { kind: 'ESCALATION', policyStepKey: step.key, executionNumber, maxExecutions: step.maxExecutions },
        ...plan,
      });
      return;
    }
    case 'FAIL_WORKFLOW_NODE': {
      await applyEscalationFailWorkflowNode({
        workItemId: workItem.id,
        expectedWorkItemStateVersion: workItem.stateVersion,
        workflowInstanceId: instance.id,
        failingNodeInstanceId: node.id,
        nodeKey: node.semanticNodeKey,
        expectedNodeStateVersion: node.stateVersion,
        expectedInstanceStateVersion: instance.stateVersion,
        policyStepKey: step.key,
        executionNumber,
        maxExecutions: step.maxExecutions,
        errorCode: step.action.errorCode,
        safeMessage: step.action.safeMessage,
      });
      return;
    }
    case 'NOTIFY': {
      const nodeOutputs = await loadNodeOutputsForInstance(instance.id);
      const variables = parseVariables(instance.contextJson);
      const workflowInput = parseJsonOrNull(instance.inputJson);
      const evaluationContext = buildEvaluationContext({ workflowInput, variables, nodeOutputs, currentNodeInput: null });
      const mapped = evaluateMapping(step.action.input, evaluationContext) as Record<string, unknown>;
      const title = typeof mapped.title === 'string' && mapped.title.trim()
        ? mapped.title.trim()
        : `Work item "${workItem.titleText}" needs attention`;
      const body = typeof mapped.body === 'string'
        ? mapped.body
        : `Escalation step "${step.key}" fired for work item ${workItem.id}.`;
      const severity = typeof mapped.severity === 'string' ? mapped.severity : 'warning';
      const href = typeof mapped.href === 'string' ? mapped.href : null;
      let userId = parseNotificationUserId(mapped.userId) ?? workItem.claimedByUserId;
      let roleId = typeof mapped.roleId === 'string' ? mapped.roleId.trim() : '';
      if (!userId && !roleId && workItem.assignmentEvidenceJson) {
        try {
          const evidence = JSON.parse(workItem.assignmentEvidenceJson) as { resolvedType?: string; resolvedUserId?: number; resolvedRoleId?: string };
          if (evidence.resolvedType === 'USER' && typeof evidence.resolvedUserId === 'number') userId = evidence.resolvedUserId;
          else if (evidence.resolvedType === 'ROLE' && evidence.resolvedRoleId) roleId = evidence.resolvedRoleId;
        } catch {
          // Assignee fallback is best-effort; mapping may still supply a target.
        }
      }
      if (userId) {
        await dispatchNotification({ userId, title, body, severity, href, eventType: 'workflow.escalation', metadata: { workItemId: workItem.id, policyStepKey: step.key } });
      } else if (roleId) {
        const fanout = await dispatchNotificationForRole({ roleId, title, body, severity, href, eventType: 'workflow.escalation', metadata: { workItemId: workItem.id, policyStepKey: step.key } });
        if (fanout.created === 0) {
          throw new WorkflowDomainError('WF_EXEC_ASSIGNMENT_RESOLUTION_FAILED', `Escalation NOTIFY step "${step.key}" role "${roleId}" has no members.`, { policyStepKey: step.key, roleId });
        }
      } else {
        throw new WorkflowDomainError('WF_EXEC_ASSIGNMENT_RESOLUTION_FAILED', `Escalation NOTIFY step "${step.key}" needs input.userId, input.roleId, or a resolvable work-item assignee.`, { policyStepKey: step.key });
      }
      await applyEscalationNotify({
        workItemId: workItem.id,
        expectedWorkItemStateVersion: workItem.stateVersion,
        policyStepKey: step.key,
        executionNumber,
        maxExecutions: step.maxExecutions,
        evidenceJson: JSON.stringify({ title, userId, roleId: roleId || null }),
      });
      return;
    }
    /* istanbul ignore next -- exhaustiveness guard */
    default: {
      const exhaustive: never = step.action;
      throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `Unknown escalation action type: ${JSON.stringify(exhaustive)}`, {});
    }
  }
}

export type EscalationScanSummary = { workItemsScanned: number; stepsExecuted: number; stepsSkipped: number };

export async function scanAndRunDueEscalations(): Promise<EscalationScanSummary> {
  const now = Date.now();
  const active = await listActiveWorkItems();
  const summary: EscalationScanSummary = { workItemsScanned: 0, stepsExecuted: 0, stepsSkipped: 0 };

  // HWF-2.2 — fetched at most once per scan pass, and only if some step actually opts in, so a
  // deployment that never uses `respectBusinessHours` pays zero extra DB cost.
  let calendarPromise: ReturnType<typeof getBusinessHoursCalendar> | null = null;
  const resolveCalendar = () => {
    if (!calendarPromise) calendarPromise = getBusinessHoursCalendar();
    return calendarPromise;
  };

  for (const workItem of active) {
    const node = await getNodeInstanceById(workItem.nodeInstanceId);
    if (!node) continue;
    const instance = await getWorkflowInstanceById(node.workflowInstanceId);
    if (!instance || instance.status !== 'RUNNING') continue;
    const revision = await getWorkflowRevisionById(instance.workflowRevisionId);
    if (!revision) continue;
    const model = JSON.parse(revision.definitionJson) as WorkflowModel;
    const nodeDef = model.nodes.find((n) => n.key === node.semanticNodeKey) as WorkItemNodeDefinition | undefined;
    if (!nodeDef || nodeDef.kind !== 'WORK_ITEM' || !nodeDef.escalationPolicy?.steps.length) continue;
    summary.workItemsScanned += 1;

    const createdAtMs = workItem.createdAt ? new Date(workItem.createdAt).getTime() : now;
    const sortedSteps = [...nodeDef.escalationPolicy.steps].sort((a, b) => a.trigger.afterMs - b.trigger.afterMs || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

    for (const step of sortedSteps) {
      let dueAt = createdAtMs + step.trigger.afterMs;
      if (step.trigger.respectBusinessHours) {
        try {
          const calendar = await resolveCalendar();
          dueAt = addBusinessMilliseconds(calendar, new Date(createdAtMs), step.trigger.afterMs).getTime();
        } catch {
          // A misconfigured calendar (e.g. zero working days) must not crash the whole scan pass for
          // every other Work Item — skip this one step this pass; it becomes due again once the
          // calendar is fixed, same as any other transient scan-pass condition.
          summary.stepsSkipped += 1;
          continue;
        }
      }
      if (now < dueAt) continue;

      const existingCount = await countEscalationExecutions(workItem.id, step.key);
      if (existingCount >= step.maxExecutions) continue;

      // Re-check the Work Item is still active immediately before executing — it may have been
      // closed by a concurrent claim/complete/cancel, or by an earlier step in this same pass.
      const fresh = await getWorkItemById(workItem.id);
      if (!fresh || (fresh.status !== 'OPEN' && fresh.status !== 'CLAIMED')) break;

      try {
        await runEscalationStep(fresh, node, instance, step, existingCount + 1);
        summary.stepsExecuted += 1;
      } catch (error) {
        if (isWorkflowDomainError(error) && RACE_CODES.has(error.code)) {
          summary.stepsSkipped += 1;
          continue;
        }
        throw error;
      }
    }
  }

  return summary;
}
