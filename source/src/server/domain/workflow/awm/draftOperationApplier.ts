import { WorkflowDomainError } from '../errors';
import type { WorkflowModel, WorkflowNodeDefinition, WorkflowEdgeDefinition } from './types';
import type { WorkflowDraftOperation } from './draftOperations';
import { workflowDraftOperationListSchema } from './draftOperations';
import { workflowModelSchema } from './schemas';

/**
 * Atomic in-memory draft-operation applier — sole authority per
 * 02-ARCHITECTURE-CONTRACT.md section 12 and 05-WORKFLOW-DEFINITION-AND-
 * SEMANTICS.md section 17. Accepts one canonical draft plus exact ordered
 * operations and returns one normalized candidate draft plus deterministic
 * affected semantic keys, or throws a typed `WorkflowDomainError` with no
 * partial candidate authority (this function has no side effects; it never
 * mutates its input and the caller only persists on success).
 *
 * Slice 2 scope boundary: this applier enforces operation-level structural
 * integrity (key uniqueness, MODIFY key-preservation, dangling
 * edge/start-target references after the full ordered list applies) and
 * default-value normalization (doc 05 section 19's stated omitted-field
 * defaults). It does NOT perform deep publication-time semantic validation
 * (reachability, cycles, decision-ambiguity provability, edge-cardinality-
 * per-node-kind per doc 05 section 25, Action availability, secret-literal
 * scanning) — that is doc 05 section 13 territory, delivered in Slice 4
 * ("Revision validation, resolved snapshots and publication/binding
 * lifecycle").
 */

export type DraftOperationApplyResult = {
  candidate: WorkflowModel;
  affectedNodeKeys: string[];
  affectedEdgeKeys: string[];
  workflowLevelChanged: boolean;
};

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const findNodeIndex = (nodes: WorkflowNodeDefinition[], key: string): number => nodes.findIndex((n) => n.key === key);
const findEdgeIndex = (edges: WorkflowEdgeDefinition[], key: string): number => edges.findIndex((e) => e.key === key);

/**
 * Doc 05 section 19 closing paragraph — the only V1 omitted-field normalization rules. Exported
 * for reuse by `publication/resolvedSnapshot.ts` (doc 03 section 20: publication normalizes
 * omitted optional fields before fingerprinting using the same rule as draft normalization — one
 * shared normalizer, not a second copy).
 */
export const normalizeNode = (node: WorkflowNodeDefinition): WorkflowNodeDefinition => {
  if (node.kind === 'DECISION' && node.mode === undefined) {
    return { ...node, mode: 'EXACT_ONE' };
  }
  if (node.kind === 'PARALLEL_JOIN' && node.cancelRemaining === undefined) {
    return { ...node, cancelRemaining: false };
  }
  return node;
};

export function applyDraftOperations(currentDraft: WorkflowModel, operations: readonly WorkflowDraftOperation[]): DraftOperationApplyResult {
  const parsedDraft = workflowModelSchema.safeParse(currentDraft);
  if (!parsedDraft.success) {
    throw new WorkflowDomainError('WF_DEF_INVALID_AWM', 'Current draft failed canonical AWM shape validation.', { issues: parsedDraft.error.issues });
  }
  const parsedOps = workflowDraftOperationListSchema.safeParse(operations);
  if (!parsedOps.success) {
    throw new WorkflowDomainError('WF_DEF_INVALID_AWM', 'One or more draft operations failed canonical shape validation.', { issues: parsedOps.error.issues });
  }

  const candidate = deepClone(parsedDraft.data) as WorkflowModel;
  const affectedNodeKeys = new Set<string>();
  const affectedEdgeKeys = new Set<string>();
  let workflowLevelChanged = false;

  for (const op of parsedOps.data) {
    switch (op.type) {
      case 'ADD_NODE': {
        if (findNodeIndex(candidate.nodes, op.node.key) !== -1) {
          throw new WorkflowDomainError('WF_DEF_INVALID_AWM', `ADD_NODE: node key "${op.node.key}" already exists.`, { nodeKey: op.node.key });
        }
        candidate.nodes.push(op.node);
        affectedNodeKeys.add(op.node.key);
        break;
      }
      case 'MODIFY_NODE': {
        if (op.replacement.key !== op.nodeKey) {
          throw new WorkflowDomainError('WF_DEF_INVALID_AWM', 'MODIFY_NODE cannot rename a node key; use REMOVE_NODE plus ADD_NODE.', { nodeKey: op.nodeKey, replacementKey: op.replacement.key });
        }
        const index = findNodeIndex(candidate.nodes, op.nodeKey);
        if (index === -1) {
          throw new WorkflowDomainError('WF_DEF_INVALID_REFERENCE', `MODIFY_NODE: node key "${op.nodeKey}" does not exist.`, { nodeKey: op.nodeKey });
        }
        candidate.nodes[index] = op.replacement;
        affectedNodeKeys.add(op.nodeKey);
        break;
      }
      case 'REMOVE_NODE': {
        const index = findNodeIndex(candidate.nodes, op.nodeKey);
        if (index === -1) {
          throw new WorkflowDomainError('WF_DEF_INVALID_REFERENCE', `REMOVE_NODE: node key "${op.nodeKey}" does not exist.`, { nodeKey: op.nodeKey });
        }
        candidate.nodes.splice(index, 1);
        affectedNodeKeys.add(op.nodeKey);
        break;
      }
      case 'ADD_EDGE': {
        if (findEdgeIndex(candidate.edges, op.edge.key) !== -1) {
          throw new WorkflowDomainError('WF_DEF_INVALID_EDGE_SHAPE', `ADD_EDGE: edge key "${op.edge.key}" already exists.`, { edgeKey: op.edge.key });
        }
        candidate.edges.push(op.edge);
        affectedEdgeKeys.add(op.edge.key);
        break;
      }
      case 'MODIFY_EDGE': {
        if (op.replacement.key !== op.edgeKey) {
          throw new WorkflowDomainError('WF_DEF_INVALID_EDGE_SHAPE', 'MODIFY_EDGE cannot rename an edge key; use REMOVE_EDGE plus ADD_EDGE.', { edgeKey: op.edgeKey, replacementKey: op.replacement.key });
        }
        const index = findEdgeIndex(candidate.edges, op.edgeKey);
        if (index === -1) {
          throw new WorkflowDomainError('WF_DEF_INVALID_REFERENCE', `MODIFY_EDGE: edge key "${op.edgeKey}" does not exist.`, { edgeKey: op.edgeKey });
        }
        candidate.edges[index] = op.replacement;
        affectedEdgeKeys.add(op.edgeKey);
        break;
      }
      case 'REMOVE_EDGE': {
        const index = findEdgeIndex(candidate.edges, op.edgeKey);
        if (index === -1) {
          throw new WorkflowDomainError('WF_DEF_INVALID_REFERENCE', `REMOVE_EDGE: edge key "${op.edgeKey}" does not exist.`, { edgeKey: op.edgeKey });
        }
        candidate.edges.splice(index, 1);
        affectedEdgeKeys.add(op.edgeKey);
        break;
      }
      case 'CHANGE_START': {
        candidate.start = op.start;
        workflowLevelChanged = true;
        break;
      }
      case 'CHANGE_WORKFLOW_SCHEMA': {
        candidate.inputSchema = op.inputSchema;
        candidate.outputSchema = op.outputSchema;
        candidate.variables = op.variables;
        workflowLevelChanged = true;
        break;
      }
      case 'CHANGE_WORKFLOW_POLICY': {
        candidate.policies = op.policies;
        workflowLevelChanged = true;
        break;
      }
      /* istanbul ignore next -- exhaustiveness guard, unreachable: workflowDraftOperationListSchema already rejects unknown discriminants */
      default: {
        const exhaustive: never = op;
        throw new WorkflowDomainError('WF_DEF_INVALID_AWM', `Unknown draft operation type: ${JSON.stringify(exhaustive)}`);
      }
    }
  }

  // Final structural validation — runs once after the complete ordered operation list (doc 02
  // section 12; doc 05 section 25's start-target rule). Deep semantic/cardinality validation
  // beyond dangling-reference detection is explicitly deferred to Slice 4 (see module doc comment).
  const nodeKeySet = new Set(candidate.nodes.map((n) => n.key));
  for (const edge of candidate.edges) {
    if (!nodeKeySet.has(edge.fromNodeKey)) {
      throw new WorkflowDomainError('WF_DEF_INVALID_REFERENCE', `Edge "${edge.key}" references missing fromNodeKey "${edge.fromNodeKey}".`, { edgeKey: edge.key });
    }
    if (!nodeKeySet.has(edge.toNodeKey)) {
      throw new WorkflowDomainError('WF_DEF_INVALID_REFERENCE', `Edge "${edge.key}" references missing toNodeKey "${edge.toNodeKey}".`, { edgeKey: edge.key });
    }
  }
  if (!nodeKeySet.has(candidate.start.targetNodeKey)) {
    throw new WorkflowDomainError('WF_DEF_INVALID_REFERENCE', `Start targetNodeKey "${candidate.start.targetNodeKey}" does not exist.`, { targetNodeKey: candidate.start.targetNodeKey });
  }

  // Normalize once after the final operation (doc 02 section 12; doc 05 section 19).
  candidate.nodes = candidate.nodes.map(normalizeNode);

  const finalCheck = workflowModelSchema.safeParse(candidate);
  if (!finalCheck.success) {
    throw new WorkflowDomainError('WF_DEF_INVALID_AWM', 'Resulting candidate draft failed canonical AWM shape validation.', { issues: finalCheck.error.issues });
  }

  return {
    candidate: finalCheck.data as WorkflowModel,
    affectedNodeKeys: Array.from(affectedNodeKeys),
    affectedEdgeKeys: Array.from(affectedEdgeKeys),
    workflowLevelChanged,
  };
}
