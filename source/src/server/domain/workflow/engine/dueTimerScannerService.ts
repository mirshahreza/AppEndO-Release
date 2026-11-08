import { getWorkflowInstanceById } from '../workflowInstanceRepository';
import { getWorkflowRevisionById } from '../workflowRevisionRepository';
import { getNodeInstanceById } from '../workflowNodeInstanceRepository';
import { listDueTimerWaits, listExpiredEventTimeoutWaits } from '../workflowWaitRepository';
import { applyWaitTerminalSelectEdgeContinuation } from './continuationApply';
import { resolveJoinTargetInfo } from './parallelResolution';
import { isWorkflowDomainError } from '../errors';
import type { WorkflowModel } from '../awm/types';
import type { WorkflowWaitRecord } from '../types';

/**
 * Due Timer Scanner (doc 06 section 10) — "identifies ACTIVE TIMER waits by durable due time.
 * Satisfaction uses expected wait version and owning-instance eligibility in the same engine
 * transaction and directly completes the owning DELAY node." Also covers timed WAIT_EVENT expiry
 * (doc 05 section 23's `EXPIRED` transition), which is timer-driven the same way. Intended to be
 * invoked periodically by AppEndO Job infrastructure, exposed as a plain importable function —
 * same "worker deployment topology is not semantic authority" pattern as
 * `recoveryService.ts`'s `scanAndRecoverExpiredLeases`.
 */

const RACE_CODES = new Set(['WF_EXEC_WAIT_NOT_ACTIVE', 'WF_EXEC_STALE_STATE_VERSION', 'WF_EXEC_ENGINE_INVARIANT', 'WF_EXEC_INSTANCE_NOT_EXECUTABLE']);

async function loadNodeDefinitionForWait(wait: WorkflowWaitRecord) {
  const node = await getNodeInstanceById(wait.owningNodeInstanceId);
  if (!node) return undefined;
  const instance = await getWorkflowInstanceById(node.workflowInstanceId);
  if (!instance || instance.status !== 'RUNNING') return undefined;
  const revision = await getWorkflowRevisionById(instance.workflowRevisionId);
  if (!revision) return undefined;
  const model = JSON.parse(revision.definitionJson) as WorkflowModel;
  const nodeDef = model.nodes.find((n) => n.key === node.semanticNodeKey);
  if (!nodeDef) return undefined;
  return { node, instance, model, nodeDef };
}

export type DueTimerScanSummary = {
  timerWaitsScanned: number;
  timerWaitsCompleted: number;
  timerWaitsSkipped: number;
  eventTimeoutsScanned: number;
  eventTimeoutsCompleted: number;
  eventTimeoutsSkipped: number;
};

export async function scanAndCompleteDueTimers(): Promise<DueTimerScanSummary> {
  const now = new Date();
  const summary: DueTimerScanSummary = { timerWaitsScanned: 0, timerWaitsCompleted: 0, timerWaitsSkipped: 0, eventTimeoutsScanned: 0, eventTimeoutsCompleted: 0, eventTimeoutsSkipped: 0 };

  const dueTimers = await listDueTimerWaits(now);
  summary.timerWaitsScanned = dueTimers.length;
  for (const wait of dueTimers) {
    const loaded = await loadNodeDefinitionForWait(wait);
    if (!loaded || loaded.nodeDef.kind !== 'DELAY') {
      summary.timerWaitsSkipped += 1;
      continue;
    }
    const edge = loaded.model.edges.find((e) => e.fromNodeKey === loaded.nodeDef.key && e.selector.type === 'UNCONDITIONAL');
    if (!edge) {
      summary.timerWaitsSkipped += 1;
      continue;
    }
    try {
      const joinInfo = resolveJoinTargetInfo(loaded.model, edge.toNodeKey);
      await applyWaitTerminalSelectEdgeContinuation({
        workflowInstanceId: loaded.instance.id,
        waitId: wait.id,
        waitType: 'TIMER',
        sourceNodeKey: loaded.nodeDef.key,
        expectedWaitStateVersion: wait.stateVersion,
        waitTerminalCommand: 'SATISFY',
        completingNodeInstanceId: loaded.node.id,
        expectedNodeStateVersion: loaded.node.stateVersion,
        nodeOutput: null,
        edgeKey: edge.key,
        targetNodeKey: edge.toNodeKey,
        targetIsJoin: joinInfo.targetIsJoin,
        join: joinInfo.join,
        sourceBranchTokenId: loaded.node.branchTokenId,
      });
      summary.timerWaitsCompleted += 1;
    } catch (error) {
      if (isWorkflowDomainError(error) && RACE_CODES.has(error.code)) {
        summary.timerWaitsSkipped += 1;
        continue;
      }
      throw error;
    }
  }

  const expiredEventWaits = await listExpiredEventTimeoutWaits(now);
  summary.eventTimeoutsScanned = expiredEventWaits.length;
  for (const wait of expiredEventWaits) {
    const loaded = await loadNodeDefinitionForWait(wait);
    if (!loaded || loaded.nodeDef.kind !== 'WAIT_EVENT' || !loaded.nodeDef.timeout) {
      summary.eventTimeoutsSkipped += 1;
      continue;
    }
    const outcomeKey = loaded.nodeDef.timeout.outcomeKey;
    const edge = loaded.model.edges.find((e) => e.fromNodeKey === loaded.nodeDef.key && e.selector.type === 'WAIT_TIMEOUT' && e.selector.outcomeKey === outcomeKey);
    if (!edge) {
      summary.eventTimeoutsSkipped += 1;
      continue;
    }
    try {
      const joinInfo = resolveJoinTargetInfo(loaded.model, edge.toNodeKey);
      await applyWaitTerminalSelectEdgeContinuation({
        workflowInstanceId: loaded.instance.id,
        waitId: wait.id,
        waitType: 'EVENT',
        sourceNodeKey: loaded.nodeDef.key,
        expectedWaitStateVersion: wait.stateVersion,
        waitTerminalCommand: 'EXPIRE',
        completingNodeInstanceId: loaded.node.id,
        expectedNodeStateVersion: loaded.node.stateVersion,
        nodeOutput: { timeoutOutcomeKey: outcomeKey },
        edgeKey: edge.key,
        targetNodeKey: edge.toNodeKey,
        targetIsJoin: joinInfo.targetIsJoin,
        join: joinInfo.join,
        sourceBranchTokenId: loaded.node.branchTokenId,
      });
      summary.eventTimeoutsCompleted += 1;
    } catch (error) {
      if (isWorkflowDomainError(error) && RACE_CODES.has(error.code)) {
        summary.eventTimeoutsSkipped += 1;
        continue;
      }
      throw error;
    }
  }

  return summary;
}
