import type { WorkflowModel, WorkflowNodeDefinition, CanonicalExpression, CanonicalMapping, CanonicalMappingValue, ContextAssignment } from '../../awm/types';
import { WORKFLOW_ERROR_REGISTRY } from '../../errors';
import type { ValidationIssue } from '../validationTypes';
import { computeDominators, dominates, type WorkflowGraph } from '../graphAnalysis';
import type { ParallelRegionMembership } from './parallelValidation';

/**
 * Expression/context-legality validation — doc 05 section 26 (NODE_OUTPUT dominance, CURRENT_EVENT
 * / CURRENT_WORK_ITEM scoping, maxExpressionNodes) and section 24 (concurrent-branch variable write
 * conflicts). Requires the acyclic topological order from structuralValidation — callers skip this
 * module when a cycle was already reported.
 */

type ExprContext = { ownerNodeKey: string | null; isOutputAssignmentContext: boolean; isWaitEventContext: boolean; isWorkItemOutputContext: boolean; isForEachItemContext: boolean; fieldPath: string };

type CollectedExpression = { expression: CanonicalExpression; context: ExprContext };

function walkExpression(expression: CanonicalExpression, context: ExprContext, sink: CollectedExpression[]): void {
  sink.push({ expression, context });
  switch (expression.op) {
    case 'LITERAL':
    case 'PATH':
      return;
    case 'NOT':
    case 'IS_NULL':
    case 'IS_NOT_NULL':
      walkExpression(expression.value, context, sink);
      return;
    case 'AND':
    case 'OR':
    case 'CONCAT':
    case 'COALESCE':
      for (const v of expression.values) walkExpression(v, context, sink);
      return;
    case 'EQ':
    case 'NE':
    case 'LT':
    case 'LTE':
    case 'GT':
    case 'GTE':
    case 'ADD':
    case 'SUB':
    case 'MUL':
    case 'DIV':
    case 'MOD':
      walkExpression(expression.left, context, sink);
      walkExpression(expression.right, context, sink);
      return;
    case 'IN':
      walkExpression(expression.value, context, sink);
      walkExpression(expression.set, context, sink);
      return;
    case 'PURE_FUNCTION':
      for (const a of expression.args) walkExpression(a, context, sink);
      return;
    /* istanbul ignore next -- exhaustiveness guard */
    default: {
      const exhaustive: never = expression;
      throw new Error(`Unknown expression op: ${JSON.stringify(exhaustive)}`);
    }
  }
}

function walkMappingValue(value: CanonicalMappingValue, context: ExprContext, sink: CollectedExpression[]): void {
  if (value.type === 'EXPRESSION') {
    walkExpression(value.expression, context, sink);
  } else if (value.type === 'OBJECT') {
    for (const field of Object.values(value.fields)) walkMappingValue(field, context, sink);
  } else {
    for (const item of value.items) walkMappingValue(item, context, sink);
  }
}

function walkMapping(mapping: CanonicalMapping, context: ExprContext, sink: CollectedExpression[]): void {
  for (const field of Object.values(mapping.fields)) walkMappingValue(field, context, sink);
}

function walkAssignments(assignments: ContextAssignment[] | undefined, ownerNodeKey: string, sink: CollectedExpression[]): void {
  for (const a of assignments ?? []) {
    walkExpression(a.value, { ownerNodeKey, isOutputAssignmentContext: true, isWaitEventContext: false, isWorkItemOutputContext: false, isForEachItemContext: false, fieldPath: `outputAssignments.${a.targetVariableKey}` }, sink);
  }
}

/** Collects every CanonicalExpression in the model, tagged with the field context it occurs in. */
function collectAllExpressions(model: WorkflowModel): CollectedExpression[] {
  const sink: CollectedExpression[] = [];

  if (model.start.type === 'EVENT' && model.start.correlation) {
    walkExpression(model.start.correlation, { ownerNodeKey: null, isOutputAssignmentContext: false, isWaitEventContext: true, isWorkItemOutputContext: false, isForEachItemContext: false, fieldPath: 'start.correlation' }, sink);
  }

  for (const variable of model.variables) {
    if (variable.initialValue) {
      walkExpression(variable.initialValue, { ownerNodeKey: null, isOutputAssignmentContext: false, isWaitEventContext: false, isWorkItemOutputContext: false, isForEachItemContext: false, fieldPath: `variables.${variable.key}.initialValue` }, sink);
    }
  }

  for (const node of model.nodes) {
    const base = (fieldPath: string): ExprContext => ({ ownerNodeKey: node.key, isOutputAssignmentContext: false, isWaitEventContext: false, isWorkItemOutputContext: false, isForEachItemContext: false, fieldPath });
    switch (node.kind) {
      case 'ACTION':
        walkMapping(node.config, base('config'), sink);
        walkMapping(node.input, base('input'), sink);
        walkAssignments(node.outputAssignments, node.key, sink);
        break;
      case 'FOR_EACH': {
        // WFV2-2 — `items` evaluates once with no CURRENT_ITEM bound; `config` also evaluates once
        // (shared across items); only `input` is evaluated per-item, so only it gets isForEachItemContext.
        walkExpression(node.items, base('items'), sink);
        walkMapping(node.config, base('config'), sink);
        walkMapping(node.input, { ownerNodeKey: node.key, isOutputAssignmentContext: false, isWaitEventContext: false, isWorkItemOutputContext: false, isForEachItemContext: true, fieldPath: 'input' }, sink);
        walkAssignments(node.outputAssignments, node.key, sink);
        break;
      }
      case 'LOOP': {
        walkExpression(node.condition, { ownerNodeKey: node.key, isOutputAssignmentContext: false, isWaitEventContext: false, isWorkItemOutputContext: false, isForEachItemContext: true, fieldPath: 'condition' }, sink);
        walkMapping(node.config, base('config'), sink);
        walkMapping(node.input, { ownerNodeKey: node.key, isOutputAssignmentContext: false, isWaitEventContext: false, isWorkItemOutputContext: false, isForEachItemContext: true, fieldPath: 'input' }, sink);
        walkAssignments(node.outputAssignments, node.key, sink);
        break;
      }
      case 'SWITCH':
        walkExpression(node.value, base('value'), sink);
        break;
      case 'DELAY':
        walkExpression(node.delay.value, base('delay.value'), sink);
        break;
      case 'WAIT_EVENT': {
        const waitCtx = (fieldPath: string): ExprContext => ({ ownerNodeKey: node.key, isOutputAssignmentContext: false, isWaitEventContext: true, isWorkItemOutputContext: false, isForEachItemContext: false, fieldPath });
        walkExpression(node.correlation, waitCtx('correlation'), sink);
        if (node.timeout) walkExpression(node.timeout.afterMs, waitCtx('timeout.afterMs'), sink);
        for (const a of node.outputAssignments ?? []) {
          walkExpression(a.value, { ownerNodeKey: node.key, isOutputAssignmentContext: true, isWaitEventContext: true, isWorkItemOutputContext: false, isForEachItemContext: false, fieldPath: `outputAssignments.${a.targetVariableKey}` }, sink);
        }
        break;
      }
      case 'WORK_ITEM':
        walkExpression(node.title, base('title'), sink);
        if (node.summary) walkExpression(node.summary, base('summary'), sink);
        walkMapping(node.input, base('input'), sink);
        for (const a of node.outputAssignments ?? []) {
          walkExpression(a.value, { ownerNodeKey: node.key, isOutputAssignmentContext: true, isWaitEventContext: false, isWorkItemOutputContext: true, isForEachItemContext: false, fieldPath: `outputAssignments.${a.targetVariableKey}` }, sink);
        }
        for (const step of node.escalationPolicy?.steps ?? []) {
          if (step.action.type === 'COMPLETE_WITH_OUTCOME') walkMapping(step.action.output, base(`escalationPolicy.${step.key}.output`), sink);
          if (step.action.type === 'NOTIFY') walkMapping(step.action.input, base(`escalationPolicy.${step.key}.input`), sink);
        }
        break;
      case 'SUBFLOW':
        walkMapping(node.input, base('input'), sink);
        walkAssignments(node.outputAssignments, node.key, sink);
        if (node.cancelEvent) {
          walkExpression(node.cancelEvent.correlation, { ownerNodeKey: node.key, isOutputAssignmentContext: false, isWaitEventContext: true, isWorkItemOutputContext: false, isForEachItemContext: false, fieldPath: 'cancelEvent.correlation' }, sink);
        }
        break;
      case 'END':
        walkMapping(node.output, base('output'), sink);
        break;
      case 'FAIL':
        walkExpression(node.errorCode, base('errorCode'), sink);
        walkExpression(node.safeMessage, base('safeMessage'), sink);
        if (node.details) walkMapping(node.details, base('details'), sink);
        break;
      case 'DECISION':
      case 'PARALLEL_SPLIT':
      case 'PARALLEL_JOIN':
        break;
      /* istanbul ignore next -- exhaustiveness guard */
      default: {
        const exhaustive: never = node;
        throw new Error(`Unknown node kind: ${JSON.stringify(exhaustive)}`);
      }
    }
  }

  for (const edge of model.edges) {
    if (edge.selector.type === 'DECISION') {
      walkExpression(edge.selector.condition, { ownerNodeKey: edge.fromNodeKey, isOutputAssignmentContext: false, isWaitEventContext: false, isWorkItemOutputContext: false, isForEachItemContext: false, fieldPath: `edges.${edge.key}.condition` }, sink);
    }
  }

  return sink;
}

function countExpressionNodes(expression: CanonicalExpression): number {
  switch (expression.op) {
    case 'LITERAL':
    case 'PATH':
      return 1;
    case 'NOT':
    case 'IS_NULL':
    case 'IS_NOT_NULL':
      return 1 + countExpressionNodes(expression.value);
    case 'AND':
    case 'OR':
    case 'CONCAT':
    case 'COALESCE':
      return 1 + expression.values.reduce((sum, v) => sum + countExpressionNodes(v), 0);
    case 'EQ':
    case 'NE':
    case 'LT':
    case 'LTE':
    case 'GT':
    case 'GTE':
    case 'ADD':
    case 'SUB':
    case 'MUL':
    case 'DIV':
    case 'MOD':
      return 1 + countExpressionNodes(expression.left) + countExpressionNodes(expression.right);
    case 'IN':
      return 1 + countExpressionNodes(expression.value) + countExpressionNodes(expression.set);
    case 'PURE_FUNCTION':
      return 1 + expression.args.reduce((sum, a) => sum + countExpressionNodes(a), 0);
    /* istanbul ignore next -- exhaustiveness guard */
    default: {
      const exhaustive: never = expression;
      throw new Error(`Unknown expression op: ${JSON.stringify(exhaustive)}`);
    }
  }
}

export function runExpressionValidation(model: WorkflowModel, graph: WorkflowGraph, order: string[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const dom = computeDominators(graph, model.start.targetNodeKey, order);
  const collected = collectAllExpressions(model);

  for (const { expression, context } of collected) {
    if (countExpressionNodes(expression) > model.policies.limits.maxExpressionNodes) {
      issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM, severity: 'ERROR', message: `Expression at "${context.fieldPath}" exceeds configured maxExpressionNodes (${model.policies.limits.maxExpressionNodes}).`, nodeKey: context.ownerNodeKey ?? undefined, path: context.fieldPath });
    }
  }

  const walkForContext = (expression: CanonicalExpression, context: ExprContext): void => {
    if (expression.op !== 'PATH') return;
    const root = expression.path.root;
    if (root.type === 'CURRENT_EVENT' && !context.isWaitEventContext) {
      issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM, severity: 'ERROR', message: `CURRENT_EVENT is only legal within WAIT_EVENT correlation/timeout/outputAssignments or the EVENT start's correlation (found at "${context.fieldPath}").`, nodeKey: context.ownerNodeKey ?? undefined, path: context.fieldPath });
    }
    if (root.type === 'CURRENT_WORK_ITEM' && !context.isWorkItemOutputContext) {
      issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM, severity: 'ERROR', message: `CURRENT_WORK_ITEM is only legal within a WORK_ITEM node's own outputAssignments (found at "${context.fieldPath}").`, nodeKey: context.ownerNodeKey ?? undefined, path: context.fieldPath });
    }
    if ((root.type === 'CURRENT_ITEM' || root.type === 'CURRENT_ITEM_INDEX') && !context.isForEachItemContext) {
      issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM, severity: 'ERROR', message: `${root.type} is only legal within a FOR_EACH node's \`input\` mapping or a LOOP node's \`condition\`/\`input\` (found at "${context.fieldPath}").`, nodeKey: context.ownerNodeKey ?? undefined, path: context.fieldPath });
    }
    if (root.type === 'NODE_OUTPUT') {
      const refKey = root.nodeKey;
      const owner = context.ownerNodeKey;
      if (!graph.nodeByKey.has(refKey)) {
        issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_REFERENCE, severity: 'ERROR', message: `NODE_OUTPUT references unknown node "${refKey}" (at "${context.fieldPath}").`, nodeKey: owner ?? undefined, path: context.fieldPath });
      } else if (owner === null) {
        issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_REFERENCE, severity: 'ERROR', message: `NODE_OUTPUT("${refKey}") cannot be used outside a node evaluation context (at "${context.fieldPath}").`, path: context.fieldPath });
      } else if (refKey === owner) {
        if (!context.isOutputAssignmentContext) {
          issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_REFERENCE, severity: 'ERROR', message: `Node "${owner}" cannot reference its own NODE_OUTPUT before it has completed (at "${context.fieldPath}").`, nodeKey: owner, path: context.fieldPath });
        }
      } else if (!dominates(dom, refKey, owner)) {
        issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_REFERENCE, severity: 'ERROR', message: `NODE_OUTPUT("${refKey}") at "${context.fieldPath}" is not structurally proven to complete before consumer "${owner}" on every path — reachable-but-not-dominating reference (doc 05 section 26).`, nodeKey: owner, path: context.fieldPath });
      }
    }
    // Sub-expressions were already flattened into `collected` by walkExpression, so no recursion needed here.
  };

  for (const { expression, context } of collected) walkForContext(expression, context);

  return issues;
}

export function runVariableWriteConflictValidation(model: WorkflowModel, membership: ParallelRegionMembership): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const assignmentsByVariable = new Map<string, string[]>();

  const record = (ownerKey: string, assignments: ContextAssignment[] | undefined) => {
    for (const a of assignments ?? []) {
      const owners = assignmentsByVariable.get(a.targetVariableKey) ?? [];
      owners.push(ownerKey);
      assignmentsByVariable.set(a.targetVariableKey, owners);
    }
  };

  const nodeAssignments = (node: WorkflowNodeDefinition): ContextAssignment[] | undefined => {
    if (node.kind === 'ACTION' || node.kind === 'WAIT_EVENT' || node.kind === 'WORK_ITEM' || node.kind === 'SUBFLOW' || node.kind === 'FOR_EACH' || node.kind === 'LOOP') return node.outputAssignments;
    return undefined;
  };

  for (const node of model.nodes) record(node.key, nodeAssignments(node));

  const reportedPairs = new Set<string>();
  for (const [variableKey, owners] of assignmentsByVariable) {
    for (let i = 0; i < owners.length; i += 1) {
      for (let j = i + 1; j < owners.length; j += 1) {
        const a = owners[i];
        const b = owners[j];
        const branchA = membership.nodeToBranch.get(a);
        const branchB = membership.nodeToBranch.get(b);
        const concurrent = !!branchA && !!branchB && branchA.splitNodeKey === branchB.splitNodeKey && branchA.branchEdgeKey !== branchB.branchEdgeKey;
        if (concurrent) {
          const pairKey = `${variableKey}::${[a, b].sort().join('::')}`;
          if (!reportedPairs.has(pairKey)) {
            reportedPairs.add(pairKey);
            issues.push({
              code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM,
              severity: 'ERROR',
              message: `Workflow variable "${variableKey}" may be assigned concurrently by nodes "${a}" and "${b}" in sibling branches of PARALLEL_SPLIT "${branchA!.splitNodeKey}" before their common join (doc 05 section 24).`,
              details: { variableKey, nodeKeys: [a, b] },
            });
          }
        }
      }
    }
  }

  return issues;
}

export function runPureFunctionAvailabilityValidation(model: WorkflowModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const collected = collectAllExpressions(model);
  const seen = new Set<string>();
  for (const { expression, context } of collected) {
    if (expression.op === 'PURE_FUNCTION') {
      const key = `${expression.functionRef.key}@${expression.functionRef.version}`;
      const dedupeKey = `${context.ownerNodeKey ?? ''}::${context.fieldPath}::${key}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      // No pure-function registry exists yet in this repository (Repository Reality Audit,
      // Slice 4) — V1 has no built registered approved pure function set to resolve against, so
      // any PURE_FUNCTION usage is a deterministic missing-platform-contract stop rather than a
      // silently-accepted no-op.
      issues.push({ code: WORKFLOW_ERROR_REGISTRY.MISSING_CANONICAL_PLATFORM_CONTRACT, severity: 'ERROR', message: `PURE_FUNCTION "${key}" cannot be resolved — no registered pure-function registry exists in this repository yet (at "${context.fieldPath}").`, nodeKey: context.ownerNodeKey ?? undefined, path: context.fieldPath });
    }
  }
  return issues;
}
