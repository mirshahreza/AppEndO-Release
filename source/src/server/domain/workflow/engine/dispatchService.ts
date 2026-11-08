import { prisma } from '../prismaHelpers';
import { WorkflowDomainError, isWorkflowDomainError } from '../errors';
import { getWorkflowInstanceById } from '../workflowInstanceRepository';
import { getWorkflowRevisionById } from '../workflowRevisionRepository';
import { getWorkflowDefinitionById, findWorkflowDefinitionByScopeAndKey } from '../workflowDefinitionRepository';
import { getNodeInstanceById, claimReadyOrRetryingNode, renewNodeLease } from '../workflowNodeInstanceRepository';
import { loadNodeOutputsForInstance, parseJsonOrNull, parseVariables } from './evaluationContext';
import { buildEvaluationContext } from './evaluationContext';
import { emitTraceAutoRevision } from './traceEmission';
import {
  evaluateDecisionNode,
  evaluateSwitchNode,
  evaluateEndNode,
  evaluateFailNode,
  evaluateDelayNode,
  evaluateWaitEventNode,
  evaluateParallelSplitNode,
  evaluateParallelJoinNode,
  evaluateWorkItemCreation,
  evaluateForEachItems,
  evaluateForEachJoinSatisfied,
  applyOutputAssignments,
  outgoingEdgesOf,
  successEdgeOf,
  errorEdgeOf,
  describeEdgeSelection,
  evaluateBooleanExpression,
  type ForEachItemResult,
} from './nodeExecution';
import { evaluateMapping, evaluateExpression } from './expressionEvaluator';
import { encodeCorrelationValue } from './eventCorrelation';
import { resolveWorkflowSecretFromEnv, applySecretReferenceFields } from './secretResolution';
import { resolveSplitJoin, resolveJoinTargetInfo } from './parallelResolution';
import {
  resolveActionProviderForNode,
  resolveEffectiveRetryPolicy,
  beginActionAttempt,
  invokeActionExecutorWithDeadline,
  matchesRetryPolicy,
  findMatchingRetrySelectorIdentity,
  attemptTerminalPatchForFailure,
  applyAttemptSuccessContinuation,
  applyAttemptRetryContinuation,
  applyAttemptUnhandledFailureContinuation,
  applyAttemptCaughtFailureContinuation,
  computeRetryDelayMs,
} from './attemptService';
import {
  applySelectEdgeContinuation,
  applyCompleteInstanceContinuation,
  applyFailInstanceContinuation,
  applyCreateWaitContinuation,
  applyStartParallelContinuation,
  applyCreateWorkItemContinuation,
} from './continuationApply';
import { assertRevisionIsStartable } from './startService';
import { applyCreateSubflowContinuation, computeSubflowAncestorDepth } from './subflowContinuationApply';
import { resolveSameAsWorkItemAssignment, resolveRoundRobinAssignment, resolveShortestQueueAssignment } from './workItemService';
import { resolveActiveDelegate } from '../workItemDelegationRuleRepository';
import { runSagaCompensationForFailedInstance } from './sagaCompensationService';
import { logger } from '../../../../core/logging/Logger';
import type { WorkflowModel, ActionNodeDefinition, ForEachNodeDefinition, LoopNodeDefinition, DelayNodeDefinition, WaitEventNodeDefinition, WorkItemNodeDefinition, SubflowNodeDefinition, JsonValue } from '../awm/types';
import type { WorkflowInstanceRecord, WorkflowNodeInstanceRecord, WorkflowRevisionRecord } from '../types';
import type { ContinuationDecision } from './continuationDecision';

/**
 * The Node Executor / dispatcher (doc 06 sections 2, 3, 4, 16) — claims exactly one eligible node
 * occurrence and drives it to a durable outcome. Slice 5 dispatched `ACTION`, `DECISION`, `SWITCH`,
 * `END` and `FAIL`; Slice 6 added `DELAY` and `WAIT_EVENT` (wait *creation* only — satisfaction is
 * driven externally by `dueTimerScannerService.ts`/`eventCorrelationService.ts`, doc 05 section 28:
 * "does not put the node back on the Node Executor queue"); Slice 7 added `PARALLEL_SPLIT` and
 * `PARALLEL_JOIN` (doc 05 sections 5, 22, 32) — a `PARALLEL_JOIN` node is never claimed while
 * `PENDING`, it becomes `READY` only via a winning join-arrival transaction, but once `READY` it
 * dispatches through this same switch like any other node; Slice 8 added `WORK_ITEM` *creation*
 * (completion driven by `workItemService.ts`'s Claim/Complete commands or
 * `workItemEscalationService.ts`'s escalation actions, doc 07); Slice 9 adds `SUBFLOW` *creation*
 * (child instance start — completion is driven externally by
 * `subflowContinuationService.ts`'s Subflow Continuation Scanner, the same "does not put the node
 * back on the queue" shape as every other wait-producing node kind, doc 05 section 31). This makes
 * the dispatch switch exhaustive over every `WorkflowNodeDefinition` kind (doc 05 section 2).
 */

/**
 * `RETRY_SCHEDULED` is deliberately not a `ContinuationDecision` member: doc 06 section 15's closed
 * union describes graph-continuation outcomes for a *completing* node. Scheduling a retry commits
 * no edge selection and touches no downstream node — the node simply returns to `RETRYING` — so it
 * is a distinct dispatch-level outcome, not a continuation decision.
 */
export type DispatchResult = ContinuationDecision | { kind: 'RETRY_SCHEDULED'; nextEligibleAt: string };

export type DispatchOutcome =
  | { status: 'DISPATCHED'; decision: DispatchResult }
  | { status: 'NOT_ELIGIBLE'; reason: string };

const DEFAULT_LEASE_DURATION_MS = 30_000;

/** WFV2-14 — best-effort trigger, called right after any transaction that may have just failed the instance; never lets a compensation bug affect the caller's own dispatch outcome. */
async function triggerSagaCompensation(workflowInstanceId: number): Promise<void> {
  try {
    await runSagaCompensationForFailedInstance(workflowInstanceId);
  } catch (error) {
    logger.error('SagaCompensation', `Saga compensation pass threw for instance ${workflowInstanceId}: ${error instanceof Error ? error.message : String(error)}`, { workflowInstanceId });
  }
}

export async function dispatchNode(input: { nodeInstanceId: number; leaseOwnerId: string; leaseDurationMs?: number }): Promise<DispatchOutcome> {
  const existingNode = await getNodeInstanceById(input.nodeInstanceId);
  if (!existingNode) {
    throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowNodeInstance not found.', { nodeInstanceId: input.nodeInstanceId });
  }

  const instance = await getWorkflowInstanceById(existingNode.workflowInstanceId);
  if (!instance) {
    throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'Owning WorkflowInstance not found.', { workflowInstanceId: existingNode.workflowInstanceId });
  }
  // Doc 06 section 16 dispatcher eligibility: owning instance RUNNING; node READY or due RETRYING; no unexpired lease.
  if (instance.status !== 'RUNNING') {
    return { status: 'NOT_ELIGIBLE', reason: 'INSTANCE_NOT_EXECUTABLE' };
  }

  let claimed;
  try {
    claimed = await claimReadyOrRetryingNode(input.nodeInstanceId, existingNode.stateVersion, input.leaseOwnerId, input.leaseDurationMs ?? DEFAULT_LEASE_DURATION_MS);
  } catch (error) {
    if (isWorkflowDomainError(error) && (error.code === 'WF_EXEC_STALE_STATE_VERSION' || error.code === 'WF_EXEC_NODE_NOT_ELIGIBLE')) {
      return { status: 'NOT_ELIGIBLE', reason: 'ALREADY_WON_OR_INELIGIBLE' };
    }
    throw error;
  }

  // `NODE_CLAIMED` trace evidence — its own small transaction right after the claim CAS commits, not
  // co-atomic with it (same documented trade-off as `attemptService.ts`'s `ACTION_RESOLVED`/
  // `ACTION_ATTEMPT_STARTED`: this is start-of-processing evidence, not the terminal fact the claim
  // itself causes).
  await prisma().$transaction(async (tx) => {
    await emitTraceAutoRevision(tx, {
      workflowInstanceId: instance.id,
      nodeInstanceId: claimed.id,
      traceType: 'NODE_CLAIMED',
      actorType: 'SYSTEM',
      corePayload: { nodeKey: claimed.semanticNodeKey },
    });
  });

  const decision = await dispatchClaimedNode(claimed, instance, false, input.leaseOwnerId, input.leaseDurationMs ?? DEFAULT_LEASE_DURATION_MS);
  return { status: 'DISPATCHED', decision };
}

/**
 * Processes an already-claimed (status `RUNNING`, lease held) node occurrence. Shared by the normal
 * claim path above and `recoveryService.ts`'s non-ACTION lease-reclaim path — both start from a node
 * that is already durably `RUNNING` under this caller's lease; the only difference is who performed
 * the claim/reclaim CAS.
 */
export async function dispatchClaimedNode(
  claimed: WorkflowNodeInstanceRecord,
  instance: WorkflowInstanceRecord,
  forceNewInvocation = false,
  leaseOwnerId = claimed.leaseOwnerId ?? 'unknown-lease-owner',
  leaseDurationMs = DEFAULT_LEASE_DURATION_MS,
): Promise<DispatchResult> {
  const revision = await getWorkflowRevisionById(instance.workflowRevisionId);
  if (!revision) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'Pinned WorkflowRevision not found for a RUNNING instance.', { workflowRevisionId: instance.workflowRevisionId });
  }
  const model = JSON.parse(revision.definitionJson) as WorkflowModel;
  const nodeDef = model.nodes.find((n) => n.key === claimed.semanticNodeKey);
  if (!nodeDef) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `Semantic node "${claimed.semanticNodeKey}" is absent from the pinned model.`, { semanticNodeKey: claimed.semanticNodeKey });
  }

  const nodeOutputs = await loadNodeOutputsForInstance(instance.id);
  const variables = parseVariables(instance.contextJson);
  const workflowInput = parseJsonOrNull(instance.inputJson);
  const evaluationContext = buildEvaluationContext({ workflowInput, variables, nodeOutputs, currentNodeInput: null });

  switch (nodeDef.kind) {
    case 'DECISION': {
      const decision = evaluateDecisionNode(nodeDef, outgoingEdgesOf(model, nodeDef.key), evaluationContext);
      if (decision.kind === 'START_PARALLEL') {
        const joinNodeKey = resolveSplitJoin(model, nodeDef.key);
        const edgesByKey = new Map(model.edges.map((e) => [e.key, e]));
        await applyStartParallelContinuation({
          workflowInstanceId: instance.id,
          splitNodeInstanceId: claimed.id,
          expectedNodeStateVersion: claimed.stateVersion,
          splitNodeKey: nodeDef.key,
          joinNodeKey,
          branches: decision.branches.map((b) => ({ edgeKey: b.edgeKey, toNodeKey: edgesByKey.get(b.edgeKey)!.toNodeKey })),
        });
        return decision;
      }
      await applySelectEdgeWithJoinResolution(model, instance, claimed, decision, nodeDef.key, nodeDef.mode);
      return decision;
    }
    case 'SWITCH': {
      const decision = evaluateSwitchNode(nodeDef, outgoingEdgesOf(model, nodeDef.key), evaluationContext);
      await applySelectEdgeWithJoinResolution(model, instance, claimed, decision, nodeDef.key);
      return decision;
    }
    case 'PARALLEL_SPLIT': {
      const decision = evaluateParallelSplitNode(nodeDef, outgoingEdgesOf(model, nodeDef.key));
      if (decision.kind !== 'START_PARALLEL') throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'evaluateParallelSplitNode returned a non-START_PARALLEL decision.', {});
      const joinNodeKey = resolveSplitJoin(model, nodeDef.key);
      const edgesByKey = new Map(model.edges.map((e) => [e.key, e]));
      await applyStartParallelContinuation({
        workflowInstanceId: instance.id,
        splitNodeInstanceId: claimed.id,
        expectedNodeStateVersion: claimed.stateVersion,
        splitNodeKey: nodeDef.key,
        joinNodeKey,
        branches: decision.branches.map((b) => ({ edgeKey: b.edgeKey, toNodeKey: edgesByKey.get(b.edgeKey)!.toNodeKey })),
      });
      return decision;
    }
    case 'PARALLEL_JOIN': {
      const decision = evaluateParallelJoinNode(nodeDef, outgoingEdgesOf(model, nodeDef.key));
      await applySelectEdgeWithJoinResolution(model, instance, claimed, decision, nodeDef.key);
      return decision;
    }
    case 'END': {
      const decision = evaluateEndNode(nodeDef, evaluationContext);
      if (decision.kind !== 'COMPLETE_INSTANCE') throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'evaluateEndNode returned a non-COMPLETE_INSTANCE decision.', {});
      await applyCompleteInstanceContinuation({
        workflowInstanceId: instance.id,
        completingNodeInstanceId: claimed.id,
        expectedNodeStateVersion: claimed.stateVersion,
        expectedInstanceStateVersion: instance.stateVersion,
        output: decision.output,
      });
      return decision;
    }
    case 'FAIL': {
      const decision = evaluateFailNode(nodeDef, evaluationContext);
      if (decision.kind !== 'FAIL_INSTANCE') throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'evaluateFailNode returned a non-FAIL_INSTANCE decision.', {});
      await applyFailInstanceContinuation({
        workflowInstanceId: instance.id,
        failingNodeInstanceId: claimed.id,
        expectedNodeStateVersion: claimed.stateVersion,
        expectedInstanceStateVersion: instance.stateVersion,
        nodeKey: nodeDef.key,
        errorCode: decision.errorCode,
      });
      await triggerSagaCompensation(instance.id);
      return decision;
    }
    case 'ACTION': {
      const decision = await dispatchActionNode({ nodeDef, model, instance, claimedNode: claimed, evaluationContext, forceNewInvocation, leaseOwnerId, leaseDurationMs });
      return decision;
    }
    case 'FOR_EACH': {
      return dispatchCreateForEachNode({ nodeDef, model, instance, claimedNode: claimed, evaluationContext, leaseOwnerId, leaseDurationMs });
    }
    case 'LOOP': {
      return dispatchCreateLoopNode({ nodeDef, model, instance, claimedNode: claimed, evaluationContext, leaseOwnerId, leaseDurationMs });
    }
    case 'DELAY': {
      return dispatchCreateWaitNode(nodeDef, instance, claimed, () => evaluateDelayNode(nodeDef, evaluationContext, model.policies.limits, new Date()));
    }
    case 'WAIT_EVENT': {
      return dispatchCreateWaitNode(nodeDef, instance, claimed, () => evaluateWaitEventNode(nodeDef, evaluationContext, model.policies.limits, new Date()));
    }
    case 'WORK_ITEM': {
      return dispatchCreateWorkItemNode(nodeDef, revision, instance, claimed, evaluationContext, model.policies.limits);
    }
    case 'SUBFLOW': {
      return dispatchCreateSubflowNode(nodeDef, revision, instance, claimed, evaluationContext, model.policies.limits.maxSubflowRecursionDepth);
    }
    default: {
      const exhaustive: never = nodeDef;
      throw new WorkflowDomainError(
        'WF_EXEC_ENGINE_INVARIANT',
        `Node kind has no dispatch executor: ${JSON.stringify(exhaustive)}`,
        {},
      );
    }
  }
}

/** Shared DELAY/WAIT_EVENT wait-creation dispatch: evaluate the node's creation phase, then commit `RUNNING → WAITING` plus the `WorkflowWait` row in one transaction (doc 05 section 28). */
async function dispatchCreateWaitNode(
  nodeDef: DelayNodeDefinition | WaitEventNodeDefinition,
  instance: { id: number },
  claimedNode: { id: number; stateVersion: number },
  evaluate: () => ContinuationDecision,
): Promise<DispatchResult> {
  const decision = evaluate();
  if (decision.kind !== 'CREATE_WAIT') {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `${nodeDef.kind} node evaluation returned a non-CREATE_WAIT decision.`, { nodeKey: nodeDef.key });
  }
  const { resolvedWait } = decision;
  await applyCreateWaitContinuation({
    nodeInstanceId: claimedNode.id,
    nodeKey: nodeDef.key,
    expectedNodeStateVersion: claimedNode.stateVersion,
    workflowInstanceId: instance.id,
    waitType: resolvedWait.waitType,
    dueAt: resolvedWait.dueAt !== undefined ? new Date(resolvedWait.dueAt) : undefined,
    timeoutAt: resolvedWait.timeoutAt !== undefined ? new Date(resolvedWait.timeoutAt) : undefined,
    eventName: resolvedWait.eventName,
    correlationKey: resolvedWait.correlationKey,
    correlationValueHash: resolvedWait.correlationValueHash,
    correlationEncoderVersion: resolvedWait.correlationEncoderVersion,
    correlationHashAlgorithm: resolvedWait.correlationHashAlgorithm,
  });
  return decision;
}

/**
 * WORK_ITEM creation dispatch (doc 07 sections 1, 8): evaluate title/summary/input/assignment once,
 * then commit `RUNNING → WAITING_HUMAN` plus the `WorkItem` and `WorkflowWait` rows in one
 * transaction. Reuses the `CREATE_WAIT`/`HUMAN` decision shape (doc 06 section 15's closed union has
 * no separate "Work Item created" kind — a Work Item's HUMAN wait is exactly this kind).
 */
async function dispatchCreateWorkItemNode(
  nodeDef: WorkItemNodeDefinition,
  revision: WorkflowRevisionRecord,
  instance: { id: number },
  claimedNode: { id: number; stateVersion: number },
  evaluationContext: ReturnType<typeof buildEvaluationContext>,
  limits: { maxWorkItemTitleLength: number },
): Promise<DispatchResult> {
  // WFV2-20/21 — resolve outside, commit inside (same pattern as ACTION provider / SUBFLOW target
  // resolution): these strategies need real DB reads the pure evaluateWorkItemCreation cannot do.
  let presetAssignment;
  if (nodeDef.assignment.strategy === 'SAME_AS_WORK_ITEM') {
    presetAssignment = await resolveSameAsWorkItemAssignment(instance.id, nodeDef.assignment.workItemNodeKey);
  } else if (nodeDef.assignment.strategy === 'ROUND_ROBIN') {
    presetAssignment = await resolveRoundRobinAssignment(revision.workflowDefinitionId, nodeDef.key, nodeDef.assignment.userIds);
  } else if (nodeDef.assignment.strategy === 'SHORTEST_QUEUE') {
    presetAssignment = await resolveShortestQueueAssignment(nodeDef.assignment.roleId);
  }
  const resolved = evaluateWorkItemCreation(nodeDef, evaluationContext, limits, presetAssignment);

  // HWF-2.4 — Out-of-Office: only meaningful when resolution landed on a specific USER (a ROLE pool
  // already tolerates absence via its other members, per user decision 2026-08-30). Applied AFTER the
  // pure evaluator returns (same "resolve outside, commit inside" shape as SAME_AS_WORK_ITEM/
  // ROUND_ROBIN/SHORTEST_QUEUE above) since it needs a real DB read the pure function cannot do.
  let assignmentEvidenceJson = resolved.assignmentEvidenceJson;
  if (resolved.resolvedAssignment.type === 'USER') {
    const delegateUserId = await resolveActiveDelegate(resolved.resolvedAssignment.userId);
    if (delegateUserId !== null) {
      const evidence = JSON.parse(assignmentEvidenceJson) as Record<string, unknown>;
      assignmentEvidenceJson = JSON.stringify({
        ...evidence,
        resolvedUserId: delegateUserId,
        delegatedFromUserId: resolved.resolvedAssignment.userId,
        resolutionReason: `${evidence.resolutionReason ?? ''} (delegated via active Out-of-Office rule)`.trim(),
      });
    }
  }

  const { workItemId } = await applyCreateWorkItemContinuation({
    nodeInstanceId: claimedNode.id,
    nodeKey: nodeDef.key,
    expectedNodeStateVersion: claimedNode.stateVersion,
    workflowInstanceId: instance.id,
    workItemType: resolved.workItemType,
    assignmentStrategy: resolved.assignmentStrategy,
    assignmentEvidenceJson,
    priority: resolved.priority,
    allowedOutcomesJson: JSON.stringify(resolved.allowedOutcomes),
    inputJson: resolved.inputJson,
    outputSchemaJson: resolved.outputSchemaJson,
    titleText: resolved.titleText,
    summaryText: resolved.summaryText,
    dueAt: resolved.dueAt,
    followUpAt: resolved.followUpAt,
    approvalGroupKey: resolved.approvalGroupKey,
  });
  return { kind: 'CREATE_WAIT', waitType: 'HUMAN', resolvedWait: { waitType: 'HUMAN', workItemId } };
}

/**
 * SUBFLOW creation dispatch (doc 05 sections 7, 31): resolve the exact target definition/revision
 * (the "canonical nested-start... exact child revision resolution" doc 05 section 31 requires),
 * evaluate `input` against the parent's context, then commit `RUNNING → WAITING` plus the full
 * child instance creation and `SUBFLOW` wait atomically via `applyCreateSubflowContinuation`.
 * Resolution happens outside the transaction (read-only; same "resolve outside, commit inside"
 * pattern as ACTION's provider resolution) — a target that becomes unstartable between this read
 * and the commit is simply retried on redrive, same as every other Slice 5+ dispatch path.
 */
/** WFV2-4 — applied when a revision's `policies.limits.maxSubflowRecursionDepth` is absent (older pinned revisions, or an author who never set it). */
const DEFAULT_MAX_SUBFLOW_RECURSION_DEPTH = 25;

async function dispatchCreateSubflowNode(
  nodeDef: SubflowNodeDefinition,
  parentRevision: WorkflowRevisionRecord,
  instance: { id: number },
  claimedNode: { id: number; stateVersion: number },
  evaluationContext: ReturnType<typeof buildEvaluationContext>,
  maxSubflowRecursionDepth: number | undefined,
): Promise<DispatchResult> {
  const parentDefinition = await getWorkflowDefinitionById(parentRevision.workflowDefinitionId);
  if (!parentDefinition) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'Owning WorkflowDefinition not found for the pinned parent revision.', { workflowDefinitionId: parentRevision.workflowDefinitionId });
  }

  // WFV2-4 — a self-referencing SUBFLOW has no static cycle for structuralValidation.ts to reject
  // (each recursion level is a genuinely new instance); the depth is a runtime-only property,
  // checked here before another child is allowed to spawn.
  const effectiveMaxDepth = maxSubflowRecursionDepth ?? DEFAULT_MAX_SUBFLOW_RECURSION_DEPTH;
  const ancestorDepth = await computeSubflowAncestorDepth(instance.id);
  if (ancestorDepth + 1 > effectiveMaxDepth) {
    throw new WorkflowDomainError('WF_EXEC_SUBFLOW_RECURSION_LIMIT_EXCEEDED', `SUBFLOW node "${nodeDef.key}" would create a child instance at recursion depth ${ancestorDepth + 1}, exceeding the configured limit of ${effectiveMaxDepth}.`, {
      nodeKey: nodeDef.key,
      ancestorDepth,
      effectiveMaxDepth,
    });
  }
  const scopeKey = nodeDef.workflowDefinitionRef.scopeKey ?? parentDefinition.scopeKey;
  const targetDefinition = await findWorkflowDefinitionByScopeAndKey(scopeKey, nodeDef.workflowDefinitionRef.workflowDefinitionKey);
  if (!targetDefinition || targetDefinition.lifecycleStatus === 'ARCHIVED' || !targetDefinition.currentPublishedRevisionId) {
    throw new WorkflowDomainError('WF_DEF_NOT_STARTABLE', `SUBFLOW node "${nodeDef.key}" target WorkflowDefinition "${nodeDef.workflowDefinitionRef.workflowDefinitionKey}" in scope "${scopeKey}" is not currently startable.`, {
      nodeKey: nodeDef.key,
      scopeKey,
      workflowDefinitionKey: nodeDef.workflowDefinitionRef.workflowDefinitionKey,
    });
  }
  const childRevision = await getWorkflowRevisionById(targetDefinition.currentPublishedRevisionId);
  if (!childRevision) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'currentPublishedRevisionId points to a missing WorkflowRevision.', { workflowRevisionId: targetDefinition.currentPublishedRevisionId });
  }
  assertRevisionIsStartable(childRevision, targetDefinition.lifecycleStatus);
  const childModel = JSON.parse(childRevision.definitionJson) as WorkflowModel;
  const childInput = evaluateMapping(nodeDef.input, evaluationContext);

  // p-99/WFT-9 — encoded once here (same timing/context as WAIT_EVENT's own `correlation`: no
  // CURRENT_EVENT, evaluated before the child even starts), then stored on the SUBFLOW wait row.
  const cancelEvent = nodeDef.cancelEvent
    ? { eventName: nodeDef.cancelEvent.eventName, ...encodeCorrelationValue(evaluateExpression(nodeDef.cancelEvent.correlation, evaluationContext)) }
    : undefined;

  const { childInstanceId } = await applyCreateSubflowContinuation({
    parentNodeInstanceId: claimedNode.id,
    parentNodeKey: nodeDef.key,
    expectedParentNodeStateVersion: claimedNode.stateVersion,
    parentWorkflowInstanceId: instance.id,
    childRevisionId: childRevision.id,
    childModel,
    childInput,
    cancelEvent,
  });

  return { kind: 'CREATE_WAIT', waitType: 'SUBFLOW', resolvedWait: { waitType: 'SUBFLOW', childInstanceId } };
}

function resolveTargetNodeKey(model: WorkflowModel, decision: ContinuationDecision): string {
  if (decision.kind !== 'SELECT_EDGE') throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'Expected a SELECT_EDGE decision.', {});
  const edge = model.edges.find((e) => e.key === decision.edgeKey);
  if (!edge) throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `Selected edge "${decision.edgeKey}" does not exist in the pinned model.`, { edgeKey: decision.edgeKey });
  return edge.toNodeKey;
}

/** Shared DECISION/SWITCH/PARALLEL_JOIN completion path: resolves the target and — when it is a PARALLEL_JOIN (doc 05 section 32) — records this branch's arrival instead of a plain readying. */
async function applySelectEdgeWithJoinResolution(
  model: WorkflowModel,
  instance: { id: number },
  claimedNode: { id: number; stateVersion: number; branchTokenId: number | null },
  decision: ContinuationDecision,
  sourceNodeKey: string,
  decisionMode?: 'EXACT_ONE' | 'FIRST_MATCH' | 'MULTI_MATCH',
): Promise<void> {
  const targetNodeKey = resolveTargetNodeKey(model, decision);
  const joinInfo = resolveJoinTargetInfo(model, targetNodeKey);
  const selectedEdge = decision.kind === 'SELECT_EDGE' ? model.edges.find((e) => e.key === decision.edgeKey) : undefined;
  const { selectionMode, selectionReason } = selectedEdge
    ? describeEdgeSelection(selectedEdge, decisionMode)
    : { selectionMode: 'UNKNOWN', selectionReason: 'selected edge not found in pinned model' };
  await applySelectEdgeContinuation({
    workflowInstanceId: instance.id,
    completingNodeInstanceId: claimedNode.id,
    sourceNodeKey,
    selectionMode,
    selectionReason,
    expectedNodeStateVersion: claimedNode.stateVersion,
    nodeOutput: decision.kind === 'SELECT_EDGE' ? decision.nodeOutput : null,
    edgeKey: decision.kind === 'SELECT_EDGE' ? decision.edgeKey : '',
    targetNodeKey,
    targetIsJoin: joinInfo.targetIsJoin,
    join: joinInfo.join,
    sourceBranchTokenId: claimedNode.branchTokenId,
  });
}

async function dispatchActionNode(input: {
  nodeDef: ActionNodeDefinition;
  model: WorkflowModel;
  instance: { id: number; stateVersion: number };
  claimedNode: { id: number; stateVersion: number; semanticNodeKey: string; branchTokenId: number | null };
  evaluationContext: ReturnType<typeof buildEvaluationContext>;
  forceNewInvocation?: boolean;
  leaseOwnerId: string;
  leaseDurationMs: number;
}): Promise<DispatchResult> {
  const { nodeDef, model, instance, claimedNode, evaluationContext, forceNewInvocation, leaseOwnerId, leaseDurationMs } = input;

  const resolvedProvider = resolveActionProviderForNode(nodeDef.actionRef);
  const retryPolicy = resolveEffectiveRetryPolicy(nodeDef, model);
  const config = evaluateMapping(nodeDef.config, evaluationContext);
  const actionInput = evaluateMapping(nodeDef.input, evaluationContext);

  const { attempt } = await beginActionAttempt({
    workflowInstanceId: instance.id,
    nodeInstanceId: claimedNode.id,
    nodeKey: nodeDef.key,
    resolvedProvider,
    retryPolicy,
    recoveryDetectionBoundMs: model.policies.recoveryDetectionBoundMs,
    forceNewInvocation,
  });

  const { result, currentNodeStateVersion } = await invokeActionExecutorWithDeadline({
    resolvedProvider,
    attempt,
    workflowInstanceId: instance.id,
    nodeInstanceId: claimedNode.id,
    nodeStateVersion: claimedNode.stateVersion,
    leaseOwnerId,
    leaseDurationMs,
    effectiveIdentity: { type: 'SYSTEM', id: null },
    config,
    actionInput,
    executionTimeoutMs: resolvedProvider.executionTimeoutMs,
  });

  if (result.outcome === 'SUCCEEDED') {
    const outgoing = outgoingEdgesOf(model, nodeDef.key);
    const edge = outgoing.find((e) => e.selector.type === 'UNCONDITIONAL');
    if (!edge) throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `ACTION node "${nodeDef.key}" has no UNCONDITIONAL outgoing edge — publication should have rejected this.`, { nodeKey: nodeDef.key });

    const updatedVariables = nodeDef.outputAssignments?.length
      ? applyOutputAssignments(nodeDef.outputAssignments, evaluationContext, nodeDef.key, result.output)
      : undefined;

    const joinInfo = resolveJoinTargetInfo(model, edge.toNodeKey);
    await applyAttemptSuccessContinuation({
      workflowInstanceId: instance.id,
      nodeInstanceId: claimedNode.id,
      sourceNodeKey: nodeDef.key,
      attemptId: attempt.id,
      expectedAttemptStateVersion: attempt.stateVersion,
      expectedNodeStateVersion: currentNodeStateVersion,
      resultMetadataJson: result.resultMetadataJson,
      nodeOutput: result.output,
      edgeKey: edge.key,
      targetNodeKey: edge.toNodeKey,
      updatedVariables: updatedVariables ? { variables: updatedVariables, expectedInstanceStateVersion: instance.stateVersion } : undefined,
      targetIsJoin: joinInfo.targetIsJoin,
      join: joinInfo.join,
      sourceBranchTokenId: claimedNode.branchTokenId,
    });
    return { kind: 'SELECT_EDGE', edgeKey: edge.key, nodeOutput: result.output, outputAssignments: updatedVariables };
  }

  // FAILED or TIMED_OUT.
  const classification = { errorCode: result.outcome === 'FAILED' ? result.errorCode : undefined, errorClass: result.outcome === 'FAILED' ? result.errorClass : undefined, isTimeout: result.outcome === 'TIMED_OUT' };
  const safeMessage = result.outcome === 'FAILED' ? result.safeMessage : 'Action attempt exceeded its execution deadline.';
  const terminalPatch = attemptTerminalPatchForFailure(classification, safeMessage);

  const isRetryable = matchesRetryPolicy(retryPolicy, classification) && attempt.attemptNumber < retryPolicy.maxAttempts;
  if (isRetryable) {
    const delayMs = computeRetryDelayMs(retryPolicy, attempt.attemptNumber);
    const nextEligibleAt = new Date(Date.now() + delayMs);
    await applyAttemptRetryContinuation({
      workflowInstanceId: instance.id,
      nodeInstanceId: claimedNode.id,
      sourceNodeKey: nodeDef.key,
      attemptId: attempt.id,
      expectedAttemptStateVersion: attempt.stateVersion,
      expectedNodeStateVersion: currentNodeStateVersion,
      terminalPatch,
      nextEligibleAt,
      matchedRetrySelectorIdentity: findMatchingRetrySelectorIdentity(retryPolicy, classification),
    });
    return { kind: 'RETRY_SCHEDULED', nextEligibleAt: nextEligibleAt.toISOString() };
  }

  // WFV2-1 — unhandled (non-retryable) failure: if the author declared an ON_ERROR edge on this
  // ACTION node, route there instead of unconditionally failing the whole instance (doc05 section
  // 29's "always INSTANCE_FAILED" is now the fallback for nodes with no ON_ERROR edge, not the only
  // behavior). Reuses the exact SELECT_EDGE/outputAssignments/join-resolution shape the real success
  // path already proved for PARALLEL_JOIN targets — only the synthetic error-shaped nodeOutput and
  // the edge chosen differ.
  const errorEdge = errorEdgeOf(model, nodeDef.key);
  if (errorEdge) {
    const errorCode = classification.errorCode ?? 'WF_EXEC_UNHANDLED_NODE_FAILURE';
    const errorOutput: JsonValue = { errorCode, errorClass: classification.errorClass ?? null, safeMessage, isTimeout: classification.isTimeout };
    const updatedVariables = nodeDef.outputAssignments?.length
      ? applyOutputAssignments(nodeDef.outputAssignments, evaluationContext, nodeDef.key, errorOutput)
      : undefined;
    const joinInfo = resolveJoinTargetInfo(model, errorEdge.toNodeKey);
    await applyAttemptCaughtFailureContinuation({
      workflowInstanceId: instance.id,
      nodeInstanceId: claimedNode.id,
      sourceNodeKey: nodeDef.key,
      attemptId: attempt.id,
      expectedAttemptStateVersion: attempt.stateVersion,
      expectedNodeStateVersion: currentNodeStateVersion,
      terminalPatch,
      nodeOutput: errorOutput,
      edgeKey: errorEdge.key,
      targetNodeKey: errorEdge.toNodeKey,
      updatedVariables: updatedVariables ? { variables: updatedVariables, expectedInstanceStateVersion: instance.stateVersion } : undefined,
      targetIsJoin: joinInfo.targetIsJoin,
      join: joinInfo.join,
      sourceBranchTokenId: claimedNode.branchTokenId,
    });
    return { kind: 'SELECT_EDGE', edgeKey: errorEdge.key, nodeOutput: errorOutput, outputAssignments: updatedVariables };
  }

  await applyAttemptUnhandledFailureContinuation({
    workflowInstanceId: instance.id,
    nodeInstanceId: claimedNode.id,
    sourceNodeKey: nodeDef.key,
    attemptId: attempt.id,
    expectedAttemptStateVersion: attempt.stateVersion,
    expectedNodeStateVersion: currentNodeStateVersion,
    expectedInstanceStateVersion: instance.stateVersion,
    terminalPatch,
  });
  await triggerSagaCompensation(instance.id);
  return { kind: 'FAIL_INSTANCE', errorCode: classification.errorCode ?? 'WF_EXEC_UNHANDLED_NODE_FAILURE', safeMessage };
}

// ---------------------------------------------------------------------------
// WFV2-2 — FOR_EACH dynamic per-item fork.
// ---------------------------------------------------------------------------

const DEFAULT_MAX_FOR_EACH_ITEMS = 200;
const DEFAULT_FOR_EACH_CONCURRENCY = 5;
const DEFAULT_MAX_LOOP_ITERATIONS = 25;
const HARD_CAP_LOOP_ITERATIONS = 100;
/** No artificial backoff between in-process per-item retries (see ForEachNodeDefinition's module doc — the whole node executes within one dispatch call/lease window; a real backoff sleep here would hold that lease for no durability benefit). Retry selector/attempt-count matching still applies. */
const FOR_EACH_ITEM_EXECUTION_TIMEOUT_MS = 30_000;

async function runForEachItemOnce(
  provider: ReturnType<typeof resolveActionProviderForNode>,
  config: JsonValue,
  itemInput: JsonValue,
  identity: { nodeInstanceId: number; itemIndex: number; logicalInvocationId: string; idempotencyKey: string },
): Promise<{ status: 'SUCCEEDED'; output: JsonValue } | { status: 'FAILED'; errorCode: string; errorClass: string; safeMessage: string }> {
  const abortController = new AbortController();
  const context = {
    workflowInstanceId: String(identity.nodeInstanceId),
    nodeInstanceId: `${identity.nodeInstanceId}[${identity.itemIndex}]`,
    logicalInvocationId: identity.logicalInvocationId,
    idempotencyKey: identity.idempotencyKey,
    effectiveIdentity: { type: 'SYSTEM' as const, id: null },
    cancellationSignal: abortController.signal,
    resolveSecret: resolveWorkflowSecretFromEnv,
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    writeTraceMetadata: () => {},
  };
  let resolvedConfig = config;
  let resolvedInput = itemInput;
  if (provider.secretReferenceFields.length > 0) {
    try {
      const substituted = await applySecretReferenceFields({ config, actionInput: itemInput, secretReferenceFields: provider.secretReferenceFields, resolveSecret: context.resolveSecret });
      resolvedConfig = substituted.config;
      resolvedInput = substituted.actionInput;
    } catch (error) {
      return { status: 'FAILED', errorCode: 'WF_EXEC_SECRET_RESOLUTION_FAILED', errorClass: 'SECRET_RESOLUTION_FAILED', safeMessage: error instanceof Error ? error.message : 'Secret resolution failed.' };
    }
  }

  let timeoutHandle: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<{ status: 'FAILED'; errorCode: string; errorClass: string; safeMessage: string }>((resolve) => {
    timeoutHandle = setTimeout(() => {
      abortController.abort();
      resolve({ status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'TIMEOUT', safeMessage: 'FOR_EACH item execution exceeded its execution deadline.' });
    }, FOR_EACH_ITEM_EXECUTION_TIMEOUT_MS);
  });
  const executionPromise = (async () => {
    try {
      return await provider.executor.execute(context, resolvedConfig, resolvedInput);
    } catch {
      return { status: 'FAILED' as const, errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'EXECUTOR_EXCEPTION', safeMessage: 'Action executor raised an unexpected exception.' };
    }
  })();
  try {
    return await Promise.race([executionPromise, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

/**
 * WFV2-2 — runs every item in-process (bounded by `maxConcurrency`), applying the node's own
 * `retryPolicy` per item with no artificial delay (see the module-level comment above), then applies
 * `joinMode` to the collected results. No durable per-item state exists (see `ForEachNodeDefinition`'s
 * doc comment) — the node's own periodically-renewed lease is the only durability boundary for the
 * whole loop; a crash mid-loop redrives the entire node from scratch on recovery.
 */
async function dispatchCreateForEachNode(input: {
  nodeDef: ForEachNodeDefinition;
  model: WorkflowModel;
  instance: { id: number; stateVersion: number };
  claimedNode: { id: number; stateVersion: number; branchTokenId: number | null };
  evaluationContext: ReturnType<typeof buildEvaluationContext>;
  leaseOwnerId: string;
  leaseDurationMs: number;
}): Promise<DispatchResult> {
  const { nodeDef, model, instance, claimedNode, evaluationContext, leaseOwnerId, leaseDurationMs } = input;

  const maxItems = model.policies.limits.maxForEachItems ?? DEFAULT_MAX_FOR_EACH_ITEMS;
  const items = evaluateForEachItems(nodeDef, evaluationContext, maxItems);
  const provider = resolveActionProviderForNode(nodeDef.actionRef);
  const retryPolicy = nodeDef.retryPolicy ?? model.policies.defaultRetryPolicy;
  if (!retryPolicy) throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `FOR_EACH node "${nodeDef.key}" has no resolvable retryPolicy — publication should have rejected this.`, { nodeKey: nodeDef.key });
  const config = evaluateMapping(nodeDef.config, evaluationContext);
  const maxConcurrency = Math.max(1, nodeDef.maxConcurrency ?? model.policies.limits.defaultForEachConcurrency ?? DEFAULT_FOR_EACH_CONCURRENCY);

  let currentNodeStateVersion = claimedNode.stateVersion;
  const results: ForEachItemResult[] = new Array(items.length);
  let cursor = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;

      const itemContext = { ...evaluationContext, currentItem: items[index], currentItemIndex: index };
      const itemInput = evaluateMapping(nodeDef.input, itemContext);
      const identityBase = { nodeInstanceId: claimedNode.id, itemIndex: index, logicalInvocationId: '', idempotencyKey: '' };
      // Deterministic per-(node, item, evaluated-input) identity — stable across a whole-node redrive
      // whose expressions re-evaluate to the same values, letting a DEDUPLICATED-guarantee provider
      // correctly recognize a repeat call (same rationale as the durable engine's logicalInvocationKey).
      const identityFingerprint = `for-each:${claimedNode.id}:${index}:${JSON.stringify(itemInput)}`;
      identityBase.logicalInvocationId = identityFingerprint;
      identityBase.idempotencyKey = identityFingerprint;

      let attemptNumber = 1;
      let result = await runForEachItemOnce(provider, config, itemInput, identityBase);
      while (result.status === 'FAILED' && attemptNumber < retryPolicy!.maxAttempts && matchesRetryPolicy(retryPolicy!, { errorCode: result.errorCode, errorClass: result.errorClass, isTimeout: result.errorClass === 'TIMEOUT' })) {
        attemptNumber += 1;
        result = await runForEachItemOnce(provider, config, itemInput, identityBase);
      }
      results[index] = result.status === 'SUCCEEDED' ? { index, status: 'SUCCEEDED', output: result.output } : { index, status: 'FAILED', errorCode: result.errorCode, errorClass: result.errorClass, safeMessage: result.safeMessage };

      try {
        const renewed = await renewNodeLease(claimedNode.id, currentNodeStateVersion, leaseOwnerId, leaseDurationMs);
        currentNodeStateVersion = renewed.stateVersion;
      } catch {
        // Best-effort — same "heartbeat failure does not itself assert failure" posture as the
        // durable ACTION path; ordinary recovery is the safety net if the lease truly expires.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(maxConcurrency, Math.max(items.length, 1)) }, () => worker()));

  const satisfied = evaluateForEachJoinSatisfied(nodeDef, results);
  const nodeOutput = results as unknown as JsonValue;

  if (!satisfied) {
    const errorEdge = errorEdgeOf(model, nodeDef.key);
    if (errorEdge) {
      const updatedVariables = nodeDef.outputAssignments?.length ? applyOutputAssignments(nodeDef.outputAssignments, evaluationContext, nodeDef.key, nodeOutput) : undefined;
      const joinInfo = resolveJoinTargetInfo(model, errorEdge.toNodeKey);
      await applySelectEdgeContinuation({
        workflowInstanceId: instance.id,
        completingNodeInstanceId: claimedNode.id,
        sourceNodeKey: nodeDef.key,
        selectionMode: 'ON_ERROR',
        selectionReason: `FOR_EACH join policy (${nodeDef.joinMode}) not satisfied`,
        expectedNodeStateVersion: currentNodeStateVersion,
        nodeOutput,
        edgeKey: errorEdge.key,
        targetNodeKey: errorEdge.toNodeKey,
        updatedVariables: updatedVariables ? { variables: updatedVariables, expectedInstanceStateVersion: instance.stateVersion } : undefined,
        targetIsJoin: joinInfo.targetIsJoin,
        join: joinInfo.join,
        sourceBranchTokenId: claimedNode.branchTokenId,
      });
      return { kind: 'SELECT_EDGE', edgeKey: errorEdge.key, nodeOutput, outputAssignments: updatedVariables };
    }
    const safeMessage = `FOR_EACH node "${nodeDef.key}" join policy (${nodeDef.joinMode}) was not satisfied (${results.filter((r) => r.status === 'SUCCEEDED').length}/${results.length} items succeeded).`;
    await applyFailInstanceContinuation({
      workflowInstanceId: instance.id,
      failingNodeInstanceId: claimedNode.id,
      expectedNodeStateVersion: currentNodeStateVersion,
      expectedInstanceStateVersion: instance.stateVersion,
      nodeKey: nodeDef.key,
      errorCode: 'WF_EXEC_UNHANDLED_NODE_FAILURE',
    });
    await triggerSagaCompensation(instance.id);
    return { kind: 'FAIL_INSTANCE', errorCode: 'WF_EXEC_UNHANDLED_NODE_FAILURE', safeMessage };
  }

  const edge = successEdgeOf(model, nodeDef.key);
  if (!edge) throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `FOR_EACH node "${nodeDef.key}" has no UNCONDITIONAL outgoing edge — publication should have rejected this.`, { nodeKey: nodeDef.key });
  const updatedVariables = nodeDef.outputAssignments?.length ? applyOutputAssignments(nodeDef.outputAssignments, evaluationContext, nodeDef.key, nodeOutput) : undefined;
  const joinInfo = resolveJoinTargetInfo(model, edge.toNodeKey);
  await applySelectEdgeContinuation({
    workflowInstanceId: instance.id,
    completingNodeInstanceId: claimedNode.id,
    sourceNodeKey: nodeDef.key,
    selectionMode: 'UNCONDITIONAL',
    selectionReason: 'FOR_EACH join policy satisfied',
    expectedNodeStateVersion: currentNodeStateVersion,
    nodeOutput,
    edgeKey: edge.key,
    targetNodeKey: edge.toNodeKey,
    updatedVariables: updatedVariables ? { variables: updatedVariables, expectedInstanceStateVersion: instance.stateVersion } : undefined,
    targetIsJoin: joinInfo.targetIsJoin,
    join: joinInfo.join,
    sourceBranchTokenId: claimedNode.branchTokenId,
  });
  return { kind: 'SELECT_EDGE', edgeKey: edge.key, nodeOutput, outputAssignments: updatedVariables };
}

/**
 * In-process while-loop. Sequential so each iteration sees the previous output as CURRENT_ITEM.
 * Same crash-redrive boundary as FOR_EACH: the whole node reruns if the lease is lost.
 */
async function dispatchCreateLoopNode(input: {
  nodeDef: LoopNodeDefinition;
  model: WorkflowModel;
  instance: { id: number; stateVersion: number };
  claimedNode: { id: number; stateVersion: number; branchTokenId: number | null };
  evaluationContext: ReturnType<typeof buildEvaluationContext>;
  leaseOwnerId: string;
  leaseDurationMs: number;
}): Promise<DispatchResult> {
  const { nodeDef, model, instance, claimedNode, evaluationContext, leaseOwnerId, leaseDurationMs } = input;

  const maxIterations = Math.min(
    nodeDef.maxIterations ?? model.policies.limits.maxLoopIterations ?? DEFAULT_MAX_LOOP_ITERATIONS,
    HARD_CAP_LOOP_ITERATIONS,
  );
  const provider = resolveActionProviderForNode(nodeDef.actionRef);
  const retryPolicy = nodeDef.retryPolicy ?? model.policies.defaultRetryPolicy;
  if (!retryPolicy) throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `LOOP node "${nodeDef.key}" has no resolvable retryPolicy — publication should have rejected this.`, { nodeKey: nodeDef.key });
  const config = evaluateMapping(nodeDef.config, evaluationContext);

  let currentNodeStateVersion = claimedNode.stateVersion;
  const results: ForEachItemResult[] = [];
  let previousOutput: JsonValue = null;

  const failOrCatch = async (errorCode: string, safeMessage: string, nodeOutput: JsonValue): Promise<DispatchResult> => {
    const errorEdge = errorEdgeOf(model, nodeDef.key);
    if (errorEdge) {
      const updatedVariables = nodeDef.outputAssignments?.length ? applyOutputAssignments(nodeDef.outputAssignments, evaluationContext, nodeDef.key, nodeOutput) : undefined;
      const joinInfo = resolveJoinTargetInfo(model, errorEdge.toNodeKey);
      await applySelectEdgeContinuation({
        workflowInstanceId: instance.id,
        completingNodeInstanceId: claimedNode.id,
        sourceNodeKey: nodeDef.key,
        selectionMode: 'ON_ERROR',
        selectionReason: safeMessage,
        expectedNodeStateVersion: currentNodeStateVersion,
        nodeOutput,
        edgeKey: errorEdge.key,
        targetNodeKey: errorEdge.toNodeKey,
        updatedVariables: updatedVariables ? { variables: updatedVariables, expectedInstanceStateVersion: instance.stateVersion } : undefined,
        targetIsJoin: joinInfo.targetIsJoin,
        join: joinInfo.join,
        sourceBranchTokenId: claimedNode.branchTokenId,
      });
      return { kind: 'SELECT_EDGE', edgeKey: errorEdge.key, nodeOutput, outputAssignments: updatedVariables };
    }
    await applyFailInstanceContinuation({
      workflowInstanceId: instance.id,
      failingNodeInstanceId: claimedNode.id,
      expectedNodeStateVersion: currentNodeStateVersion,
      expectedInstanceStateVersion: instance.stateVersion,
      nodeKey: nodeDef.key,
      errorCode,
    });
    await triggerSagaCompensation(instance.id);
    return { kind: 'FAIL_INSTANCE', errorCode, safeMessage };
  };

  for (let index = 0; index < maxIterations; index += 1) {
    const itemContext = { ...evaluationContext, currentItem: previousOutput, currentItemIndex: index };
    if (!evaluateBooleanExpression(nodeDef.condition, itemContext)) break;

    const itemInput = evaluateMapping(nodeDef.input, itemContext);
    const identityBase = { nodeInstanceId: claimedNode.id, itemIndex: index, logicalInvocationId: '', idempotencyKey: '' };
    const identityFingerprint = `loop:${claimedNode.id}:${index}:${JSON.stringify(itemInput)}`;
    identityBase.logicalInvocationId = identityFingerprint;
    identityBase.idempotencyKey = identityFingerprint;

    let attemptNumber = 1;
    let result = await runForEachItemOnce(provider, config, itemInput, identityBase);
    while (result.status === 'FAILED' && attemptNumber < retryPolicy.maxAttempts && matchesRetryPolicy(retryPolicy, { errorCode: result.errorCode, errorClass: result.errorClass, isTimeout: result.errorClass === 'TIMEOUT' })) {
      attemptNumber += 1;
      result = await runForEachItemOnce(provider, config, itemInput, identityBase);
    }

    if (result.status === 'FAILED') {
      results.push({ index, status: 'FAILED', errorCode: result.errorCode, errorClass: result.errorClass, safeMessage: result.safeMessage });
      return failOrCatch('WF_EXEC_UNHANDLED_NODE_FAILURE', `LOOP node "${nodeDef.key}" iteration ${index} failed (${result.safeMessage}).`, results as unknown as JsonValue);
    }

    previousOutput = result.output;
    results.push({ index, status: 'SUCCEEDED', output: result.output });

    try {
      const renewed = await renewNodeLease(claimedNode.id, currentNodeStateVersion, leaseOwnerId, leaseDurationMs);
      currentNodeStateVersion = renewed.stateVersion;
    } catch {
      // Best-effort heartbeat — same posture as FOR_EACH.
    }
  }

  const wouldContinue = evaluateBooleanExpression(nodeDef.condition, {
    ...evaluationContext,
    currentItem: previousOutput,
    currentItemIndex: results.length,
  });
  if (results.length >= maxIterations && wouldContinue) {
    return failOrCatch(
      'WF_EXEC_LOOP_LIMIT_EXCEEDED',
      `LOOP node "${nodeDef.key}" reached the iteration cap of ${maxIterations} while its condition was still true.`,
      results as unknown as JsonValue,
    );
  }

  const nodeOutput = results as unknown as JsonValue;
  const edge = successEdgeOf(model, nodeDef.key);
  if (!edge) throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `LOOP node "${nodeDef.key}" has no UNCONDITIONAL outgoing edge — publication should have rejected this.`, { nodeKey: nodeDef.key });
  const updatedVariables = nodeDef.outputAssignments?.length ? applyOutputAssignments(nodeDef.outputAssignments, evaluationContext, nodeDef.key, nodeOutput) : undefined;
  const joinInfo = resolveJoinTargetInfo(model, edge.toNodeKey);
  await applySelectEdgeContinuation({
    workflowInstanceId: instance.id,
    completingNodeInstanceId: claimedNode.id,
    sourceNodeKey: nodeDef.key,
    selectionMode: 'UNCONDITIONAL',
    selectionReason: 'LOOP condition became false',
    expectedNodeStateVersion: currentNodeStateVersion,
    nodeOutput,
    edgeKey: edge.key,
    targetNodeKey: edge.toNodeKey,
    updatedVariables: updatedVariables ? { variables: updatedVariables, expectedInstanceStateVersion: instance.stateVersion } : undefined,
    targetIsJoin: joinInfo.targetIsJoin,
    join: joinInfo.join,
    sourceBranchTokenId: claimedNode.branchTokenId,
  });
  return { kind: 'SELECT_EDGE', edgeKey: edge.key, nodeOutput, outputAssignments: updatedVariables };
}
