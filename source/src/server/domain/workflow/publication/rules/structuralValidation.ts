import type { WorkflowModel, WorkflowEdgeDefinition, CanonicalExpression, JsonValue } from '../../awm/types';
import { WORKFLOW_ERROR_REGISTRY } from '../../errors';
import { canonicalJsonFingerprint } from '../../canonicalJson';
import type { ValidationIssue } from '../validationTypes';
import { buildGraph, reachableFrom, topologicalOrder, type WorkflowGraph } from '../graphAnalysis';

/**
 * Graph-shape and topology validation — doc 05 sections 13, 21, 22, 25, 32.
 * Pure function of the AWM model; no Action registry, no persistence.
 */

const isTerminalKind = (kind: string): boolean => kind === 'END' || kind === 'FAIL';

function validateKeyUniqueness(model: WorkflowModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodeKeys = new Map<string, number>();
  for (const node of model.nodes) nodeKeys.set(node.key, (nodeKeys.get(node.key) ?? 0) + 1);
  for (const [key, count] of nodeKeys) {
    if (count > 1) {
      issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM, severity: 'ERROR', message: `Duplicate node key "${key}".`, nodeKey: key });
    }
  }
  const edgeKeys = new Map<string, number>();
  for (const edge of model.edges) edgeKeys.set(edge.key, (edgeKeys.get(edge.key) ?? 0) + 1);
  for (const [key, count] of edgeKeys) {
    if (count > 1) {
      issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_EDGE_SHAPE, severity: 'ERROR', message: `Duplicate edge key "${key}".`, edgeKey: key });
    }
  }
  return issues;
}

function validateReferencesAndStartShape(model: WorkflowModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodeKeySet = new Set(model.nodes.map((n) => n.key));
  for (const edge of model.edges) {
    if (!nodeKeySet.has(edge.fromNodeKey)) {
      issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_REFERENCE, severity: 'ERROR', message: `Edge "${edge.key}" references missing fromNodeKey "${edge.fromNodeKey}".`, edgeKey: edge.key });
    }
    if (!nodeKeySet.has(edge.toNodeKey)) {
      issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_REFERENCE, severity: 'ERROR', message: `Edge "${edge.key}" references missing toNodeKey "${edge.toNodeKey}".`, edgeKey: edge.key });
    }
  }
  if (!nodeKeySet.has(model.start.targetNodeKey)) {
    issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_REFERENCE, severity: 'ERROR', message: `Start targetNodeKey "${model.start.targetNodeKey}" does not exist.` });
    return issues;
  }
  const incomingCount = new Map<string, number>();
  for (const node of model.nodes) incomingCount.set(node.key, 0);
  for (const edge of model.edges) {
    if (incomingCount.has(edge.toNodeKey)) incomingCount.set(edge.toNodeKey, (incomingCount.get(edge.toNodeKey) ?? 0) + 1);
  }
  if ((incomingCount.get(model.start.targetNodeKey) ?? 0) > 0) {
    issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM, severity: 'ERROR', message: 'Start target node MUST have no incoming edge (doc 05 section 25).', nodeKey: model.start.targetNodeKey });
  }
  for (const node of model.nodes) {
    if (node.key === model.start.targetNodeKey) continue;
    if ((incomingCount.get(node.key) ?? 0) === 0) {
      issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM, severity: 'ERROR', message: `Node "${node.key}" has no incoming edge and is not the start target (doc 05 section 25).`, nodeKey: node.key });
    }
  }
  return issues;
}

/** WFV2-19 — `excludeUsersFromWorkItemKeys` must reference existing, other, WORK_ITEM-kind nodes. */
function validateSeparationOfDutiesReferences(model: WorkflowModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodesByKey = new Map(model.nodes.map((n) => [n.key, n]));
  for (const node of model.nodes) {
    if (node.kind !== 'WORK_ITEM' || !node.excludeUsersFromWorkItemKeys?.length) continue;
    for (const excludedKey of node.excludeUsersFromWorkItemKeys) {
      if (excludedKey === node.key) {
        issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM, severity: 'ERROR', message: `WORK_ITEM node "${node.key}" cannot list itself in excludeUsersFromWorkItemKeys.`, nodeKey: node.key });
        continue;
      }
      const referenced = nodesByKey.get(excludedKey);
      if (!referenced) {
        issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_REFERENCE, severity: 'ERROR', message: `WORK_ITEM node "${node.key}" excludeUsersFromWorkItemKeys references missing node "${excludedKey}".`, nodeKey: node.key });
      } else if (referenced.kind !== 'WORK_ITEM') {
        issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM, severity: 'ERROR', message: `WORK_ITEM node "${node.key}" excludeUsersFromWorkItemKeys references "${excludedKey}", which is kind ${referenced.kind}, not WORK_ITEM.`, nodeKey: node.key });
      }
    }
  }
  return issues;
}

/** WFV2-20 — `SAME_AS_WORK_ITEM.workItemNodeKey` must reference an existing, other, WORK_ITEM-kind node. */
function validateSameAsWorkItemReferences(model: WorkflowModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodesByKey = new Map(model.nodes.map((n) => [n.key, n]));
  for (const node of model.nodes) {
    if (node.kind !== 'WORK_ITEM' || node.assignment.strategy !== 'SAME_AS_WORK_ITEM') continue;
    const referencedKey = node.assignment.workItemNodeKey;
    if (referencedKey === node.key) {
      issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM, severity: 'ERROR', message: `WORK_ITEM node "${node.key}" cannot use SAME_AS_WORK_ITEM referencing itself.`, nodeKey: node.key });
      continue;
    }
    const referenced = nodesByKey.get(referencedKey);
    if (!referenced) {
      issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_REFERENCE, severity: 'ERROR', message: `WORK_ITEM node "${node.key}" SAME_AS_WORK_ITEM references missing node "${referencedKey}".`, nodeKey: node.key });
    } else if (referenced.kind !== 'WORK_ITEM') {
      issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM, severity: 'ERROR', message: `WORK_ITEM node "${node.key}" SAME_AS_WORK_ITEM references "${referencedKey}", which is kind ${referenced.kind}, not WORK_ITEM.`, nodeKey: node.key });
    }
  }
  return issues;
}

/** Doc 05 section 25's exhaustive outgoing-edge cardinality/selector matrix. */
function validateEdgeCardinality(model: WorkflowModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const outgoingByNode = new Map<string, WorkflowEdgeDefinition[]>();
  for (const node of model.nodes) outgoingByNode.set(node.key, []);
  for (const edge of model.edges) {
    if (outgoingByNode.has(edge.fromNodeKey)) outgoingByNode.get(edge.fromNodeKey)!.push(edge);
  }

  const fail = (nodeKey: string, message: string) =>
    issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_EDGE_SHAPE, severity: 'ERROR', message, nodeKey });

  for (const node of model.nodes) {
    const outEdges = outgoingByNode.get(node.key) ?? [];
    switch (node.kind) {
      case 'DELAY':
      case 'PARALLEL_JOIN': {
        const unconditional = outEdges.filter((e) => e.selector.type === 'UNCONDITIONAL');
        if (outEdges.length !== 1 || unconditional.length !== 1) {
          fail(node.key, `${node.kind} node "${node.key}" MUST have exactly one UNCONDITIONAL outgoing edge (found ${outEdges.length}).`);
        }
        break;
      }
      case 'SUBFLOW': {
        // p-99/WFT-9 — CANCEL_REGION is required exactly once when `cancelEvent` is declared (no
        // sensible default continuation for "cancelled with nowhere to go", unlike ON_ERROR's
        // optional-with-instance-failure-fallback shape), and illegal otherwise.
        const unconditional = outEdges.filter((e) => e.selector.type === 'UNCONDITIONAL');
        const cancelRegion = outEdges.filter((e) => e.selector.type === 'CANCEL_REGION');
        const other = outEdges.filter((e) => e.selector.type !== 'UNCONDITIONAL' && e.selector.type !== 'CANCEL_REGION');
        if (unconditional.length !== 1) {
          fail(node.key, `SUBFLOW node "${node.key}" MUST have exactly one UNCONDITIONAL outgoing edge (found ${unconditional.length}).`);
        }
        if (other.length > 0) {
          fail(node.key, `SUBFLOW node "${node.key}" MUST NOT have outgoing edges other than UNCONDITIONAL/CANCEL_REGION.`);
        }
        if (node.cancelEvent && cancelRegion.length !== 1) {
          fail(node.key, `SUBFLOW node "${node.key}" declares cancelEvent and MUST have exactly one CANCEL_REGION outgoing edge (found ${cancelRegion.length}).`);
        }
        if (!node.cancelEvent && cancelRegion.length > 0) {
          fail(node.key, `SUBFLOW node "${node.key}" has a CANCEL_REGION outgoing edge but no cancelEvent configured.`);
        }
        break;
      }
      case 'ACTION':
      case 'FOR_EACH':
      case 'LOOP': {
        // WFV2-1/WFV2-2 — exactly one UNCONDITIONAL edge, plus at most one optional ON_ERROR edge;
        // no other selector type is legal from an ACTION, FOR_EACH, or LOOP node.
        const unconditional = outEdges.filter((e) => e.selector.type === 'UNCONDITIONAL');
        const onError = outEdges.filter((e) => e.selector.type === 'ON_ERROR');
        const other = outEdges.filter((e) => e.selector.type !== 'UNCONDITIONAL' && e.selector.type !== 'ON_ERROR');
        if (unconditional.length !== 1) {
          fail(node.key, `${node.kind} node "${node.key}" MUST have exactly one UNCONDITIONAL outgoing edge (found ${unconditional.length}).`);
        }
        if (onError.length > 1) {
          fail(node.key, `${node.kind} node "${node.key}" MUST have at most one ON_ERROR outgoing edge (found ${onError.length}).`);
        }
        if (other.length > 0) {
          fail(node.key, `${node.kind} node "${node.key}" MUST NOT have outgoing edges other than UNCONDITIONAL/ON_ERROR.`);
        }
        break;
      }
      case 'WORK_ITEM': {
        const outcomeEdges = outEdges.filter((e): e is WorkflowEdgeDefinition & { selector: { type: 'WORK_ITEM_OUTCOME'; outcomeKey: string } } => e.selector.type === 'WORK_ITEM_OUTCOME');
        const other = outEdges.filter((e) => e.selector.type !== 'WORK_ITEM_OUTCOME');
        if (other.length > 0) {
          fail(node.key, `WORK_ITEM node "${node.key}" MUST NOT have outgoing edges other than WORK_ITEM_OUTCOME.`);
        }
        const declared = new Set(node.allowedOutcomes);
        const edgeOutcomeKeys = outcomeEdges.map((e) => e.selector.outcomeKey);
        const edgeOutcomeSet = new Set(edgeOutcomeKeys);
        if (edgeOutcomeKeys.length !== edgeOutcomeSet.size) {
          fail(node.key, `WORK_ITEM node "${node.key}" has duplicate WORK_ITEM_OUTCOME edges for the same outcome key.`);
        }
        if (declared.size !== node.allowedOutcomes.length) {
          fail(node.key, `WORK_ITEM node "${node.key}" declares duplicate allowedOutcomes.`);
        }
        for (const outcome of declared) {
          if (!edgeOutcomeSet.has(outcome)) fail(node.key, `WORK_ITEM node "${node.key}" is missing a WORK_ITEM_OUTCOME edge for declared outcome "${outcome}".`);
        }
        for (const outcome of edgeOutcomeSet) {
          if (!declared.has(outcome)) fail(node.key, `WORK_ITEM node "${node.key}" has a WORK_ITEM_OUTCOME edge for undeclared outcome "${outcome}".`);
        }
        for (const outcome of node.requireReasonOutcomes ?? []) {
          if (!declared.has(outcome)) fail(node.key, `WORK_ITEM node "${node.key}" requireReasonOutcomes references undeclared outcome "${outcome}".`);
        }
        break;
      }
      case 'WAIT_EVENT': {
        const unconditional = outEdges.filter((e) => e.selector.type === 'UNCONDITIONAL');
        const timeoutEdges = outEdges.filter((e): e is WorkflowEdgeDefinition & { selector: { type: 'WAIT_TIMEOUT'; outcomeKey: string } } => e.selector.type === 'WAIT_TIMEOUT');
        const other = outEdges.filter((e) => e.selector.type !== 'UNCONDITIONAL' && e.selector.type !== 'WAIT_TIMEOUT');
        if (other.length > 0) fail(node.key, `WAIT_EVENT node "${node.key}" has an illegal outgoing selector type.`);
        if (unconditional.length !== 1) fail(node.key, `WAIT_EVENT node "${node.key}" MUST have exactly one UNCONDITIONAL outgoing edge.`);
        if (node.timeout) {
          if (timeoutEdges.length !== 1 || timeoutEdges[0]?.selector.outcomeKey !== node.timeout.outcomeKey) {
            fail(node.key, `Timed WAIT_EVENT node "${node.key}" MUST have exactly one WAIT_TIMEOUT edge matching outcomeKey "${node.timeout.outcomeKey}".`);
          }
        } else if (timeoutEdges.length > 0) {
          fail(node.key, `Untimed WAIT_EVENT node "${node.key}" MUST NOT have a WAIT_TIMEOUT edge.`);
        }
        break;
      }
      case 'DECISION': {
        const conditionEdges = outEdges.filter((e) => e.selector.type === 'DECISION');
        const defaultEdges = outEdges.filter((e) => e.selector.type === 'DECISION_DEFAULT');
        const other = outEdges.filter((e) => e.selector.type !== 'DECISION' && e.selector.type !== 'DECISION_DEFAULT');
        if (other.length > 0) fail(node.key, `DECISION node "${node.key}" has an illegal outgoing selector type.`);
        if (conditionEdges.length < 1) fail(node.key, `DECISION node "${node.key}" MUST have at least one DECISION condition edge.`);
        if (defaultEdges.length !== 1) fail(node.key, `DECISION node "${node.key}" MUST have exactly one DECISION_DEFAULT edge (found ${defaultEdges.length}).`);
        break;
      }
      case 'SWITCH': {
        const caseEdges = outEdges.filter((e) => e.selector.type === 'SWITCH_CASE');
        const defaultEdges = outEdges.filter((e) => e.selector.type === 'SWITCH_DEFAULT');
        const other = outEdges.filter((e) => e.selector.type !== 'SWITCH_CASE' && e.selector.type !== 'SWITCH_DEFAULT');
        if (other.length > 0) fail(node.key, `SWITCH node "${node.key}" has an illegal outgoing selector type.`);
        if (caseEdges.length < 1) fail(node.key, `SWITCH node "${node.key}" MUST have at least one SWITCH_CASE edge.`);
        if (defaultEdges.length !== 1) fail(node.key, `SWITCH node "${node.key}" MUST have exactly one SWITCH_DEFAULT edge (found ${defaultEdges.length}).`);

        const caseFingerprints = caseEdges.map((e) => canonicalJsonFingerprint((e.selector as { value: JsonValue }).value));
        const seen = new Set<string>();
        for (let i = 0; i < caseFingerprints.length; i += 1) {
          if (seen.has(caseFingerprints[i])) {
            fail(node.key, `SWITCH node "${node.key}" has duplicate case values after canonical normalization.`);
            break;
          }
          seen.add(caseFingerprints[i]);
        }
        break;
      }
      case 'PARALLEL_SPLIT': {
        const unconditional = outEdges.filter((e) => e.selector.type === 'UNCONDITIONAL');
        const other = outEdges.filter((e) => e.selector.type !== 'UNCONDITIONAL');
        if (other.length > 0) fail(node.key, `PARALLEL_SPLIT node "${node.key}" MUST only have UNCONDITIONAL outgoing edges.`);
        if (unconditional.length < 2) fail(node.key, `PARALLEL_SPLIT node "${node.key}" MUST have two or more outgoing UNCONDITIONAL edges (found ${unconditional.length}).`);
        break;
      }
      case 'END':
      case 'FAIL': {
        if (outEdges.length !== 0) fail(node.key, `${node.kind} node "${node.key}" MUST have zero outgoing edges.`);
        break;
      }
      /* istanbul ignore next -- exhaustiveness guard */
      default: {
        const exhaustive: never = node;
        throw new Error(`Unknown node kind: ${JSON.stringify(exhaustive)}`);
      }
    }
  }
  return issues;
}

/** DECISION FIRST_MATCH priority totality/uniqueness and best-effort statically-provable EXACT_ONE ambiguity (doc 05 section 4, 30). */
function validateDecisionSemantics(model: WorkflowModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const node of model.nodes) {
    if (node.kind !== 'DECISION') continue;
    const conditionEdges = model.edges.filter((e) => e.fromNodeKey === node.key && e.selector.type === 'DECISION') as Array<
      WorkflowEdgeDefinition & { selector: { type: 'DECISION'; condition: CanonicalExpression; priority?: number } }
    >;
    const mode = node.mode ?? 'EXACT_ONE';
    if (mode === 'FIRST_MATCH') {
      const priorities = conditionEdges.map((e) => e.selector.priority);
      if (priorities.some((p) => p === undefined)) {
        issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_EDGE_SHAPE, severity: 'ERROR', message: `FIRST_MATCH DECISION node "${node.key}" requires an explicit priority on every condition edge.`, nodeKey: node.key });
      } else {
        const unique = new Set(priorities as number[]);
        if (unique.size !== priorities.length) {
          issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_EDGE_SHAPE, severity: 'ERROR', message: `FIRST_MATCH DECISION node "${node.key}" requires unique priorities across all condition edges.`, nodeKey: node.key });
        }
      }
    } else {
      // EXACT_ONE: only statically provable ambiguity is flagged (doc 05 section 4) — two condition
      // edges with a canonically identical condition expression can never both be legitimately
      // exclusive, so they are a provable ambiguity. General predicate satisfiability is not
      // theorem-proved here (doc 05 section 18 explicitly scopes that out).
      const fingerprints = conditionEdges.map((e) => canonicalJsonFingerprint(e.selector.condition));
      const byFingerprint = new Map<string, number>();
      for (const fp of fingerprints) byFingerprint.set(fp, (byFingerprint.get(fp) ?? 0) + 1);
      for (const [, count] of byFingerprint) {
        if (count > 1) {
          issues.push({ code: WORKFLOW_ERROR_REGISTRY.AMBIGUOUS_DECISION_VALIDATION, severity: 'ERROR', message: `EXACT_ONE DECISION node "${node.key}" has two condition edges with a canonically identical condition — statically provable ambiguity.`, nodeKey: node.key });
          break;
        }
      }
      // Two literal-true conditions are always simultaneously true regardless of textual identity.
      const literalTrueCount = conditionEdges.filter((e) => e.selector.condition.op === 'LITERAL' && e.selector.condition.value === true).length;
      if (literalTrueCount > 1) {
        issues.push({ code: WORKFLOW_ERROR_REGISTRY.AMBIGUOUS_DECISION_VALIDATION, severity: 'ERROR', message: `EXACT_ONE DECISION node "${node.key}" has more than one condition edge that is statically always-true.`, nodeKey: node.key });
      }
    }
  }
  return issues;
}

function validateReachabilityCyclesAndTerminalPaths(model: WorkflowModel, graph: WorkflowGraph): { issues: ValidationIssue[]; reachable: Set<string>; order: string[] | null } {
  const issues: ValidationIssue[] = [];
  const reachable = reachableFrom(graph, model.start.targetNodeKey);
  for (const node of model.nodes) {
    if (!reachable.has(node.key)) {
      issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM, severity: 'ERROR', message: `Node "${node.key}" is unreachable from the start target.`, nodeKey: node.key });
    }
  }

  const order = topologicalOrder(graph, reachable);
  if (order === null) {
    issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM, severity: 'ERROR', message: 'The reachable graph contains a cycle; V1 published graphs MUST be acyclic (doc 05 section 20).' });
    return { issues, reachable, order: null };
  }

  // Terminal-path existence: every reachable node must have a structural path to an END/FAIL node.
  const canReachTerminal = new Set<string>();
  for (let i = order.length - 1; i >= 0; i -= 1) {
    const key = order[i];
    const node = graph.nodeByKey.get(key);
    if (node && isTerminalKind(node.kind)) {
      canReachTerminal.add(key);
      continue;
    }
    for (const edge of graph.outgoing.get(key) ?? []) {
      if (canReachTerminal.has(edge.toNodeKey)) {
        canReachTerminal.add(key);
        break;
      }
    }
  }
  for (const key of reachable) {
    if (!canReachTerminal.has(key)) {
      issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM, severity: 'ERROR', message: `Node "${key}" is a reachable branch with no structural path to an END or FAIL node.`, nodeKey: key });
    }
  }

  return { issues, reachable, order };
}

export type StructuralValidationOutcome = {
  issues: ValidationIssue[];
  graph: WorkflowGraph;
  reachable: Set<string>;
  /** Topological order of the reachable subgraph, or null when a cycle was detected (downstream dominance/parallel checks are skipped in that case). */
  order: string[] | null;
};

export function runStructuralValidation(model: WorkflowModel): StructuralValidationOutcome {
  const issues: ValidationIssue[] = [];
  issues.push(...validateKeyUniqueness(model));

  // Duplicate keys make the graph maps below ambiguous — stop before building them.
  if (issues.some((i) => i.severity === 'ERROR')) {
    return { issues, graph: buildGraph(model), reachable: new Set(), order: null };
  }

  issues.push(...validateReferencesAndStartShape(model));
  const hasDanglingRef = issues.some((i) => i.code === WORKFLOW_ERROR_REGISTRY.DEF_INVALID_REFERENCE);
  const graph = buildGraph(model);
  if (hasDanglingRef) {
    return { issues, graph, reachable: new Set(), order: null };
  }

  issues.push(...validateEdgeCardinality(model));
  issues.push(...validateDecisionSemantics(model));
  issues.push(...validateSeparationOfDutiesReferences(model));
  issues.push(...validateSameAsWorkItemReferences(model));

  const { issues: reachabilityIssues, reachable, order } = validateReachabilityCyclesAndTerminalPaths(model, graph);
  issues.push(...reachabilityIssues);

  return { issues, graph, reachable, order };
}
