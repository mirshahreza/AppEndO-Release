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
  ActionCompensationDefinition,
} from '../../awm/types';

/** Shared publication-test fixtures — pure builders, no persistence, no registry side effects. */

export const lit = (value: JsonValue): CanonicalExpression => ({ op: 'LITERAL', value });

export const nodeOutput = (nodeKey: string, segments: Array<string | number> = []): CanonicalExpression => ({
  op: 'PATH',
  path: { root: { type: 'NODE_OUTPUT', nodeKey }, segments },
});

export const currentEvent = (segments: Array<string | number> = []): CanonicalExpression => ({
  op: 'PATH',
  path: { root: { type: 'CURRENT_EVENT' }, segments },
});

export const currentWorkItem = (projection: 'OUTCOME' | 'OUTPUT', segments: Array<string | number> = []): CanonicalExpression => ({
  op: 'PATH',
  path: { root: { type: 'CURRENT_WORK_ITEM', projection }, segments },
});

export const emptyMapping = (): CanonicalMapping => ({ type: 'OBJECT', fields: {} });

export const mappingOf = (fields: Record<string, CanonicalExpression>): CanonicalMapping => ({
  type: 'OBJECT',
  fields: Object.fromEntries(Object.entries(fields).map(([k, expression]) => [k, { type: 'EXPRESSION', expression } satisfies CanonicalMappingValue])),
});

export const endNode = (key: string): WorkflowNodeDefinition => ({ kind: 'END', key, output: emptyMapping() });

export const actionNode = (
  key: string,
  overrides: { input?: CanonicalMapping; outputAssignments?: ContextAssignment[]; actionRef?: ActionResolutionRef; retryPolicy?: RetryPolicy; compensation?: ActionCompensationDefinition } = {},
): WorkflowNodeDefinition => ({
  kind: 'ACTION',
  key,
  actionRef: overrides.actionRef ?? { type: 'EXACT_PROVIDER', action: { actionKey: 'test.noop', actionVersion: '1' }, providerId: 'core', providerVersion: '1' },
  config: emptyMapping(),
  input: overrides.input ?? emptyMapping(),
  outputAssignments: overrides.outputAssignments,
  retryPolicy: overrides.retryPolicy,
  compensation: overrides.compensation,
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

/** p-99/WFT-9 — a SUBFLOW node's Cancel Region edge. */
export const cancelRegionEdge = (key: string, fromNodeKey: string, toNodeKey: string): WorkflowEdgeDefinition => ({
  key,
  fromNodeKey,
  toNodeKey,
  selector: { type: 'CANCEL_REGION' },
});

/** p-99/WFT-9 — a SUBFLOW node, optionally with `cancelEvent`. */
export const subflowNode = (key: string, overrides: { input?: CanonicalMapping; outputAssignments?: ContextAssignment[]; cancelEvent?: { eventName: string; correlation: CanonicalExpression } } = {}): WorkflowNodeDefinition => ({
  kind: 'SUBFLOW',
  key,
  workflowDefinitionRef: { workflowDefinitionKey: 'child-wf' },
  input: overrides.input ?? emptyMapping(),
  outputAssignments: overrides.outputAssignments,
  cancelEvent: overrides.cancelEvent,
});

export const currentItem = (segments: Array<string | number> = []): CanonicalExpression => ({
  op: 'PATH',
  path: { root: { type: 'CURRENT_ITEM' }, segments },
});

export const currentItemIndex = (): CanonicalExpression => ({ op: 'PATH', path: { root: { type: 'CURRENT_ITEM_INDEX' }, segments: [] } });

/** WFV2-2 — dynamic per-item fork node. */
export const forEachNode = (
  key: string,
  overrides: { items?: CanonicalExpression; input?: CanonicalMapping; outputAssignments?: ContextAssignment[]; actionRef?: ActionResolutionRef; joinMode?: 'ALL' | 'ANY' | 'THRESHOLD'; thresholdCount?: number } = {},
): WorkflowNodeDefinition => ({
  kind: 'FOR_EACH',
  key,
  items: overrides.items ?? { op: 'LITERAL', value: [] },
  actionRef: overrides.actionRef ?? { type: 'EXACT_PROVIDER', action: { actionKey: 'test.noop', actionVersion: '1' }, providerId: 'core', providerVersion: '1' },
  config: emptyMapping(),
  input: overrides.input ?? emptyMapping(),
  joinMode: overrides.joinMode ?? 'ALL',
  thresholdCount: overrides.thresholdCount,
  outputAssignments: overrides.outputAssignments,
});

/** In-process while-loop — same Action-shaped contract as FOR_EACH for publication rules. */
export const loopNode = (
  key: string,
  overrides: {
    condition?: CanonicalExpression;
    input?: CanonicalMapping;
    outputAssignments?: ContextAssignment[];
    actionRef?: ActionResolutionRef;
    retryPolicy?: RetryPolicy;
    maxIterations?: number;
  } = {},
): WorkflowNodeDefinition => ({
  kind: 'LOOP',
  key,
  condition: overrides.condition ?? lit(false),
  actionRef: overrides.actionRef ?? { type: 'EXACT_PROVIDER', action: { actionKey: 'test.noop', actionVersion: '1' }, providerId: 'core', providerVersion: '1' },
  config: emptyMapping(),
  input: overrides.input ?? emptyMapping(),
  maxIterations: overrides.maxIterations,
  retryPolicy: overrides.retryPolicy,
  outputAssignments: overrides.outputAssignments,
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
    variables: [],
    start,
    nodes,
    edges: [],
    policies: {
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
