import type {
  WorkflowModel,
  WorkflowNodeDefinition,
  WorkflowEdgeDefinition,
  CanonicalExpression,
  CanonicalMapping,
  CanonicalMappingValue,
  JsonValue,
  StartDefinition,
  ActionResolutionRef,
  ContextAssignment,
  RetryPolicy,
  DelayNodeDefinition,
  WorkItemAssignmentDefinition,
  WorkItemEscalationPolicy,
  WorkItemType,
  ExactWorkflowDefinitionRef,
  ActionCompensationDefinition,
} from '../../awm/types';

/** Shared Slice-5 engine test fixtures — mirrors `publication/__tests__/fixtures.ts`'s builder style. */

export const lit = (value: JsonValue): CanonicalExpression => ({ op: 'LITERAL', value });

export const workflowInputPath = (segments: Array<string | number> = []): CanonicalExpression => ({
  op: 'PATH',
  path: { root: { type: 'WORKFLOW_INPUT' }, segments },
});

export const nodeOutput = (nodeKey: string, segments: Array<string | number> = []): CanonicalExpression => ({
  op: 'PATH',
  path: { root: { type: 'NODE_OUTPUT', nodeKey }, segments },
});

export const workflowVariable = (variableKey: string, segments: Array<string | number> = []): CanonicalExpression => ({
  op: 'PATH',
  path: { root: { type: 'WORKFLOW_VARIABLE', variableKey }, segments },
});

/** WFV2-2 — legal only within a FOR_EACH node's own `input` mapping. */
export const currentItem = (segments: Array<string | number> = []): CanonicalExpression => ({
  op: 'PATH',
  path: { root: { type: 'CURRENT_ITEM' }, segments },
});

export const currentItemIndex = (): CanonicalExpression => ({ op: 'PATH', path: { root: { type: 'CURRENT_ITEM_INDEX' }, segments: [] } });

export const emptyMapping = (): CanonicalMapping => ({ type: 'OBJECT', fields: {} });

export const mappingOf = (fields: Record<string, CanonicalExpression>): CanonicalMapping => ({
  type: 'OBJECT',
  fields: Object.fromEntries(Object.entries(fields).map(([k, expression]) => [k, { type: 'EXPRESSION', expression } satisfies CanonicalMappingValue])),
});

export const endNode = (key: string, output: CanonicalMapping = emptyMapping()): WorkflowNodeDefinition => ({ kind: 'END', key, output });

export const failNode = (key: string, errorCode: CanonicalExpression, safeMessage: CanonicalExpression): WorkflowNodeDefinition => ({
  kind: 'FAIL',
  key,
  errorCode,
  safeMessage,
});

export const decisionNode = (key: string, mode: 'EXACT_ONE' | 'FIRST_MATCH' | 'MULTI_MATCH' = 'EXACT_ONE'): WorkflowNodeDefinition => ({ kind: 'DECISION', key, mode });

export const switchNode = (key: string, value: CanonicalExpression): WorkflowNodeDefinition => ({ kind: 'SWITCH', key, value });

/** `text.template` (core pack, providerId `core`/`1`) — a real, no-network, PURE core Action used as the Slice 5 ACTION-node fixture. */
export const TEXT_TEMPLATE_ACTION_REF: ActionResolutionRef = { type: 'EXACT_PROVIDER', action: { actionKey: 'text.template', actionVersion: '1' }, providerId: 'core', providerVersion: '1' };

export const actionNode = (
  key: string,
  overrides: { input?: CanonicalMapping; config?: CanonicalMapping; outputAssignments?: ContextAssignment[]; actionRef?: ActionResolutionRef; retryPolicy?: RetryPolicy; compensation?: ActionCompensationDefinition } = {},
): WorkflowNodeDefinition => ({
  kind: 'ACTION',
  key,
  actionRef: overrides.actionRef ?? TEXT_TEMPLATE_ACTION_REF,
  config: overrides.config ?? emptyMapping(),
  input: overrides.input ?? emptyMapping(),
  outputAssignments: overrides.outputAssignments,
  compensation: overrides.compensation,
  retryPolicy: overrides.retryPolicy,
});

/** WFV2-2 — dynamic per-item fork node. `retryPolicy` defaults to a single-attempt policy (no automatic retry) since it, like ACTION, has no publish-time-resolvable default unless the workflow itself declares one. */
export const forEachNode = (
  key: string,
  overrides: { items?: CanonicalExpression; input?: CanonicalMapping; config?: CanonicalMapping; outputAssignments?: ContextAssignment[]; actionRef?: ActionResolutionRef; retryPolicy?: RetryPolicy; maxConcurrency?: number; joinMode?: 'ALL' | 'ANY' | 'THRESHOLD'; thresholdCount?: number } = {},
): WorkflowNodeDefinition => ({
  kind: 'FOR_EACH',
  key,
  items: overrides.items ?? lit([]),
  actionRef: overrides.actionRef ?? TEXT_TEMPLATE_ACTION_REF,
  config: overrides.config ?? emptyMapping(),
  input: overrides.input ?? emptyMapping(),
  maxConcurrency: overrides.maxConcurrency,
  retryPolicy: overrides.retryPolicy ?? { maxAttempts: 1, strategy: 'FIXED', initialDelayMs: 0, retryOn: [] },
  joinMode: overrides.joinMode ?? 'ALL',
  thresholdCount: overrides.thresholdCount,
  outputAssignments: overrides.outputAssignments,
});

/** In-process while-loop. `retryPolicy` defaults to a single attempt, same as FOR_EACH. */
export const loopNode = (
  key: string,
  overrides: {
    condition?: CanonicalExpression;
    input?: CanonicalMapping;
    config?: CanonicalMapping;
    outputAssignments?: ContextAssignment[];
    actionRef?: ActionResolutionRef;
    retryPolicy?: RetryPolicy;
    maxIterations?: number;
  } = {},
): WorkflowNodeDefinition => ({
  kind: 'LOOP',
  key,
  condition: overrides.condition ?? lit(false),
  actionRef: overrides.actionRef ?? TEXT_TEMPLATE_ACTION_REF,
  config: overrides.config ?? emptyMapping(),
  input: overrides.input ?? emptyMapping(),
  maxIterations: overrides.maxIterations,
  retryPolicy: overrides.retryPolicy ?? { maxAttempts: 1, strategy: 'FIXED', initialDelayMs: 0, retryOn: [] },
  outputAssignments: overrides.outputAssignments,
});

export const unconditionalEdge = (key: string, fromNodeKey: string, toNodeKey: string): WorkflowEdgeDefinition => ({
  key,
  fromNodeKey,
  toNodeKey,
  selector: { type: 'UNCONDITIONAL' },
});

/** WFV2-1 — the ACTION node's ON_ERROR/CATCH edge. */
export const errorEdge = (key: string, fromNodeKey: string, toNodeKey: string): WorkflowEdgeDefinition => ({
  key,
  fromNodeKey,
  toNodeKey,
  selector: { type: 'ON_ERROR' },
});

export const decisionEdge = (key: string, fromNodeKey: string, toNodeKey: string, condition: CanonicalExpression, priority?: number): WorkflowEdgeDefinition => ({
  key,
  fromNodeKey,
  toNodeKey,
  selector: { type: 'DECISION', condition, priority },
});

export const decisionDefaultEdge = (key: string, fromNodeKey: string, toNodeKey: string): WorkflowEdgeDefinition => ({
  key,
  fromNodeKey,
  toNodeKey,
  selector: { type: 'DECISION_DEFAULT' },
});

export const waitTimeoutEdge = (key: string, fromNodeKey: string, toNodeKey: string, outcomeKey: string): WorkflowEdgeDefinition => ({
  key,
  fromNodeKey,
  toNodeKey,
  selector: { type: 'WAIT_TIMEOUT', outcomeKey },
});

export const delayNode = (key: string, delay: DelayNodeDefinition['delay']): WorkflowNodeDefinition => ({ kind: 'DELAY', key, delay });

export const waitEventNode = (
  key: string,
  overrides: { eventName: string; correlation: CanonicalExpression; timeout?: { afterMs: CanonicalExpression; outcomeKey: string }; outputAssignments?: ContextAssignment[] },
): WorkflowNodeDefinition => ({
  kind: 'WAIT_EVENT',
  key,
  eventName: overrides.eventName,
  correlation: overrides.correlation,
  timeout: overrides.timeout,
  outputAssignments: overrides.outputAssignments,
});

export const parallelSplitNode = (key: string): WorkflowNodeDefinition => ({ kind: 'PARALLEL_SPLIT', key });

export const parallelJoinNode = (
  key: string,
  mode: 'ALL' | 'ANY' | 'THRESHOLD' = 'ALL',
  cancelRemaining?: boolean,
  thresholdCount?: number,
): WorkflowNodeDefinition => ({
  kind: 'PARALLEL_JOIN',
  key,
  mode,
  thresholdCount,
  cancelRemaining,
});

export function baseModel(overrides: Partial<WorkflowModel> = {}): WorkflowModel {
  const nodes: WorkflowNodeDefinition[] = overrides.nodes ?? [endNode('end-1')];
  const start: StartDefinition = overrides.start ?? { type: 'MANUAL_API', targetNodeKey: nodes[0]?.key ?? '__none__' };
  return {
    schemaVersion: '1',
    key: 'w',
    name: 'w',
    inputSchema: { type: 'INLINE', schema: {} },
    outputSchema: { type: 'INLINE', schema: {} },
    variables: overrides.variables ?? [],
    start,
    nodes,
    edges: overrides.edges ?? [],
    policies: overrides.policies ?? {
      recoveryDetectionBoundMs: 1,
      limits: {
        maxNodes: 100,
        maxEdges: 100,
        maxPayloadBytes: 1_000_000,
        maxJsonDepth: 30,
        maxExpressionNodes: 500,
        maxStructuralPathCandidates: 1000,
        maxDelayMs: 86_400_000,
        maxWaitTimeoutMs: 86_400_000,
        maxWorkItemTitleLength: 200,
      },
    },
    ...overrides,
  };
}

export const workItemOutcomeEdge = (key: string, fromNodeKey: string, toNodeKey: string, outcomeKey: string): WorkflowEdgeDefinition => ({
  key,
  fromNodeKey,
  toNodeKey,
  selector: { type: 'WORK_ITEM_OUTCOME', outcomeKey },
});

export const workItemNode = (
  key: string,
  overrides: {
    workItemType?: WorkItemType;
    assignment: WorkItemAssignmentDefinition;
    allowedOutcomes: string[];
    title?: CanonicalExpression;
    summary?: CanonicalExpression;
    input?: CanonicalMapping;
    outputSchema?: unknown;
    outputAssignments?: ContextAssignment[];
    escalationPolicy?: WorkItemEscalationPolicy;
    excludeUsersFromWorkItemKeys?: string[];
  },
): WorkflowNodeDefinition => ({
  kind: 'WORK_ITEM',
  key,
  workItemType: overrides.workItemType ?? 'APPROVAL',
  assignment: overrides.assignment,
  allowedOutcomes: overrides.allowedOutcomes,
  title: overrides.title ?? lit(`Work item ${key}`),
  summary: overrides.summary,
  input: overrides.input ?? emptyMapping(),
  outputSchema: (overrides.outputSchema as never) ?? { type: 'INLINE', schema: {} },
  outputAssignments: overrides.outputAssignments,
  escalationPolicy: overrides.escalationPolicy,
  excludeUsersFromWorkItemKeys: overrides.excludeUsersFromWorkItemKeys,
});

export const subflowNode = (
  key: string,
  overrides: { workflowDefinitionRef: ExactWorkflowDefinitionRef; input?: CanonicalMapping; outputAssignments?: ContextAssignment[]; cancelEvent?: { eventName: string; correlation: CanonicalExpression } },
): WorkflowNodeDefinition => ({
  kind: 'SUBFLOW',
  key,
  workflowDefinitionRef: overrides.workflowDefinitionRef,
  input: overrides.input ?? emptyMapping(),
  outputAssignments: overrides.outputAssignments,
  cancelEvent: overrides.cancelEvent,
});

/** p-99/WFT-9 — the SUBFLOW node's Cancel Region edge. */
export const cancelRegionEdge = (key: string, fromNodeKey: string, toNodeKey: string): WorkflowEdgeDefinition => ({
  key,
  fromNodeKey,
  toNodeKey,
  selector: { type: 'CANCEL_REGION' },
});
