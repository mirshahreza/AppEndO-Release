import { z } from 'zod';

/**
 * Zod schemas mirroring `types.ts` — sole runtime validation authority for
 * AWM payloads. Used by the draft-operation applier (doc 02 section 12:
 * "rejects duplicate operation-owned JSON fields/unknown executable fields
 * through the registered schemas"). `z.strictObject` everywhere so unknown
 * fields are rejected, matching the contract's closed-shape requirement.
 */

export const jsonValueSchema: z.ZodType<import('./types').JsonValue> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)]),
);

export const jsonSchemaRefOrInlineSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('REF'), ref: z.string().min(1) }),
  z.strictObject({ type: z.literal('INLINE'), schema: jsonValueSchema }),
]);

// ---------------------------------------------------------------------------
// Canonical expression / path / mapping AST
// ---------------------------------------------------------------------------

export const canonicalPathRootSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('WORKFLOW_INPUT') }),
  z.strictObject({ type: z.literal('WORKFLOW_VARIABLE'), variableKey: z.string().min(1) }),
  z.strictObject({ type: z.literal('NODE_OUTPUT'), nodeKey: z.string().min(1) }),
  z.strictObject({ type: z.literal('CURRENT_NODE_INPUT') }),
  z.strictObject({ type: z.literal('CURRENT_EVENT') }),
  z.strictObject({ type: z.literal('CURRENT_WORK_ITEM'), projection: z.enum(['OUTCOME', 'OUTPUT']) }),
  z.strictObject({ type: z.literal('CURRENT_ITEM') }),
  z.strictObject({ type: z.literal('CURRENT_ITEM_INDEX') }),
]);

export const canonicalPathSchema = z.strictObject({
  root: canonicalPathRootSchema,
  segments: z.array(z.union([z.string(), z.number()])),
});

export const canonicalExpressionSchema: z.ZodType<import('./types').CanonicalExpression> = z.lazy(() =>
  z.discriminatedUnion('op', [
    z.strictObject({ op: z.literal('LITERAL'), value: jsonValueSchema }),
    z.strictObject({ op: z.literal('PATH'), path: canonicalPathSchema }),
    z.strictObject({ op: z.literal('NOT'), value: canonicalExpressionSchema }),
    z.strictObject({ op: z.literal('AND'), values: z.array(canonicalExpressionSchema) }),
    z.strictObject({ op: z.literal('OR'), values: z.array(canonicalExpressionSchema) }),
    z.strictObject({ op: z.literal('EQ'), left: canonicalExpressionSchema, right: canonicalExpressionSchema }),
    z.strictObject({ op: z.literal('NE'), left: canonicalExpressionSchema, right: canonicalExpressionSchema }),
    z.strictObject({ op: z.literal('LT'), left: canonicalExpressionSchema, right: canonicalExpressionSchema }),
    z.strictObject({ op: z.literal('LTE'), left: canonicalExpressionSchema, right: canonicalExpressionSchema }),
    z.strictObject({ op: z.literal('GT'), left: canonicalExpressionSchema, right: canonicalExpressionSchema }),
    z.strictObject({ op: z.literal('GTE'), left: canonicalExpressionSchema, right: canonicalExpressionSchema }),
    z.strictObject({ op: z.literal('IS_NULL'), value: canonicalExpressionSchema }),
    z.strictObject({ op: z.literal('IS_NOT_NULL'), value: canonicalExpressionSchema }),
    z.strictObject({ op: z.literal('ADD'), left: canonicalExpressionSchema, right: canonicalExpressionSchema }),
    z.strictObject({ op: z.literal('SUB'), left: canonicalExpressionSchema, right: canonicalExpressionSchema }),
    z.strictObject({ op: z.literal('MUL'), left: canonicalExpressionSchema, right: canonicalExpressionSchema }),
    z.strictObject({ op: z.literal('DIV'), left: canonicalExpressionSchema, right: canonicalExpressionSchema }),
    z.strictObject({ op: z.literal('MOD'), left: canonicalExpressionSchema, right: canonicalExpressionSchema }),
    z.strictObject({ op: z.literal('CONCAT'), values: z.array(canonicalExpressionSchema) }),
    z.strictObject({ op: z.literal('IN'), value: canonicalExpressionSchema, set: canonicalExpressionSchema }),
    z.strictObject({ op: z.literal('COALESCE'), values: z.array(canonicalExpressionSchema) }),
    z.strictObject({
      op: z.literal('PURE_FUNCTION'),
      functionRef: z.strictObject({ key: z.string().min(1), version: z.string().min(1) }),
      args: z.array(canonicalExpressionSchema),
    }),
  ]),
);

export const canonicalMappingValueSchema: z.ZodType<import('./types').CanonicalMappingValue> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('EXPRESSION'), expression: canonicalExpressionSchema }),
    z.strictObject({ type: z.literal('OBJECT'), fields: z.record(z.string(), canonicalMappingValueSchema) }),
    z.strictObject({ type: z.literal('ARRAY'), items: z.array(canonicalMappingValueSchema) }),
  ]),
);

export const canonicalMappingSchema = z.strictObject({
  type: z.literal('OBJECT'),
  fields: z.record(z.string(), canonicalMappingValueSchema),
});

// ---------------------------------------------------------------------------
// Action resolution
// ---------------------------------------------------------------------------

export const exactActionRefSchema = z.strictObject({ actionKey: z.string().min(1), actionVersion: z.string().min(1) });

export const actionResolutionRefSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('EXACT_PROVIDER'), action: exactActionRefSchema, providerId: z.string().min(1), providerVersion: z.string().min(1) }),
  z.strictObject({ type: z.literal('CAPABILITY_RESOLVED'), action: exactActionRefSchema, requiredCapabilities: z.array(z.string().min(1)) }),
  z.strictObject({ type: z.literal('INLINE_CODE'), code: z.string().min(1), language: z.enum(['ts', 'js']).optional(), timeoutMs: z.number().int().positive().optional() }),
]);

// ---------------------------------------------------------------------------
// Work Item assignment / escalation
// ---------------------------------------------------------------------------

export const workItemTypeSchema = z.enum(['APPROVAL', 'REVIEW', 'DATA_ENTRY', 'DECISION', 'CONFIRMATION', 'EXCEPTION', 'AI_REVIEW']);

export const workItemAssignmentDefinitionSchema = z.discriminatedUnion('strategy', [
  z.strictObject({ strategy: z.literal('USER'), userId: z.string().min(1) }),
  z.strictObject({ strategy: z.literal('ROLE'), roleId: z.string().min(1) }),
  z.strictObject({ strategy: z.literal('EXPRESSION'), expression: canonicalExpressionSchema }),
  z.strictObject({ strategy: z.literal('SAME_AS_WORK_ITEM'), workItemNodeKey: z.string().min(1) }),
  z.strictObject({ strategy: z.literal('ROUND_ROBIN'), userIds: z.array(z.string().min(1)).min(1) }),
  z.strictObject({ strategy: z.literal('SHORTEST_QUEUE'), roleId: z.string().min(1) }),
]);

export const canonicalPlatformBindingRefSchema = z.strictObject({ bindingType: z.string().min(1), bindingId: z.string().min(1) });

export const retrySelectorSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('ERROR_CODE'), codes: z.array(z.string().min(1)) }),
  z.strictObject({ type: z.literal('ERROR_CLASS'), classes: z.array(z.string().min(1)) }),
  z.strictObject({ type: z.literal('TIMEOUT') }),
]);

export const retryPolicySchema = z.strictObject({
  maxAttempts: z.number().int().min(1),
  strategy: z.enum(['FIXED', 'EXPONENTIAL']),
  initialDelayMs: z.number().int().nonnegative(),
  maxDelayMs: z.number().int().nonnegative().optional(),
  multiplier: z.number().min(1).optional(),
  retryOn: z.array(retrySelectorSchema),
});

const workItemEscalationStepActionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('REASSIGN_USER'), userId: z.string().min(1) }),
  z.strictObject({ type: z.literal('REASSIGN_ROLE'), roleId: z.string().min(1) }),
  z.strictObject({ type: z.literal('RAISE_PRIORITY'), priority: z.number().int() }),
  z.strictObject({ type: z.literal('COMPLETE_WITH_OUTCOME'), outcomeKey: z.string().min(1), output: canonicalMappingSchema }),
  z.strictObject({ type: z.literal('FAIL_WORKFLOW_NODE'), errorCode: z.string().min(1), safeMessage: z.string().min(1) }),
  z.strictObject({ type: z.literal('NOTIFY'), notificationRef: canonicalPlatformBindingRefSchema, input: canonicalMappingSchema }),
]);

export const workItemEscalationStepSchema = z.strictObject({
  key: z.string().min(1),
  trigger: z.strictObject({ type: z.literal('AFTER_OPEN_MS'), afterMs: z.number().int().nonnegative(), respectBusinessHours: z.boolean().optional() }),
  action: workItemEscalationStepActionSchema,
  maxExecutions: z.number().int().min(1),
  retryPolicy: retryPolicySchema.optional(),
});

export const workItemEscalationPolicySchema = z.strictObject({ steps: z.array(workItemEscalationStepSchema) });

export const exactWorkflowDefinitionRefSchema = z.strictObject({ workflowDefinitionKey: z.string().min(1), scopeKey: z.string().min(1).optional() });

// ---------------------------------------------------------------------------
// Node kinds
// ---------------------------------------------------------------------------

export const contextAssignmentSchema = z.strictObject({ targetVariableKey: z.string().min(1), value: canonicalExpressionSchema });

const actionCompensationDefinitionSchema = z.strictObject({
  actionRef: actionResolutionRefSchema,
  config: canonicalMappingSchema,
  input: canonicalMappingSchema,
});

const actionNodeDefinitionSchema = z.strictObject({
  kind: z.literal('ACTION'),
  key: z.string().min(1),
  actionRef: actionResolutionRefSchema,
  config: canonicalMappingSchema,
  input: canonicalMappingSchema,
  outputAssignments: z.array(contextAssignmentSchema).optional(),
  retryPolicy: retryPolicySchema.optional(),
  compensation: actionCompensationDefinitionSchema.optional(),
});

const forEachNodeDefinitionSchema = z.strictObject({
  kind: z.literal('FOR_EACH'),
  key: z.string().min(1),
  items: canonicalExpressionSchema,
  actionRef: actionResolutionRefSchema,
  config: canonicalMappingSchema,
  input: canonicalMappingSchema,
  maxConcurrency: z.number().int().positive().optional(),
  retryPolicy: retryPolicySchema.optional(),
  joinMode: z.enum(['ALL', 'ANY', 'THRESHOLD']),
  thresholdCount: z.number().int().positive().optional(),
  outputAssignments: z.array(contextAssignmentSchema).optional(),
});

const loopNodeDefinitionSchema = z.strictObject({
  kind: z.literal('LOOP'),
  key: z.string().min(1),
  condition: canonicalExpressionSchema,
  actionRef: actionResolutionRefSchema,
  config: canonicalMappingSchema,
  input: canonicalMappingSchema,
  maxIterations: z.number().int().positive().optional(),
  retryPolicy: retryPolicySchema.optional(),
  outputAssignments: z.array(contextAssignmentSchema).optional(),
});

const decisionNodeDefinitionSchema = z.strictObject({ kind: z.literal('DECISION'), key: z.string().min(1), mode: z.enum(['EXACT_ONE', 'FIRST_MATCH', 'MULTI_MATCH']).optional() });

const switchNodeDefinitionSchema = z.strictObject({ kind: z.literal('SWITCH'), key: z.string().min(1), value: canonicalExpressionSchema });

const parallelSplitNodeDefinitionSchema = z.strictObject({ kind: z.literal('PARALLEL_SPLIT'), key: z.string().min(1) });

const parallelJoinNodeDefinitionSchema = z.strictObject({
  kind: z.literal('PARALLEL_JOIN'),
  key: z.string().min(1),
  mode: z.enum(['ALL', 'ANY', 'THRESHOLD']),
  thresholdCount: z.number().int().positive().optional(),
  cancelRemaining: z.boolean().optional(),
});

const delayNodeDefinitionSchema = z.strictObject({
  kind: z.literal('DELAY'),
  key: z.string().min(1),
  delay: z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('DURATION_MS'), value: canonicalExpressionSchema }),
    z.strictObject({ type: z.literal('UNTIL'), value: canonicalExpressionSchema }),
  ]),
});

const waitEventNodeDefinitionSchema = z.strictObject({
  kind: z.literal('WAIT_EVENT'),
  key: z.string().min(1),
  eventName: z.string().min(1),
  correlation: canonicalExpressionSchema,
  timeout: z.strictObject({ afterMs: canonicalExpressionSchema, outcomeKey: z.string().min(1) }).optional(),
  outputAssignments: z.array(contextAssignmentSchema).optional(),
});

const workItemNodeDefinitionSchema = z.strictObject({
  kind: z.literal('WORK_ITEM'),
  key: z.string().min(1),
  workItemType: workItemTypeSchema,
  assignment: workItemAssignmentDefinitionSchema,
  allowedOutcomes: z.array(z.string().min(1)),
  title: canonicalExpressionSchema,
  summary: canonicalExpressionSchema.optional(),
  dueAt: canonicalExpressionSchema.optional(),
  followUpAt: canonicalExpressionSchema.optional(),
  approvalGroupKey: z.string().min(1).optional(),
  input: canonicalMappingSchema,
  outputSchema: jsonSchemaRefOrInlineSchema,
  formMode: z.enum(['DESIGNED_COMPONENT', 'DYNAMIC_SCHEMA_FORM', 'RAW_JSON']).optional(),
  formComponentRef: z.string().min(1).optional(),
  outputUiSchema: jsonValueSchema.optional(),
  outputAssignments: z.array(contextAssignmentSchema).optional(),
  escalationPolicy: workItemEscalationPolicySchema.optional(),
  excludeUsersFromWorkItemKeys: z.array(z.string().min(1)).optional(),
  requireReasonOutcomes: z.array(z.string().min(1)).optional(),
});

const subflowNodeDefinitionSchema = z.strictObject({
  kind: z.literal('SUBFLOW'),
  key: z.string().min(1),
  workflowDefinitionRef: exactWorkflowDefinitionRefSchema,
  input: canonicalMappingSchema,
  outputAssignments: z.array(contextAssignmentSchema).optional(),
  cancelEvent: z.strictObject({ eventName: z.string().min(1), correlation: canonicalExpressionSchema }).optional(),
});

const endNodeDefinitionSchema = z.strictObject({ kind: z.literal('END'), key: z.string().min(1), output: canonicalMappingSchema });

const failNodeDefinitionSchema = z.strictObject({
  kind: z.literal('FAIL'),
  key: z.string().min(1),
  errorCode: canonicalExpressionSchema,
  safeMessage: canonicalExpressionSchema,
  details: canonicalMappingSchema.optional(),
});

export const workflowNodeDefinitionSchema = z.discriminatedUnion('kind', [
  actionNodeDefinitionSchema,
  forEachNodeDefinitionSchema,
  loopNodeDefinitionSchema,
  decisionNodeDefinitionSchema,
  switchNodeDefinitionSchema,
  parallelSplitNodeDefinitionSchema,
  parallelJoinNodeDefinitionSchema,
  delayNodeDefinitionSchema,
  waitEventNodeDefinitionSchema,
  workItemNodeDefinitionSchema,
  subflowNodeDefinitionSchema,
  endNodeDefinitionSchema,
  failNodeDefinitionSchema,
]);

// ---------------------------------------------------------------------------
// Edges
// ---------------------------------------------------------------------------

export const workflowEdgeSelectorSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('UNCONDITIONAL') }),
  z.strictObject({ type: z.literal('DECISION'), condition: canonicalExpressionSchema, priority: z.number().int().optional() }),
  z.strictObject({ type: z.literal('DECISION_DEFAULT') }),
  z.strictObject({ type: z.literal('SWITCH_CASE'), value: jsonValueSchema }),
  z.strictObject({ type: z.literal('SWITCH_DEFAULT') }),
  z.strictObject({ type: z.literal('WORK_ITEM_OUTCOME'), outcomeKey: z.string().min(1) }),
  z.strictObject({ type: z.literal('WAIT_TIMEOUT'), outcomeKey: z.string().min(1) }),
  z.strictObject({ type: z.literal('ON_ERROR') }),
  z.strictObject({ type: z.literal('CANCEL_REGION') }),
]);

export const workflowEdgeDefinitionSchema = z.strictObject({
  key: z.string().min(1),
  fromNodeKey: z.string().min(1),
  toNodeKey: z.string().min(1),
  selector: workflowEdgeSelectorSchema,
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

export const startDefinitionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('MANUAL_API'), targetNodeKey: z.string().min(1) }),
  z.strictObject({ type: z.literal('EVENT'), targetNodeKey: z.string().min(1), eventName: z.string().min(1), correlation: canonicalExpressionSchema.optional() }),
  z.strictObject({ type: z.literal('SCHEDULE'), targetNodeKey: z.string().min(1), scheduledTaskBinding: canonicalPlatformBindingRefSchema }),
  z.strictObject({ type: z.literal('WEBHOOK'), targetNodeKey: z.string().min(1), ingressBinding: canonicalPlatformBindingRefSchema }),
]);

// ---------------------------------------------------------------------------
// Variables and policy
// ---------------------------------------------------------------------------

export const workflowVariableDefinitionSchema = z.strictObject({
  key: z.string().min(1),
  schema: jsonSchemaRefOrInlineSchema,
  initialValue: canonicalExpressionSchema.optional(),
});

export const workflowPolicyDefinitionSchema = z.strictObject({
  defaultRetryPolicy: retryPolicySchema.optional(),
  eventUnmatchedRecheckWindowMs: z.number().int().nonnegative().optional(),
  recoveryDetectionBoundMs: z.number().int().positive(),
  limits: z.strictObject({
    maxNodes: z.number().int().nonnegative(),
    maxEdges: z.number().int().nonnegative(),
    maxPayloadBytes: z.number().int().nonnegative(),
    maxJsonDepth: z.number().int().nonnegative(),
    maxExpressionNodes: z.number().int().nonnegative(),
    maxStructuralPathCandidates: z.number().int().nonnegative(),
    maxDelayMs: z.number().int().nonnegative(),
    maxWaitTimeoutMs: z.number().int().nonnegative(),
    maxWorkItemTitleLength: z.number().int().nonnegative(),
    maxSubflowRecursionDepth: z.number().int().nonnegative().optional(),
    maxForEachItems: z.number().int().nonnegative().optional(),
    defaultForEachConcurrency: z.number().int().positive().optional(),
  }),
});

// ---------------------------------------------------------------------------
// WorkflowModel
// ---------------------------------------------------------------------------

export const workflowModelSchema = z.strictObject({
  schemaVersion: z.string().min(1),
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  inputSchema: jsonSchemaRefOrInlineSchema,
  outputSchema: jsonSchemaRefOrInlineSchema,
  variables: z.array(workflowVariableDefinitionSchema),
  start: startDefinitionSchema,
  nodes: z.array(workflowNodeDefinitionSchema),
  edges: z.array(workflowEdgeDefinitionSchema),
  policies: workflowPolicyDefinitionSchema,
});
