import { WorkflowDomainError } from '../errors';
import { evaluateExpression, evaluateMapping, typedEqual, type EvaluationContext } from './expressionEvaluator';
import { encodeCorrelationValue } from './eventCorrelation';
import type { ContinuationDecision } from './continuationDecision';
import type {
  CanonicalExpression,
  ContextAssignment,
  DecisionNodeDefinition,
  DelayNodeDefinition,
  EndNodeDefinition,
  FailNodeDefinition,
  ForEachNodeDefinition,
  JsonValue,
  ParallelJoinNodeDefinition,
  ParallelSplitNodeDefinition,
  SwitchNodeDefinition,
  WaitEventNodeDefinition,
  WorkItemAssignmentDefinition,
  WorkItemNodeDefinition,
  WorkflowEdgeDefinition,
  WorkflowModel,
} from '../awm/types';

/**
 * Pure node-kind execution logic (no I/O) — sole runtime authority for DECISION/SWITCH/END/FAIL/
 * DELAY/WAIT_EVENT-creation/PARALLEL_SPLIT/PARALLEL_JOIN/WORK_ITEM-creation semantics per
 * docs/standards/workflow-engine-testing.md (doc 05 §4)
 * (DECISION), 21 (SWITCH), 7/29 (END/FAIL), 23 (DELAY/WAIT_EVENT timeout semantics), 5/22/32
 * (Parallelism), and doc 07 (Human Work Items). ACTION's config/input mapping evaluation is here
 * too; ACTION *dispatch* (executor invocation, attempt lifecycle) is `attemptService.ts` because it
 * needs I/O and durable state.
 *
 * Slice 5 scope was ACTION/DECISION/SWITCH/END/FAIL only; Slice 6 added DELAY/WAIT_EVENT wait
 * *creation*; Slice 7 added PARALLEL_SPLIT/PARALLEL_JOIN; Slice 8 adds WORK_ITEM *creation*
 * (assignment resolution + title/summary/input evaluation) — see `continuationDecision.ts`'s module
 * doc comment for why SUBFLOW remains out of scope.
 */

export const outgoingEdgesOf = (model: WorkflowModel, nodeKey: string): WorkflowEdgeDefinition[] =>
  model.edges.filter((edge) => edge.fromNodeKey === nodeKey);

/** WFV2-1 — the ACTION node's UNCONDITIONAL success edge; `structuralValidation.ts` guarantees exactly one exists on any published revision. */
export const successEdgeOf = (model: WorkflowModel, nodeKey: string): WorkflowEdgeDefinition | undefined =>
  outgoingEdgesOf(model, nodeKey).find((edge) => edge.selector.type === 'UNCONDITIONAL');

/** WFV2-1 — the ACTION node's optional ON_ERROR/CATCH edge, if the author declared one; `structuralValidation.ts` guarantees at most one. */
export const errorEdgeOf = (model: WorkflowModel, nodeKey: string): WorkflowEdgeDefinition | undefined =>
  outgoingEdgesOf(model, nodeKey).find((edge) => edge.selector.type === 'ON_ERROR');

/** p-99/WFT-9 — a SUBFLOW node's CANCEL_REGION edge; `structuralValidation.ts` guarantees it exists exactly once when the node declares `cancelEvent`, and never otherwise. */
export const cancelRegionEdgeOf = (model: WorkflowModel, nodeKey: string): WorkflowEdgeDefinition | undefined =>
  outgoingEdgesOf(model, nodeKey).find((edge) => edge.selector.type === 'CANCEL_REGION');

/**
 * Doc 03 section 29's `EDGE_SELECTED` trace evidence wants "selection mode/reason" — facts derivable
 * purely from the selected edge's own `selector.type` (already a closed discriminant per doc 05
 * section 25) plus, for DECISION, the node's EXACT_ONE/FIRST_MATCH mode. Pure/no I/O so any dispatch
 * call site can compute it right before calling the matching `continuationApply.ts` function.
 */
export function describeEdgeSelection(selectedEdge: WorkflowEdgeDefinition, decisionMode?: 'EXACT_ONE' | 'FIRST_MATCH' | 'MULTI_MATCH'): { selectionMode: string; selectionReason: string } {
  switch (selectedEdge.selector.type) {
    case 'DECISION':
      return { selectionMode: decisionMode ?? 'EXACT_ONE', selectionReason: 'condition edge evaluated true' };
    case 'DECISION_DEFAULT':
      return { selectionMode: decisionMode ?? 'EXACT_ONE', selectionReason: 'no condition edge matched — DECISION_DEFAULT' };
    case 'SWITCH_CASE':
      return { selectionMode: 'SWITCH', selectionReason: 'value matched a SWITCH_CASE' };
    case 'SWITCH_DEFAULT':
      return { selectionMode: 'SWITCH', selectionReason: 'value matched no SWITCH_CASE — SWITCH_DEFAULT' };
    case 'UNCONDITIONAL':
      return { selectionMode: 'UNCONDITIONAL', selectionReason: 'single unconditional outgoing edge' };
    case 'CANCEL_REGION':
      return { selectionMode: 'CANCEL_REGION', selectionReason: 'SUBFLOW cancelled by its external cancel event' };
    default:
      return { selectionMode: selectedEdge.selector.type, selectionReason: `edge selector type ${selectedEdge.selector.type}` };
  }
}

export function evaluateBooleanExpression(expression: Parameters<typeof evaluateExpression>[0], context: EvaluationContext): boolean {
  const result = evaluateExpression(expression, context);
  if (typeof result !== 'boolean') {
    throw new WorkflowDomainError('WF_EXEC_EXPRESSION_FAILED', 'Condition expression must evaluate to a boolean.', { result });
  }
  return result;
}

const evaluateBooleanCondition = evaluateBooleanExpression;

/** Doc 05 section 4 — EXACT_ONE evaluates every condition edge exactly once; more than one true is `WF_EXEC_AMBIGUOUS_DECISION`. FIRST_MATCH evaluates ascending-priority order and stops at the first true edge. MULTI_MATCH is an inclusive gateway: every true DECISION edge is taken concurrently (DECISION_DEFAULT only when none match) and must converge on a PARALLEL_JOIN. */
export function evaluateDecisionNode(node: DecisionNodeDefinition, outgoingEdges: WorkflowEdgeDefinition[], context: EvaluationContext): ContinuationDecision {
  const mode = node.mode ?? 'EXACT_ONE';
  const conditionEdges = outgoingEdges.filter((e) => e.selector.type === 'DECISION');
  const defaultEdge = outgoingEdges.find((e) => e.selector.type === 'DECISION_DEFAULT');
  if (!defaultEdge) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `DECISION node "${node.key}" has no DECISION_DEFAULT edge — publication should have rejected this shape.`, { nodeKey: node.key });
  }

  if (mode === 'EXACT_ONE') {
    const evaluated = conditionEdges.map((edge) => ({
      edge,
      isTrue: evaluateBooleanCondition((edge.selector as { type: 'DECISION'; condition: Parameters<typeof evaluateExpression>[0] }).condition, context),
    }));
    const trueEdges = evaluated.filter((e) => e.isTrue);
    if (trueEdges.length > 1) {
      throw new WorkflowDomainError('WF_EXEC_AMBIGUOUS_DECISION', `DECISION node "${node.key}" (EXACT_ONE) had ${trueEdges.length} true conditions at runtime.`, { nodeKey: node.key });
    }
    const selectedEdge = trueEdges[0]?.edge ?? defaultEdge;
    return { kind: 'SELECT_EDGE', edgeKey: selectedEdge.key, nodeOutput: null };
  }

  if (mode === 'MULTI_MATCH') {
    const trueEdges = conditionEdges.filter((edge) =>
      evaluateBooleanCondition((edge.selector as { type: 'DECISION'; condition: Parameters<typeof evaluateExpression>[0] }).condition, context),
    );
    const selected = trueEdges.length > 0 ? trueEdges : [defaultEdge];
    return {
      kind: 'START_PARALLEL',
      splitNodeKey: node.key,
      branches: selected.map((edge) => ({ edgeKey: edge.key, branchTokenDescriptor: edge.key })),
    };
  }

  // FIRST_MATCH: ascending priority, first true wins.
  const sorted = [...conditionEdges].sort((a, b) => {
    const pa = (a.selector as { type: 'DECISION'; priority?: number }).priority ?? Number.MAX_SAFE_INTEGER;
    const pb = (b.selector as { type: 'DECISION'; priority?: number }).priority ?? Number.MAX_SAFE_INTEGER;
    return pa - pb;
  });
  for (const edge of sorted) {
    if (evaluateBooleanCondition((edge.selector as { type: 'DECISION'; condition: Parameters<typeof evaluateExpression>[0] }).condition, context)) {
      return { kind: 'SELECT_EDGE', edgeKey: edge.key, nodeOutput: null };
    }
  }
  return { kind: 'SELECT_EDGE', edgeKey: defaultEdge.key, nodeOutput: null };
}

/** Doc 05 section 21 — evaluates `value` exactly once; matches the unique equal `SWITCH_CASE`, else `SWITCH_DEFAULT`. Typed canonical JSON equality, no coercion. */
export function evaluateSwitchNode(node: SwitchNodeDefinition, outgoingEdges: WorkflowEdgeDefinition[], context: EvaluationContext): ContinuationDecision {
  const value = evaluateExpression(node.value, context);
  const caseEdges = outgoingEdges.filter((e): e is WorkflowEdgeDefinition & { selector: { type: 'SWITCH_CASE'; value: JsonValue } } => e.selector.type === 'SWITCH_CASE');
  const defaultEdge = outgoingEdges.find((e) => e.selector.type === 'SWITCH_DEFAULT');
  if (!defaultEdge) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `SWITCH node "${node.key}" has no SWITCH_DEFAULT edge — publication should have rejected this shape.`, { nodeKey: node.key });
  }
  const matched = caseEdges.find((edge) => typedEqual(value, edge.selector.value));
  const selectedEdge = matched ?? defaultEdge;
  return { kind: 'SELECT_EDGE', edgeKey: selectedEdge.key, nodeOutput: null };
}

/** Doc 05 section 7/section 24 — END validates/maps output and completes the instance. */
export function evaluateEndNode(node: EndNodeDefinition, context: EvaluationContext): ContinuationDecision {
  const output = evaluateMapping(node.output, context);
  return { kind: 'COMPLETE_INSTANCE', output };
}

/** Doc 05 section 7 — FAIL maps canonical error code, safe message and classified details. */
export function evaluateFailNode(node: FailNodeDefinition, context: EvaluationContext): ContinuationDecision {
  const errorCode = evaluateExpression(node.errorCode, context);
  if (typeof errorCode !== 'string' || errorCode.length === 0) {
    throw new WorkflowDomainError('WF_EXEC_EXPRESSION_FAILED', `FAIL node "${node.key}" errorCode must evaluate to a non-empty string.`, { nodeKey: node.key, errorCode });
  }
  const safeMessage = evaluateExpression(node.safeMessage, context);
  if (typeof safeMessage !== 'string') {
    throw new WorkflowDomainError('WF_EXEC_EXPRESSION_FAILED', `FAIL node "${node.key}" safeMessage must evaluate to a string.`, { nodeKey: node.key, safeMessage });
  }
  const classifiedDetails = node.details ? evaluateMapping(node.details, context) : undefined;
  return { kind: 'FAIL_INSTANCE', errorCode, safeMessage, classifiedDetails };
}

/**
 * Doc 05 section 24 — assignments for one node evaluate against the pre-completion context plus
 * that node's own canonical output (not yet durably committed), applied sequentially so a later
 * assignment in the same list observes an earlier one. Returns the full updated variables record;
 * callers persist it atomically with node success (doc 03 section 24, doc 05 section 24).
 */
export function applyOutputAssignments(
  assignments: readonly ContextAssignment[] | undefined,
  baseContext: EvaluationContext,
  nodeKey: string,
  nodeOutput: JsonValue,
): Record<string, JsonValue> {
  let variables = { ...baseContext.variables };
  if (!assignments || assignments.length === 0) return variables;
  for (const assignment of assignments) {
    const context: EvaluationContext = { ...baseContext, variables, nodeOutputs: { ...baseContext.nodeOutputs, [nodeKey]: nodeOutput } };
    const value = evaluateExpression(assignment.value, context);
    variables = { ...variables, [assignment.targetVariableKey]: value };
  }
  return variables;
}

const requireFiniteNonNegativeInteger = (value: JsonValue, label: string, nodeKey: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new WorkflowDomainError('WF_EXEC_EXPRESSION_FAILED', `${label} on node "${nodeKey}" must evaluate to a finite non-negative integer.`, { nodeKey, value });
  }
  return value;
};

/**
 * Doc 05 section 23 — DELAY creation phase. `DURATION_MS` evaluates once and is anchored to
 * `now` (the canonical persisted wait-creation time, doc 06 section 17's application-process wall
 * clock — same convention as `attemptService.ts`/`recoveryService.ts`); `UNTIL` evaluates once to
 * an exact instant. Both are runtime bound checks — publication (`policyLimitValidation.ts`) only
 * checks *literal* delay expressions; a non-literal (computed) value can only be range-checked here.
 */
export function evaluateDelayNode(node: DelayNodeDefinition, context: EvaluationContext, limits: { maxDelayMs: number }, now: Date): ContinuationDecision {
  if (node.delay.type === 'DURATION_MS') {
    const value = requireFiniteNonNegativeInteger(evaluateExpression(node.delay.value, context), 'DELAY DURATION_MS', node.key);
    if (value > limits.maxDelayMs) {
      throw new WorkflowDomainError('WF_EXEC_EXPRESSION_FAILED', `DELAY node "${node.key}" duration ${value}ms exceeds configured maxDelayMs (${limits.maxDelayMs}).`, { nodeKey: node.key, value });
    }
    return { kind: 'CREATE_WAIT', waitType: 'TIMER', resolvedWait: { waitType: 'TIMER', dueAt: new Date(now.getTime() + value).toISOString() } };
  }

  const value = evaluateExpression(node.delay.value, context);
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new WorkflowDomainError('WF_EXEC_EXPRESSION_FAILED', `DELAY node "${node.key}" UNTIL must evaluate to a valid canonical UTC instant string.`, { nodeKey: node.key, value });
  }
  return { kind: 'CREATE_WAIT', waitType: 'TIMER', resolvedWait: { waitType: 'TIMER', dueAt: new Date(Date.parse(value)).toISOString() } };
}

/**
 * WFV2-2 — FOR_EACH's own `items` expression evaluates once, with no CURRENT_ITEM bound (no item
 * exists yet), and must resolve to a JSON array. The array's length is a genuinely runtime-only
 * property (unlike `maxSubflowRecursionDepth`'s static graph bound), so this is checked here, at
 * dispatch time, not at publication.
 */
export function evaluateForEachItems(node: ForEachNodeDefinition, context: EvaluationContext, maxItems: number): JsonValue[] {
  const value = evaluateExpression(node.items, context);
  if (!Array.isArray(value)) {
    throw new WorkflowDomainError('WF_EXEC_FOR_EACH_ITEMS_NOT_ARRAY', `FOR_EACH node "${node.key}" items expression must evaluate to a JSON array (got ${typeof value}).`, { nodeKey: node.key });
  }
  if (value.length > maxItems) {
    throw new WorkflowDomainError('WF_EXEC_FOR_EACH_ITEM_LIMIT_EXCEEDED', `FOR_EACH node "${node.key}" items array has ${value.length} elements, exceeding the configured limit of ${maxItems}.`, { nodeKey: node.key, count: value.length, maxItems });
  }
  return value;
}

export type ForEachItemResult =
  | { index: number; status: 'SUCCEEDED'; output: JsonValue }
  | { index: number; status: 'FAILED'; errorCode: string; errorClass: string; safeMessage: string };

/** WFV2-2 — applies the node's joinMode (mirrors PARALLEL_JOIN's WFV2-18 ALL/ANY/THRESHOLD semantics) to the completed per-item results. */
export function evaluateForEachJoinSatisfied(node: ForEachNodeDefinition, results: readonly ForEachItemResult[]): boolean {
  const succeededCount = results.filter((r) => r.status === 'SUCCEEDED').length;
  if (node.joinMode === 'ALL') return succeededCount === results.length;
  if (node.joinMode === 'ANY') return succeededCount >= 1;
  const thresholdCount = node.thresholdCount ?? results.length;
  return succeededCount >= thresholdCount;
}

/**
 * Doc 05 section 6/23 — WAIT_EVENT creation phase. `correlation` evaluates once against the normal
 * (no `CURRENT_EVENT`) context to the scalar value this wait matches against incoming events; see
 * `eventCorrelation.ts`'s module doc comment for the encoder/ingress design decision. `timeout`, if
 * declared, evaluates `afterMs` once, anchored to `now` the same way DELAY's `DURATION_MS` is.
 */
export function evaluateWaitEventNode(node: WaitEventNodeDefinition, context: EvaluationContext, limits: { maxWaitTimeoutMs: number }, now: Date): ContinuationDecision {
  const encoded = encodeCorrelationValue(evaluateExpression(node.correlation, context));

  let timeoutAt: string | undefined;
  if (node.timeout) {
    const afterMs = requireFiniteNonNegativeInteger(evaluateExpression(node.timeout.afterMs, context), 'WAIT_EVENT timeout.afterMs', node.key);
    if (afterMs > limits.maxWaitTimeoutMs) {
      throw new WorkflowDomainError('WF_EXEC_EXPRESSION_FAILED', `WAIT_EVENT node "${node.key}" timeout ${afterMs}ms exceeds configured maxWaitTimeoutMs (${limits.maxWaitTimeoutMs}).`, { nodeKey: node.key, afterMs });
    }
    timeoutAt = new Date(now.getTime() + afterMs).toISOString();
  }

  return {
    kind: 'CREATE_WAIT',
    waitType: 'EVENT',
    resolvedWait: {
      waitType: 'EVENT',
      eventName: node.eventName,
      correlationKey: encoded.correlationKey,
      correlationValueHash: encoded.correlationValueHash,
      correlationEncoderVersion: encoded.correlationEncoderVersion,
      correlationHashAlgorithm: encoded.correlationHashAlgorithm,
      ...(timeoutAt !== undefined ? { timeoutAt } : {}),
    },
  };
}

/**
 * Doc 05 section 32 — PARALLEL_SPLIT creation phase. Publication (`structuralValidation.ts`)
 * already guarantees exactly two-or-more UNCONDITIONAL outgoing edges; one branch token is created
 * per outgoing edge (doc 03 section 24).
 */
export function evaluateParallelSplitNode(node: ParallelSplitNodeDefinition, outgoingEdges: WorkflowEdgeDefinition[]): ContinuationDecision {
  const branchEdges = outgoingEdges.filter((e) => e.selector.type === 'UNCONDITIONAL');
  if (branchEdges.length < 2) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `PARALLEL_SPLIT node "${node.key}" has fewer than two UNCONDITIONAL outgoing edges — publication should have rejected this shape.`, { nodeKey: node.key });
  }
  return {
    kind: 'START_PARALLEL',
    splitNodeKey: node.key,
    branches: branchEdges.map((edge) => ({ edgeKey: edge.key, branchTokenDescriptor: edge.key })),
  };
}

/**
 * Doc 05 section 22 — a PARALLEL_JOIN node is never claimed while `PENDING`; it becomes `READY`
 * only via a winning join-arrival transaction (`continuationApply.ts`'s shared join-arrival path),
 * never through generic edge selection. Once `READY` and claimed by the Node Executor like any other
 * node, its own dispatch is a plain `SELECT_EDGE` over its single UNCONDITIONAL outgoing edge
 * (doc 05 section 25's edge-cardinality matrix) — structurally identical to DECISION/SWITCH, so it
 * reuses the exact same continuation machinery without any join-specific runtime behavior of its own.
 */
export function evaluateParallelJoinNode(node: ParallelJoinNodeDefinition, outgoingEdges: WorkflowEdgeDefinition[]): ContinuationDecision {
  const edge = outgoingEdges.find((e) => e.selector.type === 'UNCONDITIONAL');
  if (!edge) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `PARALLEL_JOIN node "${node.key}" has no UNCONDITIONAL outgoing edge — publication should have rejected this shape.`, { nodeKey: node.key });
  }
  return { kind: 'SELECT_EDGE', edgeKey: edge.key, nodeOutput: null };
}

// ---------------------------------------------------------------------------
// WORK_ITEM creation (doc 07 section 8/9, doc 03 section 8) — Slice 8.
// ---------------------------------------------------------------------------

export type ResolvedWorkItemAssignment = { type: 'USER'; userId: number } | { type: 'ROLE'; roleId: string };

export type ResolvedWorkItemCreation = {
  workItemType: string;
  assignmentStrategy: WorkItemAssignmentDefinition['strategy'];
  resolvedAssignment: ResolvedWorkItemAssignment;
  assignmentEvidenceJson: string;
  allowedOutcomes: string[];
  titleText: string;
  summaryText: string | null;
  dueAt: string | null;
  followUpAt: string | null;
  approvalGroupKey: string | null;
  inputJson: string;
  outputSchemaJson: string;
  priority: number;
};

/** HWF-2.1 — same evaluate-once-at-creation timing as `title`/`summary`; must produce a parseable instant. */
function evaluateWorkItemTimestampField(expression: CanonicalExpression | undefined, fieldName: string, nodeKey: string, context: EvaluationContext): string | null {
  if (!expression) return null;
  const value = evaluateExpression(expression, context);
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new WorkflowDomainError('WF_EXEC_EXPRESSION_FAILED', `WORK_ITEM node "${nodeKey}" ${fieldName} must evaluate to a parseable ISO-8601 timestamp string.`, { nodeKey, fieldName, value });
  }
  return new Date(value).toISOString();
}

/**
 * AWM `WorkItemAssignmentDefinition.userId` is an authoring-time string identifier (doc 07 section
 * 8); it is resolved here to the real numeric AppEndO user id it denotes. No separate identity
 * lookup exists to validate the referenced user actually exists at authoring/dispatch time (same
 * "revalidated at claim/completion" deferral doc 07 section 2 already describes) — only its shape
 * (a positive integer string) is checked here.
 */
function parseAssignedUserId(raw: string, context: string): number {
  const userId = Number(raw);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new WorkflowDomainError('WF_EXEC_ASSIGNMENT_RESOLUTION_FAILED', `${context} must be a positive integer user id string.`, { raw });
  }
  return userId;
}

const isPlainObject = (value: JsonValue): value is Record<string, JsonValue> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Doc 07 section 8 — USER/ROLE strategies are literal at authoring time; EXPRESSION evaluates once
 * (normal context, no `CURRENT_EVENT`/`CURRENT_WORK_ITEM`) and MUST produce exactly one canonical
 * `{ type: "USER", id }` or `{ type: "ROLE", id }` descriptor — any other shape is a deterministic
 * `WF_EXEC_ASSIGNMENT_RESOLUTION_FAILED`, never an arbitrary candidate list.
 */
function resolveWorkItemAssignment(assignment: WorkItemAssignmentDefinition, context: EvaluationContext): { resolved: ResolvedWorkItemAssignment; evidence: Record<string, JsonValue> } {
  if (assignment.strategy === 'USER') {
    const userId = parseAssignedUserId(assignment.userId, 'WORK_ITEM USER assignment');
    return { resolved: { type: 'USER', userId }, evidence: { strategy: 'USER', resolvedType: 'USER', resolvedUserId: userId, resolutionReason: 'literal USER assignment' } };
  }
  if (assignment.strategy === 'ROLE') {
    return { resolved: { type: 'ROLE', roleId: assignment.roleId }, evidence: { strategy: 'ROLE', resolvedType: 'ROLE', resolvedRoleId: assignment.roleId, resolutionReason: 'literal ROLE assignment' } };
  }
  if (assignment.strategy === 'SAME_AS_WORK_ITEM') {
    // Never reached in practice — evaluateWorkItemCreation always branches around this strategy to
    // use its caller-supplied presetAssignment instead (WFV2-20: resolving this needs a real DB
    // read, which this pure function cannot do).
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'SAME_AS_WORK_ITEM assignment must be resolved by the caller via presetAssignment, not resolveWorkItemAssignment.', { assignment });
  }
  if (assignment.strategy === 'ROUND_ROBIN' || assignment.strategy === 'SHORTEST_QUEUE') {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `${assignment.strategy} assignment must be resolved by the caller via presetAssignment, not resolveWorkItemAssignment.`, { assignment });
  }

  const value = evaluateExpression(assignment.expression, context);
  if (isPlainObject(value) && value.type === 'USER' && typeof value.id === 'string') {
    const userId = parseAssignedUserId(value.id, 'WORK_ITEM EXPRESSION assignment (resolved USER)');
    return { resolved: { type: 'USER', userId }, evidence: { strategy: 'EXPRESSION', resolvedType: 'USER', resolvedUserId: userId, resolutionReason: 'EXPRESSION resolved to a USER descriptor' } };
  }
  if (isPlainObject(value) && value.type === 'ROLE' && typeof value.id === 'string') {
    return { resolved: { type: 'ROLE', roleId: value.id }, evidence: { strategy: 'EXPRESSION', resolvedType: 'ROLE', resolvedRoleId: value.id, resolutionReason: 'EXPRESSION resolved to a ROLE descriptor' } };
  }
  throw new WorkflowDomainError(
    'WF_EXEC_ASSIGNMENT_RESOLUTION_FAILED',
    `WORK_ITEM EXPRESSION assignment must evaluate to exactly { type: "USER", id: string } or { type: "ROLE", id: string }.`,
    { value },
  );
}

/**
 * Doc 03 section 8 — `titleText`/`summaryText` are evaluated exactly once at creation and persisted
 * verbatim (never re-evaluated for display). Doc 05 section 19's literal-title length bound
 * (`maxWorkItemTitleLength`) is re-checked here for the general (non-literal, expression-derived)
 * case — publication (`policyLimitValidation.ts`) only checks *literal* title/summary expressions.
 */
/** WFV2-20 — required exactly when `node.assignment.strategy === 'SAME_AS_WORK_ITEM'`; resolved by the caller (dispatchService.ts) via a real DB read BEFORE this pure function runs, since `resolveWorkItemAssignment` below has no I/O access. */
export type PresetWorkItemAssignment = { resolved: ResolvedWorkItemAssignment; evidence: Record<string, JsonValue> };

export function evaluateWorkItemCreation(
  node: WorkItemNodeDefinition,
  context: EvaluationContext,
  limits: { maxWorkItemTitleLength: number },
  presetAssignment?: PresetWorkItemAssignment,
): ResolvedWorkItemCreation {
  const title = evaluateExpression(node.title, context);
  if (typeof title !== 'string' || title.length === 0) {
    throw new WorkflowDomainError('WF_EXEC_EXPRESSION_FAILED', `WORK_ITEM node "${node.key}" title must evaluate to a non-empty string.`, { nodeKey: node.key, title });
  }
  if (title.length > limits.maxWorkItemTitleLength) {
    throw new WorkflowDomainError('WF_EXEC_EXPRESSION_FAILED', `WORK_ITEM node "${node.key}" title exceeds configured maxWorkItemTitleLength (${limits.maxWorkItemTitleLength}).`, { nodeKey: node.key });
  }

  let summaryText: string | null = null;
  if (node.summary) {
    const summary = evaluateExpression(node.summary, context);
    if (typeof summary !== 'string') {
      throw new WorkflowDomainError('WF_EXEC_EXPRESSION_FAILED', `WORK_ITEM node "${node.key}" summary must evaluate to a string.`, { nodeKey: node.key, summary });
    }
    if (summary.length > limits.maxWorkItemTitleLength) {
      throw new WorkflowDomainError('WF_EXEC_EXPRESSION_FAILED', `WORK_ITEM node "${node.key}" summary exceeds configured maxWorkItemTitleLength (${limits.maxWorkItemTitleLength}).`, { nodeKey: node.key });
    }
    summaryText = summary;
  }

  if (node.allowedOutcomes.length === 0) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `WORK_ITEM node "${node.key}" has no allowed outcomes — publication should have rejected this shape.`, { nodeKey: node.key });
  }

  let resolved: ResolvedWorkItemAssignment;
  let evidence: Record<string, JsonValue>;
  if (node.assignment.strategy === 'SAME_AS_WORK_ITEM' || node.assignment.strategy === 'ROUND_ROBIN' || node.assignment.strategy === 'SHORTEST_QUEUE') {
    if (!presetAssignment) {
      throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `WORK_ITEM node "${node.key}" uses ${node.assignment.strategy} assignment but no pre-resolved assignment was supplied by the dispatcher.`, { nodeKey: node.key, strategy: node.assignment.strategy });
    }
    ({ resolved, evidence } = presetAssignment);
  } else {
    ({ resolved, evidence } = resolveWorkItemAssignment(node.assignment, context));
  }
  const inputValue = evaluateMapping(node.input, context);
  const dueAt = evaluateWorkItemTimestampField(node.dueAt, 'dueAt', node.key, context);
  const followUpAt = evaluateWorkItemTimestampField(node.followUpAt, 'followUpAt', node.key, context);

  return {
    workItemType: node.workItemType,
    assignmentStrategy: node.assignment.strategy,
    resolvedAssignment: resolved,
    assignmentEvidenceJson: JSON.stringify(evidence),
    allowedOutcomes: node.allowedOutcomes,
    titleText: title,
    summaryText,
    dueAt,
    followUpAt,
    approvalGroupKey: node.approvalGroupKey ?? null,
    inputJson: JSON.stringify(inputValue),
    outputSchemaJson: JSON.stringify(node.outputSchema),
    priority: 0,
  };
}
