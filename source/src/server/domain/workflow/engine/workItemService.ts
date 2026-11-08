import { randomUUID } from 'node:crypto';
import { loadUserRoles, loadUserIdsWithRole } from '../../users/prismaHelpers';
import { WorkflowDomainError } from '../errors';
import { getWorkItemById, getWorkItemByNodeInstance, countWorkItemsForDefinitionNode, listActiveWorkItems, listWorkItemsByInstance } from '../workItemRepository';
import { getNodeInstanceById, getNodeInstanceByOccurrence, createAdHocRunningNodeInstance } from '../workflowNodeInstanceRepository';
import { getWorkflowInstanceById } from '../workflowInstanceRepository';
import { getWorkflowRevisionById } from '../workflowRevisionRepository';
import { getWaitByOwningNodeInstance } from '../workflowWaitRepository';
import { loadNodeOutputsForInstance, parseJsonOrNull, parseVariables, buildEvaluationContext } from './evaluationContext';
import { applyOutputAssignments } from './nodeExecution';
import { resolveJoinTargetInfo } from './parallelResolution';
import { applyWorkItemClaim, applyWorkItemReassignment, applyWorkItemCompletion } from './workItemContinuationApply';
import { applyCreateWorkItemContinuation } from './continuationApply';
import type { WorkflowModel, WorkItemNodeDefinition, JsonValue } from '../awm/types';
import type { WorkItemRecord, WorkflowActorType } from '../types';
import type { PresetWorkItemAssignment } from './nodeExecution';
import { validateAgainstJsonSchema } from '../../../utils/jsonSchemaValidate';
import { invalidatePersonalInboxForWorkItem } from '../../personal-inbox/personalInboxWorkItemInvalidate';

/**
 * Work Item Claim/Complete/Reassign orchestration (doc 07 sections 2, 3, 6). Eligibility is
 * genuinely checked (not faked) against `assignmentEvidenceJson`'s resolved USER/ROLE descriptor
 * (doc03 section 8), reusing the real `loadUserRoles` role-membership primitive found in the
 * Repository Reality Audit for this slice. What is NOT built: a generic authorization/policy engine
 * (doc09 territory — same documented gap as every operational command since Slice 5) and identity
 * revalidation beyond "does this user id currently hold this role" (no session/token verification —
 * callers are trusted to have already authenticated `actorUserId`).
 */

export type ActorIdentity = { type: WorkflowActorType; id: number | null };

type AssignmentEvidence = { strategy: string; resolvedType: 'USER' | 'ROLE'; resolvedUserId?: number; resolvedRoleId?: string; resolutionReason: string };

function parseEvidence(workItem: WorkItemRecord): AssignmentEvidence | undefined {
  return workItem.assignmentEvidenceJson ? (JSON.parse(workItem.assignmentEvidenceJson) as AssignmentEvidence) : undefined;
}

/**
 * WFV2-19 (Separation of Duties / Four-Eyes — Workflow Resource Patterns): true when `actorUserId`
 * claimed/completed any of `workItem`'s own `excludeUsersFromWorkItemKeys` in the SAME running
 * instance. A WorkItem the exclusion check can't identify a user for (never claimed — e.g.
 * escalation-driven `COMPLETE_WITH_OUTCOME`) is not treated as excluding anyone; there is no user
 * identity to exclude, and doc07 §2's revalidation is about actor eligibility, not about widening
 * exclusions beyond what the evidence actually supports.
 */
async function isActorExcludedBySeparationOfDuties(workItem: WorkItemRecord, actorUserId: number): Promise<boolean> {
  const nodeInstance = await getNodeInstanceById(workItem.nodeInstanceId);
  if (!nodeInstance) return false;
  const instance = await getWorkflowInstanceById(nodeInstance.workflowInstanceId);
  if (!instance) return false;
  const revision = await getWorkflowRevisionById(instance.workflowRevisionId);
  if (!revision) return false;
  const model = JSON.parse(revision.definitionJson) as WorkflowModel;
  const nodeDef = model.nodes.find((n) => n.key === nodeInstance.semanticNodeKey);
  if (nodeDef?.kind !== 'WORK_ITEM' || !nodeDef.excludeUsersFromWorkItemKeys?.length) return false;

  for (const excludedKey of nodeDef.excludeUsersFromWorkItemKeys) {
    const excludedNodeInstance = await getNodeInstanceByOccurrence(nodeInstance.workflowInstanceId, excludedKey);
    if (!excludedNodeInstance) continue;
    const priorWorkItem = await getWorkItemByNodeInstance(excludedNodeInstance.id);
    if (priorWorkItem?.claimedByUserId === actorUserId) return true;
  }
  return false;
}

/**
 * WFV2-20 (Retain Familiar — Workflow Resource Patterns). Called by `dispatchService.ts` BEFORE
 * `evaluateWorkItemCreation` (the pure function itself cannot do this DB read) whenever a WORK_ITEM
 * node's assignment strategy is `SAME_AS_WORK_ITEM`. Prefers the actual claimant (a specific
 * person) when the referenced prior Work Item was individually claimed; falls back to that prior
 * Work Item's own resolved USER/ROLE descriptor when it wasn't (e.g. completed via escalation,
 * doc07's `COMPLETE_WITH_OUTCOME` — there is no individual claimant to "retain" in that case, so
 * this degrades to "same original targeting" rather than failing the node).
 */
export async function resolveSameAsWorkItemAssignment(workflowInstanceId: number, referencedNodeKey: string): Promise<PresetWorkItemAssignment> {
  const nodeInstance = await getNodeInstanceByOccurrence(workflowInstanceId, referencedNodeKey);
  const priorWorkItem = nodeInstance ? await getWorkItemByNodeInstance(nodeInstance.id) : undefined;
  if (!priorWorkItem) {
    throw new WorkflowDomainError('WF_EXEC_ASSIGNMENT_RESOLUTION_FAILED', `SAME_AS_WORK_ITEM assignment references "${referencedNodeKey}", which has no Work Item yet in this instance.`, { referencedNodeKey });
  }
  if (priorWorkItem.claimedByUserId != null) {
    const userId = priorWorkItem.claimedByUserId;
    return { resolved: { type: 'USER', userId }, evidence: { strategy: 'SAME_AS_WORK_ITEM', resolvedType: 'USER', resolvedUserId: userId, resolutionReason: `same claimant as Work Item "${referencedNodeKey}"` } };
  }
  const priorEvidence = parseEvidence(priorWorkItem);
  if (priorEvidence?.resolvedType === 'USER' && priorEvidence.resolvedUserId != null) {
    const userId = priorEvidence.resolvedUserId;
    return { resolved: { type: 'USER', userId }, evidence: { strategy: 'SAME_AS_WORK_ITEM', resolvedType: 'USER', resolvedUserId: userId, resolutionReason: `same resolved USER as Work Item "${referencedNodeKey}" (never individually claimed)` } };
  }
  if (priorEvidence?.resolvedType === 'ROLE' && priorEvidence.resolvedRoleId) {
    const roleId = priorEvidence.resolvedRoleId;
    return { resolved: { type: 'ROLE', roleId }, evidence: { strategy: 'SAME_AS_WORK_ITEM', resolvedType: 'ROLE', resolvedRoleId: roleId, resolutionReason: `same resolved ROLE as Work Item "${referencedNodeKey}" (never individually claimed)` } };
  }
  throw new WorkflowDomainError('WF_EXEC_ASSIGNMENT_RESOLUTION_FAILED', `SAME_AS_WORK_ITEM assignment references "${referencedNodeKey}", whose prior Work Item has no resolvable assignee.`, { referencedNodeKey });
}

function parseAssignedUserId(userId: string, context: string): number {
  const parsed = Number(userId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new WorkflowDomainError('WF_EXEC_ASSIGNMENT_RESOLUTION_FAILED', `${context} userId must be a positive integer string.`, { userId });
  }
  return parsed;
}

/** WFV2-21 — deterministic round-robin across a fixed user-id list for one workflow-definition node. */
export async function resolveRoundRobinAssignment(workflowDefinitionId: number, nodeKey: string, userIds: string[]): Promise<PresetWorkItemAssignment> {
  const parsedUserIds = userIds.map((userId) => parseAssignedUserId(userId, 'ROUND_ROBIN'));
  if (parsedUserIds.length === 0) {
    throw new WorkflowDomainError('WF_EXEC_ASSIGNMENT_RESOLUTION_FAILED', 'ROUND_ROBIN assignment requires at least one user id.', { nodeKey });
  }
  const priorCount = await countWorkItemsForDefinitionNode(workflowDefinitionId, nodeKey);
  const userId = parsedUserIds[priorCount % parsedUserIds.length]!;
  return {
    resolved: { type: 'USER', userId },
    evidence: {
      strategy: 'ROUND_ROBIN',
      resolvedType: 'USER',
      resolvedUserId: userId,
      resolutionReason: `round-robin index ${priorCount % parsedUserIds.length} of ${parsedUserIds.length} candidates`,
      candidateUserIds: parsedUserIds,
      priorAssignmentCount: priorCount,
    },
  };
}

/** WFV2-21 — pick the role member with the fewest active Work Items assigned directly to them. */
export async function resolveShortestQueueAssignment(roleId: string): Promise<PresetWorkItemAssignment> {
  const candidateUserIds = await loadUserIdsWithRole(roleId);
  if (candidateUserIds.length === 0) {
    return {
      resolved: { type: 'ROLE', roleId },
      evidence: { strategy: 'SHORTEST_QUEUE', resolvedType: 'ROLE', resolvedRoleId: roleId, resolutionReason: 'no role members found — falling back to ROLE bucket' },
    };
  }

  const activeItems = await listActiveWorkItems();
  const queueDepth = (userId: number): number => activeItems.filter((item) => {
    if (item.claimedByUserId === userId) return true;
    const evidence = item.assignmentEvidenceJson ? (JSON.parse(item.assignmentEvidenceJson) as { resolvedType?: string; resolvedUserId?: number }) : undefined;
    return evidence?.resolvedType === 'USER' && evidence.resolvedUserId === userId;
  }).length;

  const chosenUserId = candidateUserIds.reduce((best, current) => {
    const currentDepth = queueDepth(current);
    const bestDepth = queueDepth(best);
    if (currentDepth < bestDepth) return current;
    if (currentDepth > bestDepth) return best;
    return current < best ? current : best;
  });

  return {
    resolved: { type: 'USER', userId: chosenUserId },
    evidence: {
      strategy: 'SHORTEST_QUEUE',
      resolvedType: 'USER',
      resolvedUserId: chosenUserId,
      resolvedRoleId: roleId,
      resolutionReason: `shortest queue among role "${roleId}" members`,
      candidateUserIds,
      chosenQueueDepth: queueDepth(chosenUserId),
    },
  };
}

/** Doc 07 section 2: "Candidate membership and actor eligibility are revalidated at query, claim and completion." */
export async function isActorEligibleForWorkItem(workItem: WorkItemRecord, actor: ActorIdentity): Promise<boolean> {
  if (actor.type !== 'USER' || actor.id == null) return false;
  if (await isActorExcludedBySeparationOfDuties(workItem, actor.id)) return false;
  if (workItem.status === 'CLAIMED') return workItem.claimedByUserId === actor.id;
  const evidence = parseEvidence(workItem);
  if (!evidence) return false;
  if (evidence.resolvedType === 'USER') return evidence.resolvedUserId === actor.id;
  const roles = await loadUserRoles(actor.id);
  return roles.includes(evidence.resolvedRoleId!);
}

export async function claimWorkItem(input: { workItemId: number; actorUserId: number }): Promise<WorkItemRecord> {
  const workItem = await getWorkItemById(input.workItemId);
  if (!workItem) {
    throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_NOT_ACTIVE', 'WorkItem not found.', { workItemId: input.workItemId });
  }
  if (workItem.status !== 'OPEN') {
    throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_NOT_ACTIVE', `WorkItem is not OPEN (actual: ${workItem.status}).`, { workItemId: input.workItemId });
  }
  if (!(await isActorEligibleForWorkItem(workItem, { type: 'USER', id: input.actorUserId }))) {
    throw new WorkflowDomainError('WF_AUTH_FORBIDDEN', 'Actor is not eligible to claim this Work Item.', { workItemId: input.workItemId, actorUserId: input.actorUserId });
  }
  await invalidatePersonalInboxForWorkItem(workItem, [input.actorUserId]);
  await applyWorkItemClaim({ workItemId: workItem.id, expectedWorkItemStateVersion: workItem.stateVersion, actorId: input.actorUserId });
  const claimed = (await getWorkItemById(workItem.id))!;
  await invalidatePersonalInboxForWorkItem(claimed, [input.actorUserId]);
  return claimed;
}

export type ReassignWorkItemInput = {
  workItemId: number;
  newAssignment: { strategy: 'USER'; userId: number } | { strategy: 'ROLE'; roleId: string };
  actorType: WorkflowActorType;
  actorId: number | null;
  reasonCode?: string;
};

/**
 * Doc 07 section 6. Scope boundary: only USER/ROLE reassignment targets are supported — EXPRESSION
 * reassignment would need a live workflow evaluation context (variables/node outputs), which does
 * not naturally exist for an ad-hoc operator reassignment action; EXPRESSION remains
 * creation-time-only (doc 07 section 8's "evaluates once").
 */
export async function reassignWorkItem(input: ReassignWorkItemInput): Promise<WorkItemRecord> {
  const workItem = await getWorkItemById(input.workItemId);
  if (!workItem) {
    throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_NOT_ACTIVE', 'WorkItem not found.', { workItemId: input.workItemId });
  }
  if (workItem.status !== 'OPEN' && workItem.status !== 'CLAIMED') {
    throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_NOT_ACTIVE', `WorkItem is not active (actual: ${workItem.status}).`, { workItemId: input.workItemId });
  }

  const evidence: AssignmentEvidence =
    input.newAssignment.strategy === 'USER'
      ? { strategy: 'USER', resolvedType: 'USER', resolvedUserId: input.newAssignment.userId, resolutionReason: 'operator reassignment (literal USER)' }
      : { strategy: 'ROLE', resolvedType: 'ROLE', resolvedRoleId: input.newAssignment.roleId, resolutionReason: 'operator reassignment (literal ROLE)' };

  let clearClaim = false;
  if (workItem.status === 'CLAIMED' && workItem.claimedByUserId != null) {
    const stillEligible =
      evidence.resolvedType === 'USER' ? evidence.resolvedUserId === workItem.claimedByUserId : (await loadUserRoles(workItem.claimedByUserId)).includes(evidence.resolvedRoleId!);
    clearClaim = !stillEligible;
  }

  await invalidatePersonalInboxForWorkItem(workItem, input.actorId != null ? [input.actorId] : []);
  await applyWorkItemReassignment({
    workItemId: workItem.id,
    expectedWorkItemStateVersion: workItem.stateVersion,
    newAssignmentStrategy: input.newAssignment.strategy,
    newAssignmentEvidenceJson: JSON.stringify(evidence),
    clearClaim,
    actorType: input.actorType,
    actorId: input.actorId,
    reasonCode: input.reasonCode,
  });
  const reassigned = (await getWorkItemById(workItem.id))!;
  const extra =
    input.newAssignment.strategy === 'USER' ? [input.newAssignment.userId] : [];
  await invalidatePersonalInboxForWorkItem(reassigned, extra);
  return reassigned;
}

export type WorkItemCompletionPlan = {
  workflowInstanceId: number;
  sourceNodeKey: string;
  waitId: number;
  expectedWaitStateVersion: number;
  completingNodeInstanceId: number;
  expectedNodeStateVersion: number;
  edgeKey: string;
  targetNodeKey: string;
  targetIsJoin: boolean;
  join?: { mode: 'ALL' | 'ANY'; cancelRemaining: boolean };
  sourceBranchTokenId: number | null;
  updatedVariables?: { variables: Record<string, JsonValue>; expectedInstanceStateVersion: number };
};

/**
 * Shared plan-builder for both actor-driven completion (below) and the `COMPLETE_WITH_OUTCOME`
 * escalation action (`workItemEscalationService.ts`) — validates the outcome/graph shape and
 * evaluates `outputAssignments` (doc 05 section 24, `CURRENT_WORK_ITEM` bound to `{outcome,output}`
 * per `expressionEvaluator.ts`), returning everything `applyWorkItemCompletion` needs except the
 * caller-specific `evidence` field.
 */
export type ForwardWorkItemInput = {
  workItemId: number;
  actorUserId: number;
  newAssignment: { strategy: 'USER'; userId: number } | { strategy: 'ROLE'; roleId: string };
  reasonCode?: string;
};

/**
 * HWF-2.5 — self-service "Forward": the CURRENT CLAIMANT (not an operator/ADMIN) hands their
 * already-claimed Work Item to someone else. Reuses the exact same atomic mechanics as the
 * ADMIN-only `reassignWorkItem` (`applyWorkItemReassignment`), just gated on claimant identity
 * instead of role, and tagged `transitionType: 'FORWARD'` for a distinct audit trail entry. Full
 * transfer, no accountability retained — the stricter WS-HumanTask "Delegate" (temporary,
 * accountability stays with the delegator) would need a `delegatedToUserId` column distinct from
 * `claimedByUserId`, which this platform's `WorkItem` model doesn't have yet (documented gap, not
 * built this round).
 */
export async function forwardWorkItem(input: ForwardWorkItemInput): Promise<WorkItemRecord> {
  const workItem = await getWorkItemById(input.workItemId);
  if (!workItem) {
    throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_NOT_ACTIVE', 'WorkItem not found.', { workItemId: input.workItemId });
  }
  if (workItem.status !== 'CLAIMED') {
    throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_NOT_ACTIVE', `WorkItem is not CLAIMED (actual: ${workItem.status}).`, { workItemId: input.workItemId });
  }
  if (workItem.claimedByUserId !== input.actorUserId) {
    throw new WorkflowDomainError('WF_AUTH_FORBIDDEN', 'Only the current claimant may forward this Work Item.', { workItemId: input.workItemId, actorUserId: input.actorUserId });
  }

  const evidence: AssignmentEvidence =
    input.newAssignment.strategy === 'USER'
      ? { strategy: 'USER', resolvedType: 'USER', resolvedUserId: input.newAssignment.userId, resolutionReason: 'forwarded by claimant (literal USER)' }
      : { strategy: 'ROLE', resolvedType: 'ROLE', resolvedRoleId: input.newAssignment.roleId, resolutionReason: 'forwarded by claimant (literal ROLE)' };

  await invalidatePersonalInboxForWorkItem(workItem, [input.actorUserId]);
  await applyWorkItemReassignment({
    workItemId: workItem.id,
    expectedWorkItemStateVersion: workItem.stateVersion,
    newAssignmentStrategy: input.newAssignment.strategy,
    newAssignmentEvidenceJson: JSON.stringify(evidence),
    clearClaim: true,
    actorType: 'USER',
    actorId: input.actorUserId,
    reasonCode: input.reasonCode,
    transitionType: 'FORWARD',
  });
  const forwarded = (await getWorkItemById(workItem.id))!;
  const extra =
    input.newAssignment.strategy === 'USER' ? [input.newAssignment.userId] : [];
  await invalidatePersonalInboxForWorkItem(forwarded, [input.actorUserId, ...extra]);
  return forwarded;
}

export type AttachAdHocWorkItemInput = {
  workflowInstanceId: number;
  actorUserId: number;
  actorRoles: string[];
  workItemType: string;
  titleText: string;
  summaryText?: string;
  assignment: { strategy: 'USER'; userId: number } | { strategy: 'ROLE'; roleId: string };
  allowedOutcomes: string[];
  input?: JsonValue;
  outputSchema?: JsonValue;
};

/**
 * HWF-3.2 — "ad-hoc task": an operator (or an existing participant) attaches a brand-new Work Item to
 * an already-RUNNING instance, entirely outside the published graph — the case-management escape
 * hatch pure-orchestration engines (Camunda/Zeebe/Temporal/Step Functions) don't offer natively. Per
 * user decision 2026-08-30: authorized actors are ADMIN, or anyone who has ever held a Work Item
 * (open or closed) on this same instance — i.e. an existing "participant" — not just any platform
 * user.
 *
 * Reuses `applyCreateWorkItemContinuation`'s exact atomic shape (same transaction that a graph
 * dispatch would run), just fed by a freshly-created `RUNNING` node instance with a synthetic
 * `__adhoc__<uuid>` `semanticNodeKey` instead of one a graph dispatch already claimed. That key has no
 * counterpart in the published graph, so: it can never receive an outgoing edge and therefore can
 * never itself reach an `END` node — instance completion is driven solely by reaching `END` (never by
 * "every node instance terminal"), so an ad-hoc Work Item structurally cannot block completion. The
 * escalation scanner looks up `model.nodes.find(n => n.key === semanticNodeKey)` and skips gracefully
 * on a miss (`workItemEscalationService.ts`), so an ad-hoc task simply has no escalation policy —
 * there is no authored one to inherit. Instance-wide sweeps (cancel/fail) key off
 * `workflowInstanceId` alone, not graph reachability, so cancelling the owning instance still
 * correctly cancels this Work Item's wait too.
 */
export async function attachAdHocWorkItem(input: AttachAdHocWorkItemInput): Promise<WorkItemRecord> {
  const instance = await getWorkflowInstanceById(input.workflowInstanceId);
  if (!instance) {
    throw new WorkflowDomainError('WF_EXEC_INSTANCE_NOT_EXECUTABLE', 'WorkflowInstance not found.', { workflowInstanceId: input.workflowInstanceId });
  }
  if (instance.status !== 'RUNNING') {
    throw new WorkflowDomainError('WF_EXEC_INSTANCE_NOT_EXECUTABLE', `WorkflowInstance is not RUNNING (actual: ${instance.status}) — ad-hoc Work Items can only be attached to a running instance.`, { workflowInstanceId: input.workflowInstanceId });
  }

  const isAdmin = input.actorRoles.includes('ADMIN');
  if (!isAdmin) {
    const priorWorkItems = await listWorkItemsByInstance(input.workflowInstanceId);
    const isParticipant = priorWorkItems.some((w) => {
      if (w.claimedByUserId === input.actorUserId) return true;
      const evidence = parseEvidence(w);
      return evidence?.resolvedType === 'USER' && evidence.resolvedUserId === input.actorUserId;
    });
    if (!isParticipant) {
      throw new WorkflowDomainError('WF_AUTH_FORBIDDEN', 'Only ADMIN or an existing participant on this instance may attach an ad-hoc Work Item.', { workflowInstanceId: input.workflowInstanceId, actorUserId: input.actorUserId });
    }
  }

  const evidence: AssignmentEvidence =
    input.assignment.strategy === 'USER'
      ? { strategy: 'USER', resolvedType: 'USER', resolvedUserId: input.assignment.userId, resolutionReason: 'ad-hoc task, literal USER assignment' }
      : { strategy: 'ROLE', resolvedType: 'ROLE', resolvedRoleId: input.assignment.roleId, resolutionReason: 'ad-hoc task, literal ROLE assignment' };

  const semanticNodeKey = `__adhoc__${randomUUID()}`;
  const nodeInstance = await createAdHocRunningNodeInstance(input.workflowInstanceId, semanticNodeKey);

  const { workItemId } = await applyCreateWorkItemContinuation({
    nodeInstanceId: nodeInstance.id,
    nodeKey: semanticNodeKey,
    expectedNodeStateVersion: nodeInstance.stateVersion,
    workflowInstanceId: input.workflowInstanceId,
    workItemType: input.workItemType,
    assignmentStrategy: input.assignment.strategy,
    assignmentEvidenceJson: JSON.stringify(evidence),
    priority: 0,
    allowedOutcomesJson: JSON.stringify(input.allowedOutcomes),
    inputJson: JSON.stringify(input.input ?? {}),
    outputSchemaJson: JSON.stringify(input.outputSchema ?? { type: 'INLINE', schema: {} }),
    titleText: input.titleText,
    summaryText: input.summaryText ?? null,
    dueAt: null,
    followUpAt: null,
    approvalGroupKey: null,
  });
  const created = (await getWorkItemById(workItemId))!;
  const extra =
    input.assignment.strategy === 'USER' ? [input.assignment.userId] : [];
  await invalidatePersonalInboxForWorkItem(created, [input.actorUserId, ...extra]);
  return created;
}

export type WorkItemFormConfig = {
  formMode: 'DESIGNED_COMPONENT' | 'DYNAMIC_SCHEMA_FORM' | 'RAW_JSON';
  formComponentRef: string | null;
  outputUiSchema: JsonValue | null;
  requireReasonOutcomes: string[];
};

/**
 * HWF-1.1/1.6 — `formMode`/`formComponentRef`/`outputUiSchema` are authoring-time properties of the
 * WORK_ITEM node, not runtime state copied onto the `WorkItem` row (unlike `outputSchemaJson`, which
 * IS denormalized at creation) — deliberately NOT adding new columns for this; resolving from the
 * pinned `definitionJson` at read time (same "re-derive, don't cache" pattern every Slice 5/6
 * dispatch decision already uses) avoids a schema migration for what is a small, infrequent
 * (single Work Item detail fetch) read.
 */
export async function resolveWorkItemFormConfig(workItem: WorkItemRecord): Promise<WorkItemFormConfig> {
  const node = await getNodeInstanceById(workItem.nodeInstanceId);
  const instance = node ? await getWorkflowInstanceById(node.workflowInstanceId) : null;
  const revision = instance ? await getWorkflowRevisionById(instance.workflowRevisionId) : null;
  if (!node || !instance || !revision) {
    return { formMode: 'RAW_JSON', formComponentRef: null, outputUiSchema: null, requireReasonOutcomes: [] };
  }
  const model = JSON.parse(revision.definitionJson) as WorkflowModel;
  const nodeDef = model.nodes.find((n) => n.key === node.semanticNodeKey);
  if (!nodeDef || nodeDef.kind !== 'WORK_ITEM') {
    return { formMode: 'RAW_JSON', formComponentRef: null, outputUiSchema: null, requireReasonOutcomes: [] };
  }
  return {
    formMode: nodeDef.formMode ?? 'RAW_JSON',
    formComponentRef: nodeDef.formComponentRef ?? null,
    outputUiSchema: nodeDef.outputUiSchema ?? null,
    requireReasonOutcomes: nodeDef.requireReasonOutcomes ?? [],
  };
}

export async function resolveWorkItemCompletionPlan(workItem: WorkItemRecord, outcome: string, output: JsonValue): Promise<WorkItemCompletionPlan> {
  const allowedOutcomes = JSON.parse(workItem.allowedOutcomesJson) as string[];
  if (!allowedOutcomes.includes(outcome)) {
    throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_OUTCOME_INVALID', `Outcome "${outcome}" is not one of the Work Item's allowed outcomes.`, { workItemId: workItem.id, outcome, allowedOutcomes });
  }

  const node = await getNodeInstanceById(workItem.nodeInstanceId);
  if (!node) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'Owning WorkflowNodeInstance not found for WorkItem.', { workItemId: workItem.id });
  }
  const instance = await getWorkflowInstanceById(node.workflowInstanceId);
  if (!instance) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'Owning WorkflowInstance not found.', { workflowInstanceId: node.workflowInstanceId });
  }
  const revision = await getWorkflowRevisionById(instance.workflowRevisionId);
  if (!revision) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'Pinned WorkflowRevision not found for a RUNNING instance.', { workflowRevisionId: instance.workflowRevisionId });
  }
  const model = JSON.parse(revision.definitionJson) as WorkflowModel;
  const nodeDef = model.nodes.find((n) => n.key === node.semanticNodeKey) as WorkItemNodeDefinition | undefined;
  if (!nodeDef || nodeDef.kind !== 'WORK_ITEM') {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `Semantic node "${node.semanticNodeKey}" is not a WORK_ITEM node in the pinned model.`, { semanticNodeKey: node.semanticNodeKey });
  }
  const outputValidation = validateAgainstJsonSchema(nodeDef.outputSchema, output);
  if (outputValidation.valid === false) {
    throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_OUTPUT_INVALID', 'WorkItem completion output does not satisfy the node\'s outputSchema.', {
      workItemId: workItem.id,
      schemaViolations: outputValidation.errors,
    });
  }
  if (nodeDef.requireReasonOutcomes?.includes(outcome)) {
    const reason = output !== null && typeof output === 'object' && !Array.isArray(output) ? (output as Record<string, JsonValue>).reason : undefined;
    if (typeof reason !== 'string' || reason.trim().length === 0) {
      throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_REASON_REQUIRED', `Outcome "${outcome}" requires a non-empty output.reason.`, { workItemId: workItem.id, outcome });
    }
  }

  const edge = model.edges.find((e) => e.fromNodeKey === nodeDef.key && e.selector.type === 'WORK_ITEM_OUTCOME' && e.selector.outcomeKey === outcome);
  if (!edge) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `WORK_ITEM node "${nodeDef.key}" has no WORK_ITEM_OUTCOME edge for outcome "${outcome}" — publication should have rejected this shape.`, { nodeKey: nodeDef.key, outcome });
  }
  const wait = await getWaitByOwningNodeInstance(node.id);
  if (!wait) {
    throw new WorkflowDomainError('WF_EXEC_WAIT_NOT_ACTIVE', 'No WorkflowWait found for this WorkItem-owning node.', { workItemId: workItem.id, nodeInstanceId: node.id });
  }

  const nodeOutputs = await loadNodeOutputsForInstance(instance.id);
  const variables = parseVariables(instance.contextJson);
  const workflowInput = parseJsonOrNull(instance.inputJson);
  const canonicalOutput: JsonValue = { outcome, output };
  const evaluationContext = { ...buildEvaluationContext({ workflowInput, variables, nodeOutputs, currentNodeInput: null }), currentWorkItem: { outcome: outcome as JsonValue, output } };
  const updatedVariables = nodeDef.outputAssignments?.length ? applyOutputAssignments(nodeDef.outputAssignments, evaluationContext, nodeDef.key, canonicalOutput) : undefined;

  const joinInfo = resolveJoinTargetInfo(model, edge.toNodeKey);

  return {
    workflowInstanceId: instance.id,
    sourceNodeKey: nodeDef.key,
    waitId: wait.id,
    expectedWaitStateVersion: wait.stateVersion,
    completingNodeInstanceId: node.id,
    expectedNodeStateVersion: node.stateVersion,
    edgeKey: edge.key,
    targetNodeKey: edge.toNodeKey,
    targetIsJoin: joinInfo.targetIsJoin,
    join: joinInfo.join,
    sourceBranchTokenId: node.branchTokenId,
    updatedVariables: updatedVariables ? { variables: updatedVariables, expectedInstanceStateVersion: instance.stateVersion } : undefined,
  };
}

export type CompleteWorkItemInput = {
  workItemId: number;
  actorUserId: number;
  outcome: string;
  output: JsonValue;
};

/** Doc 07 sections 3, 9 — validates actor/version/state/allowed-outcome, then commits the full continuation via `applyWorkItemCompletion` (join-aware, doc 05 section 28's `{ outcome, output }` canonical node output). */
export async function completeWorkItem(input: CompleteWorkItemInput): Promise<WorkItemRecord> {
  const workItem = await getWorkItemById(input.workItemId);
  if (!workItem) {
    throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_NOT_ACTIVE', 'WorkItem not found.', { workItemId: input.workItemId });
  }
  if (workItem.status !== 'OPEN' && workItem.status !== 'CLAIMED') {
    throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_NOT_ACTIVE', `WorkItem is not active (actual: ${workItem.status}).`, { workItemId: input.workItemId });
  }
  if (!(await isActorEligibleForWorkItem(workItem, { type: 'USER', id: input.actorUserId }))) {
    throw new WorkflowDomainError('WF_AUTH_FORBIDDEN', 'Actor is not eligible to complete this Work Item.', { workItemId: input.workItemId, actorUserId: input.actorUserId });
  }

  const plan = await resolveWorkItemCompletionPlan(workItem, input.outcome, input.output);

  await invalidatePersonalInboxForWorkItem(workItem, [input.actorUserId]);

  await applyWorkItemCompletion({
    workItemId: workItem.id,
    expectedWorkItemStateVersion: workItem.stateVersion,
    outcome: input.outcome,
    outputJson: JSON.stringify(input.output),
    evidence: { kind: 'ACTOR', actorType: 'USER', actorId: input.actorUserId },
    ...plan,
  });

  const completed = (await getWorkItemById(workItem.id))!;
  await invalidatePersonalInboxForWorkItem(completed, [input.actorUserId]);
  return completed;
}
