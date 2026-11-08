import { getWorkflowInstanceById } from '../workflowInstanceRepository';
import { getWorkflowRevisionById } from '../workflowRevisionRepository';
import { getNodeInstanceById } from '../workflowNodeInstanceRepository';
import { listActiveSubflowWaits } from '../workflowWaitRepository';
import { loadNodeOutputsForInstance, parseJsonOrNull, parseVariables, buildEvaluationContext } from './evaluationContext';
import { applyOutputAssignments, outgoingEdgesOf } from './nodeExecution';
import { resolveJoinTargetInfo } from './parallelResolution';
import { applySubflowSuccessContinuation, applySubflowUnhandledFailureContinuation } from './subflowContinuationApply';
import { isWorkflowDomainError } from '../errors';
import type { WorkflowModel, SubflowNodeDefinition, JsonValue } from '../awm/types';

/**
 * Subflow Continuation Scanner (doc 05 section 31, doc 06 section 10) — "Child completion satisfies
 * the exact ACTIVE SUBFLOW wait... only through expected-version parent continuation logic." Same
 * "periodic invocation by AppEndO Job infrastructure, plain importable function" pattern as
 * `dueTimerScannerService.ts`/`recoveryService.ts`/`workItemEscalationService.ts`'s scanners — child
 * instances are dispatched independently by the Node Executor, so nothing synchronously notifies
 * the parent when a child reaches a terminal state; this scanner is what closes that loop.
 *
 * "Parent SUSPENDED state is ineligible for child-result application... after parent Resume the
 * subflow continuation scanner re-evaluates the exact linked child and applies the result once" —
 * implemented by simply skipping (not erroring) any wait whose parent instance is not currently
 * RUNNING; a later scan naturally picks it up once the parent resumes, with no separate "on resume"
 * trigger needed.
 */

const RACE_CODES = new Set(['WF_EXEC_WAIT_NOT_ACTIVE', 'WF_EXEC_STALE_STATE_VERSION', 'WF_EXEC_ENGINE_INVARIANT', 'WF_EXEC_INSTANCE_NOT_EXECUTABLE']);

export type SubflowScanSummary = { scanned: number; satisfiedParents: number; failedParents: number; skipped: number };

export async function scanAndApplySubflowResults(): Promise<SubflowScanSummary> {
  const activeWaits = await listActiveSubflowWaits();
  const summary: SubflowScanSummary = { scanned: 0, satisfiedParents: 0, failedParents: 0, skipped: 0 };

  for (const wait of activeWaits) {
    if (wait.childInstanceId == null) continue;
    const child = await getWorkflowInstanceById(wait.childInstanceId);
    if (!child) continue;
    if (child.status !== 'SUCCEEDED' && child.status !== 'FAILED' && child.status !== 'CANCELLED') continue; // not yet terminal

    const parentNode = await getNodeInstanceById(wait.owningNodeInstanceId);
    if (!parentNode) continue;
    const parentInstance = await getWorkflowInstanceById(parentNode.workflowInstanceId);
    if (!parentInstance || parentInstance.status !== 'RUNNING') {
      // SUSPENDED or already-terminal parent (doc 05 section 31) — including "parent cancellation
      // already won" (parent CANCELLED, wait may still show ACTIVE until its own cleanup sweep
      // catches up): late child notification is evidence only, never applied here.
      summary.skipped += 1;
      continue;
    }

    const revision = await getWorkflowRevisionById(parentInstance.workflowRevisionId);
    if (!revision) continue;
    const model = JSON.parse(revision.definitionJson) as WorkflowModel;
    const nodeDef = model.nodes.find((n) => n.key === parentNode.semanticNodeKey) as SubflowNodeDefinition | undefined;
    if (!nodeDef || nodeDef.kind !== 'SUBFLOW') continue;

    summary.scanned += 1;

    try {
      if (child.status === 'SUCCEEDED') {
        const edge = outgoingEdgesOf(model, nodeDef.key).find((e) => e.selector.type === 'UNCONDITIONAL');
        if (!edge) {
          summary.skipped += 1;
          continue;
        }
        const childOutput: JsonValue = child.outputJson != null ? (JSON.parse(child.outputJson) as JsonValue) : null;

        const nodeOutputs = await loadNodeOutputsForInstance(parentInstance.id);
        const variables = parseVariables(parentInstance.contextJson);
        const workflowInput = parseJsonOrNull(parentInstance.inputJson);
        const evaluationContext = buildEvaluationContext({ workflowInput, variables, nodeOutputs, currentNodeInput: null });
        const updatedVariables = nodeDef.outputAssignments?.length ? applyOutputAssignments(nodeDef.outputAssignments, evaluationContext, nodeDef.key, childOutput) : undefined;
        const joinInfo = resolveJoinTargetInfo(model, edge.toNodeKey);

        await applySubflowSuccessContinuation({
          workflowInstanceId: parentInstance.id,
          sourceNodeKey: nodeDef.key,
          waitId: wait.id,
          expectedWaitStateVersion: wait.stateVersion,
          completingNodeInstanceId: parentNode.id,
          expectedNodeStateVersion: parentNode.stateVersion,
          nodeOutput: childOutput,
          edgeKey: edge.key,
          targetNodeKey: edge.toNodeKey,
          targetIsJoin: joinInfo.targetIsJoin,
          join: joinInfo.join,
          sourceBranchTokenId: parentNode.branchTokenId,
          updatedVariables: updatedVariables ? { variables: updatedVariables, expectedInstanceStateVersion: parentInstance.stateVersion } : undefined,
        });
        summary.satisfiedParents += 1;
      } else {
        // FAILED or CANCELLED-not-caused-by-parent-cancellation (doc 05 section 31: classified
        // WF_EXEC_SUBFLOW_FAILED / WF_EXEC_SUBFLOW_CANCELLED respectively) — the parent-RUNNING
        // check above already excludes "parent cancellation already won". Neither
        // `WorkflowNodeInstance` nor this scanner's summary carries that specific classification
        // durably: no error-code/message column exists on `WorkflowNodeInstance` (same gap Slice 5
        // already found and documented for FAIL-node errorCode/safeMessage), and durable trace
        // emission is Slice 10. `child.status` itself (SUCCEEDED/FAILED/CANCELLED, already durable
        // on the child `WorkflowInstance` row) is the honest evidence available today.
        await applySubflowUnhandledFailureContinuation({
          workflowInstanceId: parentInstance.id,
          sourceNodeKey: nodeDef.key,
          waitId: wait.id,
          expectedWaitStateVersion: wait.stateVersion,
          failingNodeInstanceId: parentNode.id,
          expectedNodeStateVersion: parentNode.stateVersion,
          expectedInstanceStateVersion: parentInstance.stateVersion,
          childInstanceStatus: child.status as 'FAILED' | 'CANCELLED',
        });
        summary.failedParents += 1;
      }
    } catch (error) {
      if (isWorkflowDomainError(error) && RACE_CODES.has(error.code)) {
        summary.skipped += 1;
        continue;
      }
      throw error;
    }
  }

  return summary;
}
