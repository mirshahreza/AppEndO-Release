import { getWorkflowInstanceById } from '../workflowInstanceRepository';
import { getWorkflowRevisionById } from '../workflowRevisionRepository';
import { getNodeInstanceById } from '../workflowNodeInstanceRepository';
import { listActiveEventWaitsForCorrelation } from '../workflowWaitRepository';
import { getInboxById, claimForCorrelation, transitionInboxStatus, releaseInboxCorrelationClaim, listRecheckEligibleUnmatchedInbox } from '../workflowEventInboxRepository';
import { loadNodeOutputsForInstance, parseJsonOrNull, parseVariables, buildEvaluationContext } from './evaluationContext';
import { applyOutputAssignments } from './nodeExecution';
import { applyWaitTerminalSelectEdgeContinuation } from './continuationApply';
import { applySubflowCancelRegionContinuation } from './subflowContinuationApply';
import { resolveJoinTargetInfo } from './parallelResolution';
import { WorkflowDomainError, isWorkflowDomainError } from '../errors';
import type { WorkflowModel, JsonValue } from '../awm/types';
import type { WorkflowEventInboxRecord } from '../types';

/**
 * Event correlator (doc 06 section 9) — "Correlator claims EventInbox with lease/version fencing,
 * deterministically orders eligible matching ACTIVE waits and atomically satisfies at most one
 * wait. The selected wait's expected stateVersion, inbox expected version, wait SATISFIED
 * transition, inbox CORRELATED transition, classified event projection and continuation decision
 * are one transaction." Candidate selection (this module) is a plain read; the winning attempt
 * (`applyWaitTerminalSelectEdgeContinuation`'s `inboxCorrelation` leg) is the one atomic transaction.
 */

const DEFAULT_CORRELATION_LEASE_DURATION_MS = 30_000;

export type CorrelationOutcome = { inbox: WorkflowEventInboxRecord; matchedWaitId?: number; matchedNodeInstanceId?: number };

/** Releases a correlation claim with no match this pass — `RECEIVED` transitions to first-pass `UNMATCHED`; an already-`UNMATCHED` row (a recheck-sweep attempt) just has its lease cleared, since no `UNMATCHED → UNMATCHED` transition exists (doc 03 section 23: recheck stays eligible until the bound is exhausted). */
async function releaseUnmatched(claimed: WorkflowEventInboxRecord): Promise<WorkflowEventInboxRecord> {
  if (claimed.status === 'RECEIVED') {
    return transitionInboxStatus(claimed.id, claimed.stateVersion, 'RECHECK_EXHAUSTED');
  }
  return releaseInboxCorrelationClaim(claimed.id, claimed.stateVersion);
}

export async function correlateInboxEntry(inboxId: number, leaseOwnerId: string, leaseDurationMs = DEFAULT_CORRELATION_LEASE_DURATION_MS): Promise<CorrelationOutcome> {
  const before = await getInboxById(inboxId);
  if (!before) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'WorkflowEventInbox not found.', { inboxId });
  }
  const claimed = await claimForCorrelation(inboxId, before.stateVersion, leaseOwnerId, leaseDurationMs);

  if (!claimed.correlationValueHash) {
    // No correlation value was supplied at ingress — cannot match any EVENT wait (they always require one).
    return { inbox: await releaseUnmatched(claimed) };
  }

  const candidates = await listActiveEventWaitsForCorrelation(claimed.eventName, claimed.correlationValueHash);
  const payload = claimed.payloadJson != null ? (JSON.parse(claimed.payloadJson) as JsonValue) : null;

  let candidateOrderPosition = -1;
  for (const wait of candidates) {
    candidateOrderPosition += 1;
    const node = await getNodeInstanceById(wait.owningNodeInstanceId);
    if (!node) continue;
    const instance = await getWorkflowInstanceById(node.workflowInstanceId);
    if (!instance || instance.status !== 'RUNNING') continue;
    const revision = await getWorkflowRevisionById(instance.workflowRevisionId);
    if (!revision) continue;
    const model = JSON.parse(revision.definitionJson) as WorkflowModel;
    const nodeDef = model.nodes.find((n) => n.key === node.semanticNodeKey);
    if (!nodeDef) continue;

    if (nodeDef.kind === 'WAIT_EVENT') {
      const edge = model.edges.find((e) => e.fromNodeKey === nodeDef.key && e.selector.type === 'UNCONDITIONAL');
      if (!edge) continue;

      const nodeOutputs = await loadNodeOutputsForInstance(instance.id);
      const variables = parseVariables(instance.contextJson);
      const workflowInput = parseJsonOrNull(instance.inputJson);
      const evaluationContext = { ...buildEvaluationContext({ workflowInput, variables, nodeOutputs, currentNodeInput: null }), currentEvent: payload };
      const updatedVariables = nodeDef.outputAssignments?.length ? applyOutputAssignments(nodeDef.outputAssignments, evaluationContext, nodeDef.key, payload) : undefined;

      try {
        const joinInfo = resolveJoinTargetInfo(model, edge.toNodeKey);
        await applyWaitTerminalSelectEdgeContinuation({
          workflowInstanceId: instance.id,
          waitId: wait.id,
          waitType: 'EVENT',
          sourceNodeKey: nodeDef.key,
          expectedWaitStateVersion: wait.stateVersion,
          waitTerminalCommand: 'SATISFY',
          resultPayloadJson: claimed.payloadJson ?? undefined,
          completingNodeInstanceId: node.id,
          expectedNodeStateVersion: node.stateVersion,
          nodeOutput: payload,
          edgeKey: edge.key,
          targetNodeKey: edge.toNodeKey,
          updatedVariables: updatedVariables ? { variables: updatedVariables, expectedInstanceStateVersion: instance.stateVersion } : undefined,
          inboxCorrelation: {
            inboxId: claimed.id,
            expectedInboxStateVersion: claimed.stateVersion,
            eventName: claimed.eventName,
            correlationEncoderVersion: wait.correlationEncoderVersion ?? 'UNKNOWN',
            correlationHashAlgorithm: wait.correlationHashAlgorithm ?? 'UNKNOWN',
            candidateOrderPosition,
          },
          targetIsJoin: joinInfo.targetIsJoin,
          join: joinInfo.join,
          sourceBranchTokenId: node.branchTokenId,
        });
        return { inbox: (await getInboxById(claimed.id))!, matchedWaitId: wait.id, matchedNodeInstanceId: node.id };
      } catch (error) {
        if (isWorkflowDomainError(error) && ['WF_EXEC_WAIT_NOT_ACTIVE', 'WF_EXEC_STALE_STATE_VERSION', 'WF_EXEC_ENGINE_INVARIANT', 'WF_EXEC_INSTANCE_NOT_EXECUTABLE'].includes(error.code)) {
          continue; // raced away (another correlator, a concurrent timeout, or a concurrent suspend) — try the next deterministically-ordered candidate.
        }
        throw error;
      }
    }

    // p-99/WFT-9 — Cancel Region: a SUBFLOW's optional `cancelEvent` correlation matched. Unlike the
    // WAIT_EVENT branch above, winning here does NOT complete/succeed the node — it cancels the
    // child instance (cascaded) and routes the PARENT instance through the CANCEL_REGION edge,
    // non-interrupting for the rest of that instance.
    if (nodeDef.kind === 'SUBFLOW' && nodeDef.cancelEvent && wait.childInstanceId != null) {
      const edge = model.edges.find((e) => e.fromNodeKey === nodeDef.key && e.selector.type === 'CANCEL_REGION');
      if (!edge) continue;

      try {
        const joinInfo = resolveJoinTargetInfo(model, edge.toNodeKey);
        await applySubflowCancelRegionContinuation({
          workflowInstanceId: instance.id,
          sourceNodeKey: nodeDef.key,
          waitId: wait.id,
          expectedWaitStateVersion: wait.stateVersion,
          childInstanceId: wait.childInstanceId,
          cancellingNodeInstanceId: node.id,
          expectedNodeStateVersion: node.stateVersion,
          eventPayload: payload,
          edgeKey: edge.key,
          targetNodeKey: edge.toNodeKey,
          targetIsJoin: joinInfo.targetIsJoin,
          join: joinInfo.join,
          sourceBranchTokenId: node.branchTokenId,
          inboxCorrelation: {
            inboxId: claimed.id,
            expectedInboxStateVersion: claimed.stateVersion,
            eventName: claimed.eventName,
            correlationEncoderVersion: wait.correlationEncoderVersion ?? 'UNKNOWN',
            correlationHashAlgorithm: wait.correlationHashAlgorithm ?? 'UNKNOWN',
            candidateOrderPosition,
          },
        });
        return { inbox: (await getInboxById(claimed.id))!, matchedWaitId: wait.id, matchedNodeInstanceId: node.id };
      } catch (error) {
        if (isWorkflowDomainError(error) && ['WF_EXEC_WAIT_NOT_ACTIVE', 'WF_EXEC_STALE_STATE_VERSION', 'WF_EXEC_ENGINE_INVARIANT', 'WF_EXEC_INSTANCE_NOT_EXECUTABLE'].includes(error.code)) {
          continue; // raced away — most commonly the child instance completed normally first.
        }
        throw error;
      }
    }
  }

  return { inbox: await releaseUnmatched(claimed) };
}

export type RecheckSweepSummary = { scanned: number; correlated: number; stillUnmatched: number; skipped: number };

/** Bounded-recheck sweep (doc 03 section 23, doc 11 section 8) — re-attempts correlation for every `UNMATCHED` inbox row still within its recheck window, covering the race where the event arrived before its matching wait was created. Intended for periodic invocation by AppEndO Job infrastructure, same pattern as `dueTimerScannerService.ts`/`recoveryService.ts`. */
export async function scanAndRecheckUnmatchedEvents(leaseOwnerId: string): Promise<RecheckSweepSummary> {
  const eligible = await listRecheckEligibleUnmatchedInbox(new Date());
  const summary: RecheckSweepSummary = { scanned: eligible.length, correlated: 0, stillUnmatched: 0, skipped: 0 };
  for (const row of eligible) {
    try {
      const outcome = await correlateInboxEntry(row.id, leaseOwnerId);
      if (outcome.matchedWaitId !== undefined) summary.correlated += 1;
      else summary.stillUnmatched += 1;
    } catch (error) {
      if (isWorkflowDomainError(error) && error.code === 'WF_EXEC_ENGINE_INVARIANT') {
        summary.skipped += 1;
        continue;
      }
      throw error;
    }
  }
  return summary;
}
