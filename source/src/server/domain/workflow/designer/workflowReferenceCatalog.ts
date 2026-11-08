import type { WorkflowModel, CanonicalPath, CanonicalPathRoot } from '../awm/types';
import { WorkflowDomainError } from '../errors';
import { buildGraph, reachableFrom, topologicalOrder, computeDominators, dominates, type WorkflowGraph } from '../publication/graphAnalysis';

/**
 * `WorkflowReferenceCatalog` — sole authority per
 * docs/standards/workflow-engine-testing.md (doc 02 §7)
 * 08-DESIGNER-AND-AUTHORING.md section 7 (the `@` picker) and
 * 03/13-DELIVERY-PLAN.md section 5 (reference tests). "Authorized context-valid roots" for a given
 * authoring position resolve to exactly the same `CanonicalPathRoot` shapes/legality rules
 * `publication/rules/expressionValidation.ts` already enforces at validation time (NODE_OUTPUT
 * structural dominance, CURRENT_EVENT/CURRENT_WORK_ITEM scoping) — this module is the read-side
 * projection of that same authority, not a second set of rules. Runtime never parses `@` strings;
 * compilation here produces the canonical AST the client submits as a typed draft-operation field,
 * matching doc 02 section 7's "the client may display `@InvoiceCheck.output.total`... an authorized
 * WorkflowReferenceCatalog resolves exactly one descriptor and compiles it to canonical AST/mapping".
 */

export type WorkflowReferenceContext = {
  /** Node the picker is invoked from, or null for a workflow-level surface (e.g. `start.correlation`, a variable's `initialValue`). */
  consumerNodeKey: string | null;
  /** True only inside a WAIT_EVENT's correlation/timeout/outputAssignments or the EVENT start's correlation — mirrors expressionValidation.ts's ExprContext. */
  isWaitEventContext: boolean;
  /** True only inside a WORK_ITEM node's own outputAssignments — mirrors expressionValidation.ts's ExprContext. */
  isWorkItemOutputContext: boolean;
  /** True only inside the owning node's own outputAssignments — required for a node to reference its own NODE_OUTPUT. */
  isOutputAssignmentContext: boolean;
  /** WFV2-2 — true inside a FOR_EACH node's `input` mapping, or a LOOP node's `condition`/`input`. */
  isForEachItemContext: boolean;
};

export type WorkflowReferenceDescriptor =
  | { type: 'WORKFLOW_INPUT'; label: string }
  | { type: 'WORKFLOW_VARIABLE'; variableKey: string; label: string }
  | { type: 'NODE_OUTPUT'; nodeKey: string; label: string; /** WFV2-22 — hops from consumer along the topo order (nearest ancestor first). */ ancestorDistance: number }
  | { type: 'CURRENT_NODE_INPUT'; label: string }
  | { type: 'CURRENT_EVENT'; label: string }
  | { type: 'CURRENT_WORK_ITEM'; projection: 'OUTCOME' | 'OUTPUT'; label: string }
  | { type: 'CURRENT_ITEM'; label: string }
  | { type: 'CURRENT_ITEM_INDEX'; label: string };

/** Stable descriptor identity for dedupe/selection — never the (fuzzy, possibly colliding) display label. */
export function descriptorIdentity(descriptor: WorkflowReferenceDescriptor): string {
  switch (descriptor.type) {
    case 'WORKFLOW_INPUT':
      return 'WORKFLOW_INPUT';
    case 'WORKFLOW_VARIABLE':
      return `WORKFLOW_VARIABLE:${descriptor.variableKey}`;
    case 'NODE_OUTPUT':
      return `NODE_OUTPUT:${descriptor.nodeKey}`;
    case 'CURRENT_NODE_INPUT':
      return 'CURRENT_NODE_INPUT';
    case 'CURRENT_EVENT':
      return 'CURRENT_EVENT';
    case 'CURRENT_WORK_ITEM':
      return `CURRENT_WORK_ITEM:${descriptor.projection}`;
    case 'CURRENT_ITEM':
      return 'CURRENT_ITEM';
    case 'CURRENT_ITEM_INDEX':
      return 'CURRENT_ITEM_INDEX';
    /* istanbul ignore next -- exhaustiveness guard */
    default: {
      const exhaustive: never = descriptor;
      throw new Error(`Unknown reference descriptor: ${JSON.stringify(exhaustive)}`);
    }
  }
}

type DominanceIndex = { dom: Map<string, Set<string>>; order: string[] };

function buildDominanceIndex(graph: WorkflowGraph, model: WorkflowModel): DominanceIndex | null {
  const reachable = reachableFrom(graph, model.start.targetNodeKey);
  const order = topologicalOrder(graph, reachable);
  if (order === null) {
    // A cyclic draft cannot have a proven NODE_OUTPUT dominance order — degrade to "no NODE_OUTPUT
    // candidates" rather than throw, since the Designer must still be able to render/pick
    // WORKFLOW_INPUT/WORKFLOW_VARIABLE references for an in-progress, not-yet-valid draft.
    return null;
  }
  return { dom: computeDominators(graph, model.start.targetNodeKey, order), order };
}

/** WFV2-22 — topo-index delta from ancestor → consumer (1 = immediate upstream). */
function ancestorDistanceFromOrder(order: string[], ancestorKey: string, consumerKey: string): number {
  const consumerIndex = order.indexOf(consumerKey);
  const ancestorIndex = order.indexOf(ancestorKey);
  if (consumerIndex < 0 || ancestorIndex < 0 || ancestorIndex > consumerIndex) return 0;
  return consumerIndex - ancestorIndex;
}

/**
 * `WorkflowReferenceCatalog.GetAuthorizedDescriptors` (doc 02 section 13). Pure function over the
 * canonical draft/resolved model — no persistence. Ordering is deterministic (declaration order)
 * so repeated calls over an unchanged model return an identical list.
 */
export function getAuthorizedWorkflowReferences(model: WorkflowModel, context: WorkflowReferenceContext): WorkflowReferenceDescriptor[] {
  const descriptors: WorkflowReferenceDescriptor[] = [{ type: 'WORKFLOW_INPUT', label: 'Workflow Input' }];

  for (const variable of model.variables) {
    descriptors.push({ type: 'WORKFLOW_VARIABLE', variableKey: variable.key, label: `Workflow Context: ${variable.key}` });
  }

  if (context.consumerNodeKey !== null) {
    const graph = buildGraph(model);
    if (graph.nodeByKey.has(context.consumerNodeKey)) {
      const dominance = buildDominanceIndex(graph, model);
      if (dominance !== null) {
        const nodeOutputDescriptors: Extract<WorkflowReferenceDescriptor, { type: 'NODE_OUTPUT' }>[] = [];
        for (const node of model.nodes) {
          if (node.key === context.consumerNodeKey) {
            if (context.isOutputAssignmentContext) {
              nodeOutputDescriptors.push({
                type: 'NODE_OUTPUT',
                nodeKey: node.key,
                label: `${node.key}.output (self)`,
                ancestorDistance: 0,
              });
            }
            continue;
          }
          if (dominates(dominance.dom, node.key, context.consumerNodeKey)) {
            nodeOutputDescriptors.push({
              type: 'NODE_OUTPUT',
              nodeKey: node.key,
              label: `${node.key}.output`,
              ancestorDistance: ancestorDistanceFromOrder(dominance.order, node.key, context.consumerNodeKey),
            });
          }
        }
        nodeOutputDescriptors.sort((a, b) => a.ancestorDistance - b.ancestorDistance || a.nodeKey.localeCompare(b.nodeKey));
        descriptors.push(...nodeOutputDescriptors);
      }
    }
    descriptors.push({ type: 'CURRENT_NODE_INPUT', label: 'Current Node Input' });
  }

  if (context.isWaitEventContext) {
    descriptors.push({ type: 'CURRENT_EVENT', label: 'Current Event' });
  }

  if (context.isWorkItemOutputContext) {
    descriptors.push({ type: 'CURRENT_WORK_ITEM', projection: 'OUTCOME', label: 'Work Item Outcome' });
    descriptors.push({ type: 'CURRENT_WORK_ITEM', projection: 'OUTPUT', label: 'Work Item Output' });
  }

  if (context.isForEachItemContext) {
    descriptors.push({ type: 'CURRENT_ITEM', label: 'Current Item' });
    descriptors.push({ type: 'CURRENT_ITEM_INDEX', label: 'Current Item Index' });
  }

  return descriptors;
}

/**
 * Fuzzy subsequence match over display labels only (doc 08 section 7: "search may be fuzzy over
 * display metadata"). Never affects the compiled reference itself — selection still resolves by
 * exact descriptor identity, so colliding/duplicate labels can never produce an ambiguous
 * persisted reference (doc 11 section 5).
 */
export function searchWorkflowReferences(descriptors: WorkflowReferenceDescriptor[], query: string): WorkflowReferenceDescriptor[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return descriptors;
  const isSubsequence = (label: string): boolean => {
    let i = 0;
    const lower = label.toLowerCase();
    for (let j = 0; j < lower.length && i < q.length; j += 1) {
      if (lower[j] === q[i]) i += 1;
    }
    return i === q.length;
  };
  return descriptors.filter((d) => isSubsequence(d.label));
}

/**
 * Compiles one exact, previously-listed descriptor plus an optional field-path suffix into a
 * canonical `CanonicalPath` AST. The caller MUST pass a descriptor obtained from
 * `getAuthorizedWorkflowReferences` for the same `model`/`context` — this function re-derives no
 * legality of its own beyond descriptor-shape mapping (doc 02 section 7: "resolves exactly one
 * descriptor and compiles it to canonical AST").
 */
export function compileWorkflowReference(descriptor: WorkflowReferenceDescriptor, segments: Array<string | number> = []): CanonicalPath {
  let root: CanonicalPathRoot;
  switch (descriptor.type) {
    case 'WORKFLOW_INPUT':
      root = { type: 'WORKFLOW_INPUT' };
      break;
    case 'WORKFLOW_VARIABLE':
      root = { type: 'WORKFLOW_VARIABLE', variableKey: descriptor.variableKey };
      break;
    case 'NODE_OUTPUT':
      root = { type: 'NODE_OUTPUT', nodeKey: descriptor.nodeKey };
      break;
    case 'CURRENT_NODE_INPUT':
      root = { type: 'CURRENT_NODE_INPUT' };
      break;
    case 'CURRENT_EVENT':
      root = { type: 'CURRENT_EVENT' };
      break;
    case 'CURRENT_WORK_ITEM':
      root = { type: 'CURRENT_WORK_ITEM', projection: descriptor.projection };
      break;
    case 'CURRENT_ITEM':
      root = { type: 'CURRENT_ITEM' };
      break;
    case 'CURRENT_ITEM_INDEX':
      root = { type: 'CURRENT_ITEM_INDEX' };
      break;
    /* istanbul ignore next -- exhaustiveness guard */
    default: {
      const exhaustive: never = descriptor;
      throw new WorkflowDomainError('WF_DEF_INVALID_REFERENCE', `Unknown reference descriptor: ${JSON.stringify(exhaustive)}`);
    }
  }
  return { root, segments };
}
