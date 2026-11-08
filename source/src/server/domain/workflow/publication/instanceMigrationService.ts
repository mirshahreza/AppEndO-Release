import { WorkflowDomainError } from '../errors';
import { typedEqual } from '../engine/expressionEvaluator';
import type { JsonValue, WorkflowEdgeDefinition, WorkflowModel } from '../awm/types';
import { getWorkflowRevisionById } from '../workflowRevisionRepository';
import { listNodeInstancesForInstance } from '../workflowNodeInstanceRepository';
import { getWorkflowInstanceById, listNonTerminalInstancesByRevisionId, migrateInstanceRevision } from '../workflowInstanceRepository';

const NON_TERMINAL_NODE_STATUSES = new Set(['PENDING', 'READY', 'RUNNING', 'WAITING', 'WAITING_HUMAN', 'RETRYING', 'COMPENSATING']);

export type MigrationBlockReason =
  | { code: 'VARIABLES_CHANGED' }
  | { code: 'POLICIES_CHANGED' }
  | { code: 'NODE_REMOVED'; nodeKey: string }
  | { code: 'NODE_CHANGED'; nodeKey: string }
  | { code: 'EDGES_CHANGED'; nodeKey: string };

export type InstanceMigrationAnalysisResult = { safe: true } | { safe: false; reason: MigrationBlockReason };

const edgesFrom = (model: WorkflowModel, nodeKey: string): WorkflowEdgeDefinition[] => (
  model.edges.filter((edge) => edge.fromNodeKey === nodeKey).slice().sort((a, b) => a.key.localeCompare(b.key))
);

/**
 * Pure "safe subset" migration analyzer (p-99/WFT-8, per the user's explicit scoping decision — no
 * partial/best-effort migration in V1, a blocked instance is simply left exactly where it is). An
 * in-flight instance is safe to bulk-migrate from `oldModel` to `newModel` only if the ENTIRE
 * forward-reachable subgraph from its currently non-terminal node keys — not just the node it happens
 * to be sitting on right now, since it will keep walking the graph after migration — is byte-identical
 * between the two revisions, and `variables`/`policies` (which affect execution beyond any single
 * node) are unchanged too. Anything less strict risks routing a real in-flight process through logic
 * that publish-time validation only ever ran against the OTHER revision.
 */
export function analyzeInstanceMigration(
  oldModel: WorkflowModel,
  newModel: WorkflowModel,
  activeNodeKeys: readonly string[],
): InstanceMigrationAnalysisResult {
  if (!typedEqual(oldModel.variables as unknown as JsonValue, newModel.variables as unknown as JsonValue)) {
    return { safe: false, reason: { code: 'VARIABLES_CHANGED' } };
  }
  if (!typedEqual(oldModel.policies as unknown as JsonValue, newModel.policies as unknown as JsonValue)) {
    return { safe: false, reason: { code: 'POLICIES_CHANGED' } };
  }

  const oldNodesByKey = new Map(oldModel.nodes.map((node) => [node.key, node]));
  const newNodesByKey = new Map(newModel.nodes.map((node) => [node.key, node]));

  const visited = new Set<string>();
  const queue = [...activeNodeKeys];
  while (queue.length > 0) {
    const nodeKey = queue.shift();
    if (nodeKey === undefined || visited.has(nodeKey)) continue;
    visited.add(nodeKey);

    const newNode = newNodesByKey.get(nodeKey);
    if (!newNode) return { safe: false, reason: { code: 'NODE_REMOVED', nodeKey } };
    const oldNode = oldNodesByKey.get(nodeKey);
    if (!oldNode || !typedEqual(oldNode as unknown as JsonValue, newNode as unknown as JsonValue)) {
      return { safe: false, reason: { code: 'NODE_CHANGED', nodeKey } };
    }

    const oldOutgoing = edgesFrom(oldModel, nodeKey);
    const newOutgoing = edgesFrom(newModel, nodeKey);
    if (!typedEqual(oldOutgoing as unknown as JsonValue, newOutgoing as unknown as JsonValue)) {
      return { safe: false, reason: { code: 'EDGES_CHANGED', nodeKey } };
    }

    for (const edge of oldOutgoing) {
      queue.push(edge.toNodeKey);
    }
  }

  return { safe: true };
}

export type InstanceMigrationImpactItem = { instanceId: number; safe: boolean; reason?: MigrationBlockReason };
export type InstanceMigrationImpact = {
  fromRevisionId: number;
  toRevisionId: number;
  totalConsidered: number;
  migratableCount: number;
  blockedCount: number;
  items: InstanceMigrationImpactItem[];
};

const loadModel = async (revisionId: number): Promise<{ workflowDefinitionId: number; publicationStatus: string; model: WorkflowModel }> => {
  const revision = await getWorkflowRevisionById(revisionId);
  if (!revision) {
    throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowRevision not found.', { revisionId });
  }
  return {
    workflowDefinitionId: revision.workflowDefinitionId,
    publicationStatus: revision.publicationStatus,
    model: JSON.parse(revision.definitionJson) as WorkflowModel,
  };
};

/** Read-only preflight — every non-terminal instance on `fromRevisionId`, classified migratable vs blocked. */
export async function getInstanceMigrationImpact(fromRevisionId: number, toRevisionId: number): Promise<InstanceMigrationImpact> {
  if (fromRevisionId === toRevisionId) {
    throw new WorkflowDomainError('WF_DEF_NOT_STARTABLE', 'fromRevisionId and toRevisionId must differ.', { fromRevisionId, toRevisionId });
  }
  const [from, to] = await Promise.all([loadModel(fromRevisionId), loadModel(toRevisionId)]);
  if (from.workflowDefinitionId !== to.workflowDefinitionId) {
    throw new WorkflowDomainError('WF_DEF_NOT_STARTABLE', 'Both revisions must belong to the same WorkflowDefinition.', { fromRevisionId, toRevisionId });
  }
  if (to.publicationStatus !== 'PUBLISHED') {
    throw new WorkflowDomainError('WF_DEF_NOT_STARTABLE', 'Target revision is not PUBLISHED.', { toRevisionId });
  }

  const instances = await listNonTerminalInstancesByRevisionId(fromRevisionId);
  const items: InstanceMigrationImpactItem[] = [];
  for (const instance of instances) {
    const nodeInstances = await listNodeInstancesForInstance(instance.id);
    const activeNodeKeys = nodeInstances
      .filter((nodeInstance) => NON_TERMINAL_NODE_STATUSES.has(nodeInstance.status))
      .map((nodeInstance) => nodeInstance.semanticNodeKey);
    const analysis = analyzeInstanceMigration(from.model, to.model, activeNodeKeys);
    if ('reason' in analysis) {
      items.push({ instanceId: instance.id, safe: false, reason: analysis.reason });
    } else {
      items.push({ instanceId: instance.id, safe: true });
    }
  }

  return {
    fromRevisionId,
    toRevisionId,
    totalConsidered: items.length,
    migratableCount: items.filter((item) => item.safe).length,
    blockedCount: items.filter((item) => !item.safe).length,
    items,
  };
}

/**
 * Commits the migration: re-runs the same impact analysis (never trusts a caller-supplied stale
 * item list) and CAS-rebinds every currently-safe instance's `workflowRevisionId`. An instance the
 * live engine raced into a terminal state (or already migrated) in the meantime is silently skipped,
 * not retried or force-migrated — `migratedCount` reports only what actually committed.
 */
export async function migrateInstancesToRevision(fromRevisionId: number, toRevisionId: number): Promise<InstanceMigrationImpact & { migratedCount: number }> {
  const impact = await getInstanceMigrationImpact(fromRevisionId, toRevisionId);
  let migratedCount = 0;
  for (const item of impact.items) {
    if (!item.safe) continue;
    const current = await getWorkflowInstanceById(item.instanceId);
    if (!current) continue;
    const migrated = await migrateInstanceRevision(item.instanceId, current.stateVersion, fromRevisionId, toRevisionId);
    if (migrated) migratedCount += 1;
  }
  return { ...impact, migratedCount };
}
