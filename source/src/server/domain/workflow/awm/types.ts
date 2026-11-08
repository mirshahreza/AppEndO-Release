/**
 * Canonical AWM V1 type contract — sole authority per
 * docs/standards/workflow-engine-testing.md (doc 05)
 * section 19 (node/edge/start), section 24 (variables/context), section 26
 * (expressions/mappings), section 27 (policy/retry); Action refs mirror
 * 04-ACTION-RUNTIME-AND-CATALOG.md section 8; Work Item assignment/escalation
 * refs mirror 07-HUMAN-WORK-ITEMS.md section 8.
 *
 * Slice 2 scope: the type/shape authority and the draft-operation applier
 * (draftOperationApplier.ts). Deep publication-time semantic validation
 * (reachability, cycles, decision-ambiguity provability, edge-cardinality-
 * per-node-kind enforcement per doc 05 section 25, Action availability,
 * secret-literal scanning) is doc 05 section 13 territory and belongs to
 * Slice 4 ("Revision validation, resolved snapshots and publication/binding
 * lifecycle") — not implemented here.
 */

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * Slice 2 design decision (no existing platform convention found by
 * Repository Reality Audit — this is a new Workflow-owned contract, not a
 * platform primitive): a schema is either a reference to a registered
 * schema identifier or an inline JSON Schema document. Resolution of REF
 * against a real schema registry is later-slice territory; the shape itself
 * is stable now.
 */
export type JsonSchemaRefOrInline = { type: 'REF'; ref: string } | { type: 'INLINE'; schema: JsonValue };

// ---------------------------------------------------------------------------
// Canonical expression / path / mapping AST (doc 05 section 26)
// ---------------------------------------------------------------------------

export type CanonicalPathRoot =
  | { type: 'WORKFLOW_INPUT' }
  | { type: 'WORKFLOW_VARIABLE'; variableKey: string }
  | { type: 'NODE_OUTPUT'; nodeKey: string }
  | { type: 'CURRENT_NODE_INPUT' }
  | { type: 'CURRENT_EVENT' }
  | { type: 'CURRENT_WORK_ITEM'; projection: 'OUTCOME' | 'OUTPUT' }
  /** Bound only inside a FOR_EACH node's `input` mapping, or a LOOP node's `condition`/`input`. */
  | { type: 'CURRENT_ITEM' }
  | { type: 'CURRENT_ITEM_INDEX' };

export type CanonicalPath = { root: CanonicalPathRoot; segments: Array<string | number> };

export type CanonicalExpression =
  | { op: 'LITERAL'; value: JsonValue }
  | { op: 'PATH'; path: CanonicalPath }
  | { op: 'NOT'; value: CanonicalExpression }
  | { op: 'AND' | 'OR'; values: CanonicalExpression[] }
  | { op: 'EQ' | 'NE' | 'LT' | 'LTE' | 'GT' | 'GTE'; left: CanonicalExpression; right: CanonicalExpression }
  | { op: 'IS_NULL' | 'IS_NOT_NULL'; value: CanonicalExpression }
  | { op: 'ADD' | 'SUB' | 'MUL' | 'DIV' | 'MOD'; left: CanonicalExpression; right: CanonicalExpression }
  | { op: 'CONCAT'; values: CanonicalExpression[] }
  | { op: 'IN'; value: CanonicalExpression; set: CanonicalExpression }
  | { op: 'COALESCE'; values: CanonicalExpression[] }
  | { op: 'PURE_FUNCTION'; functionRef: { key: string; version: string }; args: CanonicalExpression[] };

export type CanonicalMappingValue =
  | { type: 'EXPRESSION'; expression: CanonicalExpression }
  | { type: 'OBJECT'; fields: Record<string, CanonicalMappingValue> }
  | { type: 'ARRAY'; items: CanonicalMappingValue[] };

export type CanonicalMapping = { type: 'OBJECT'; fields: Record<string, CanonicalMappingValue> };

// ---------------------------------------------------------------------------
// Action resolution (doc 04 section 8) — full Action Registry is Slice 3;
// this is the closed reference shape an ACTION node's AWM payload carries.
// ---------------------------------------------------------------------------

export type ExactActionRef = { actionKey: string; actionVersion: string };

/**
 * Author-owned inline implementation — no Action Registry entry, no separate Server Function
 * record. `code` runs in the exact same sandbox (`compileSandboxSource` + `runSandboxInWorkerPool`,
 * `actions/inlineCodeExecutor.ts`) Server Functions already use, with the same `req`/`res` ambient
 * ("req.body" = this node's evaluated `input`, "req.query" = this node's evaluated `config`; call
 * `res.json(...)` to produce the node's output). Added per PO request 2026-07-20: a workflow author
 * must be able to write a code node directly in the Designer, with zero separate object to create
 * or call elsewhere.
 */
export type InlineCodeActionRef = { type: 'INLINE_CODE'; code: string; language?: 'ts' | 'js'; timeoutMs?: number };

export type ActionResolutionRef =
  | { type: 'EXACT_PROVIDER'; action: ExactActionRef; providerId: string; providerVersion: string }
  | { type: 'CAPABILITY_RESOLVED'; action: ExactActionRef; requiredCapabilities: string[] }
  | InlineCodeActionRef;

// ---------------------------------------------------------------------------
// Work Item assignment / escalation (doc 07 section 8) — full Work Item
// service/runtime is Slice 8; this is the closed AWM authoring-time shape.
// ---------------------------------------------------------------------------

/** Closed V1 set, doc 07 section 1. */
export type WorkItemType = 'APPROVAL' | 'REVIEW' | 'DATA_ENTRY' | 'DECISION' | 'CONFIRMATION' | 'EXCEPTION' | 'AI_REVIEW';

export type WorkItemAssignmentDefinition =
  | { strategy: 'USER'; userId: string }
  | { strategy: 'ROLE'; roleId: string }
  | { strategy: 'EXPRESSION'; expression: CanonicalExpression }
  /**
   * WFV2-20 — Retain Familiar (Workflow Resource Patterns). Resolved at Work Item creation time
   * (`engine/workItemService.ts`'s `resolveSameAsWorkItemAssignment`, called from
   * `dispatchService.ts` BEFORE the pure `evaluateWorkItemCreation`, since resolving this needs a
   * real DB read — the same "resolve outside, commit inside" shape ACTION/SUBFLOW resolution
   * already uses) to: the user who actually claimed `workItemNodeKey`'s Work Item in this SAME
   * instance, or — if it was never individually claimed (e.g. completed by escalation) — that
   * prior Work Item's own resolved USER/ROLE descriptor. `workItemNodeKey` must name another
   * WORK_ITEM node (validated at publish time, `publication/rules/structuralValidation.ts`).
   */
  | { strategy: 'SAME_AS_WORK_ITEM'; workItemNodeKey: string }
  /**
   * WFV2-21 — Round Robin among a fixed author-declared user-id list. Resolved at Work Item
   * creation time via a real DB read (count of prior assignments for this definition+node) before
   * the pure `evaluateWorkItemCreation` runs — same "resolve outside, commit inside" pattern as
   * WFV2-20's `SAME_AS_WORK_ITEM`.
   */
  | { strategy: 'ROUND_ROBIN'; userIds: string[] }
  /**
   * WFV2-21 — Shortest Queue among members of a role: picks the user with the fewest active
   * (`OPEN`/`CLAIMED`) USER-targeted Work Items, tie-broken by lowest user id. Resolved at creation
   * time via a real DB read before `evaluateWorkItemCreation`.
   */
  | { strategy: 'SHORTEST_QUEUE'; roleId: string };

export type WorkItemEscalationStepAction =
  | { type: 'REASSIGN_USER'; userId: string }
  | { type: 'REASSIGN_ROLE'; roleId: string }
  | { type: 'RAISE_PRIORITY'; priority: number }
  | { type: 'COMPLETE_WITH_OUTCOME'; outcomeKey: string; output: CanonicalMapping }
  | { type: 'FAIL_WORKFLOW_NODE'; errorCode: string; safeMessage: string }
  | { type: 'NOTIFY'; notificationRef: CanonicalPlatformBindingRef; input: CanonicalMapping };

export type WorkItemEscalationStep = {
  key: string;
  /**
   * HWF-2.2 — `respectBusinessHours` is opt-in and defaults to `false`/absent (per user decision
   * 2026-08-30: raw wall-clock, today's behavior, unchanged unless explicitly enabled) — when `true`,
   * the due instant is computed against the single global Business Hours Calendar
   * (`workflowBusinessHoursCalendarRepository.ts`) instead of `createdAt + afterMs` directly.
   */
  trigger: { type: 'AFTER_OPEN_MS'; afterMs: number; respectBusinessHours?: boolean };
  action: WorkItemEscalationStepAction;
  maxExecutions: number;
  retryPolicy?: RetryPolicy;
};

export type WorkItemEscalationPolicy = { steps: WorkItemEscalationStep[] };

// ---------------------------------------------------------------------------
// Governed external references — minimal Slice-2 shape. Full resolution
// against the canonical Scheduled Task / webhook ingress / subflow-target
// primitives is Slice 4 (publication/binding) and Slice 9 (subflows)
// territory; the AWM authoring-time contract only needs a stable identifier
// shape now.
// ---------------------------------------------------------------------------

export type CanonicalPlatformBindingRef = { bindingType: string; bindingId: string };

export type ExactWorkflowDefinitionRef = { workflowDefinitionKey: string; scopeKey?: string };

// ---------------------------------------------------------------------------
// Retry policy (doc 05 section 8, section 27)
// ---------------------------------------------------------------------------

export type RetrySelector = { type: 'ERROR_CODE'; codes: string[] } | { type: 'ERROR_CLASS'; classes: string[] } | { type: 'TIMEOUT' };

export type RetryPolicy = {
  maxAttempts: number;
  strategy: 'FIXED' | 'EXPONENTIAL';
  initialDelayMs: number;
  maxDelayMs?: number;
  multiplier?: number;
  retryOn: RetrySelector[];
};

// ---------------------------------------------------------------------------
// Node kinds (doc 05 section 2, section 19)
// ---------------------------------------------------------------------------

export type ContextAssignment = { targetVariableKey: string; value: CanonicalExpression };

/**
 * WFV2-14 — Saga/compensation (F-6). An author-declared "undo" action, invoked by
 * `engine/sagaCompensationService.ts` in LIFO (reverse-completion) order across every SUCCEEDED
 * ACTION in the instance once the instance fails — the classic Saga pattern for undoing a real side
 * effect a sibling parallel branch (or any earlier step) already committed. `input`/`config` are
 * evaluated against the SAME final context the failed instance ended with (this node's own real
 * output is available via `NODE_OUTPUT(selfKey)`, same as any other already-completed node) —
 * compensation runs after the instance is already terminal, so nothing further mutates concurrently.
 */
export type ActionCompensationDefinition = {
  actionRef: ActionResolutionRef;
  config: CanonicalMapping;
  input: CanonicalMapping;
};

export type ActionNodeDefinition = {
  kind: 'ACTION';
  key: string;
  actionRef: ActionResolutionRef;
  config: CanonicalMapping;
  input: CanonicalMapping;
  outputAssignments?: ContextAssignment[];
  retryPolicy?: RetryPolicy;
  compensation?: ActionCompensationDefinition;
};

/**
 * WFV2-2 — dynamic per-item fork (PO-selected design: a new node kind, not expression-only array
 * ops). `items` evaluates once (no CURRENT_ITEM) to a JSON array; `actionRef`/`config` mirror ACTION
 * (config evaluated once, shared by every item); `input` is evaluated once PER ITEM with CURRENT_ITEM/
 * CURRENT_ITEM_INDEX bound. Unlike a true durable PARALLEL_SPLIT-per-item (which would require
 * relaxing the `(workflowInstanceId, semanticNodeKey)` node-occurrence uniqueness invariant doc03
 * section 24 relies on everywhere — a much larger rearchitecture), this node executes every item
 * in-process within its own single dispatch call (bounded by `maxConcurrency`), so it has no
 * crash-mid-loop resumability: a crash before completion re-dispatches the WHOLE node from scratch
 * on redrive, same as any other node kind's stale-RUNNING recovery. A documented V1 scope boundary,
 * not a silent gap — see `engine/dispatchService.ts`'s `dispatchCreateForEachNode`.
 */
export type ForEachNodeDefinition = {
  kind: 'FOR_EACH';
  key: string;
  items: CanonicalExpression;
  actionRef: ActionResolutionRef;
  config: CanonicalMapping;
  input: CanonicalMapping;
  /** In-process concurrency cap for the item loop; omitted defaults to `policies.limits.defaultForEachConcurrency`. */
  maxConcurrency?: number;
  retryPolicy?: RetryPolicy;
  /** ALL: every item must SUCCEED; ANY: at least one; THRESHOLD: at least `thresholdCount` (mirrors PARALLEL_JOIN's WFV2-18 modes). */
  joinMode: 'ALL' | 'ANY' | 'THRESHOLD';
  thresholdCount?: number;
  outputAssignments?: ContextAssignment[];
};

/**
 * In-process while-loop. `condition` is evaluated at the start of each iteration with
 * CURRENT_ITEM = previous output (null on the first pass) and CURRENT_ITEM_INDEX = 0-based
 * iteration. Same crash-redrive boundary as FOR_EACH: the whole node reruns if the lease is lost.
 */
export type LoopNodeDefinition = {
  kind: 'LOOP';
  key: string;
  condition: CanonicalExpression;
  actionRef: ActionResolutionRef;
  config: CanonicalMapping;
  input: CanonicalMapping;
  maxIterations?: number;
  retryPolicy?: RetryPolicy;
  outputAssignments?: ContextAssignment[];
};

/**
 * `mode` is optional at authoring time even though doc 05 section 19's illustrative type block
 * shows it unqualified — section 19's closing paragraph is explicit that publication normalizes
 * an omitted `mode` to `EXACT_ONE`, so the mutable draft shape must allow omission for that rule
 * to have anything to act on. The draft-operation applier (doc 02 section 12) fills the default.
 */
export type DecisionNodeDefinition = { kind: 'DECISION'; key: string; mode?: 'EXACT_ONE' | 'FIRST_MATCH' | 'MULTI_MATCH' };

export type SwitchNodeDefinition = { kind: 'SWITCH'; key: string; value: CanonicalExpression };

export type ParallelSplitNodeDefinition = { kind: 'PARALLEL_SPLIT'; key: string };

/**
 * WFV2-18 — `THRESHOLD` is additive alongside the original `ALL`/`ANY` (van der Aalst's
 * N-out-of-M Join / Discriminator control-flow pattern; neither `ALL` (wait for every branch) nor
 * `ANY` (wait for exactly the first) can express "proceed once 3 of 5 branches arrive"). Required
 * `thresholdCount` only when `mode: 'THRESHOLD'` — validated against the owning split's actual
 * branch count at publish time (`publication/rules/parallelValidation.ts`), same place `ALL`/`ANY`
 * are structurally checked today.
 */
export type ParallelJoinNodeDefinition = { kind: 'PARALLEL_JOIN'; key: string; mode: 'ALL' | 'ANY' | 'THRESHOLD'; thresholdCount?: number; cancelRemaining?: boolean };

export type DelayNodeDefinition = {
  kind: 'DELAY';
  key: string;
  delay: { type: 'DURATION_MS'; value: CanonicalExpression } | { type: 'UNTIL'; value: CanonicalExpression };
};

export type WaitEventNodeDefinition = {
  kind: 'WAIT_EVENT';
  key: string;
  eventName: string;
  correlation: CanonicalExpression;
  timeout?: { afterMs: CanonicalExpression; outcomeKey: string };
  outputAssignments?: ContextAssignment[];
};

export type WorkItemNodeDefinition = {
  kind: 'WORK_ITEM';
  key: string;
  workItemType: WorkItemType;
  assignment: WorkItemAssignmentDefinition;
  allowedOutcomes: string[];
  title: CanonicalExpression;
  summary?: CanonicalExpression;
  /**
   * HWF-2.1 — pure metadata (sort/filter only in the Inbox, per user decision 2026-08-30), evaluated
   * once at creation exactly like `title`/`summary` — never re-evaluated for display, never itself
   * triggers any automatic behavior (that stays Escalation Policy's job, kept deliberately separate).
   * Must evaluate to an ISO-8601 timestamp string.
   */
  dueAt?: CanonicalExpression;
  followUpAt?: CanonicalExpression;
  /**
   * HWF-3.1 — Multi-Approver Policy (per user decision 2026-08-30: macro-expansion, not a new engine
   * construct). A literal string (not an expression — set once by the author, shared verbatim across
   * every ballot WORK_ITEM node in one logical N-of-M/ANY/ALL decision, e.g. authored as a
   * PARALLEL_SPLIT + N×WORK_ITEM + PARALLEL_JOIN{mode} subgraph with the SAME `approvalGroupKey` on
   * each WORK_ITEM). Purely a UI-grouping hint for the Inbox — zero effect on engine dispatch.
   * Sequential multi-approval needs no such field: a plain chain of WORK_ITEM nodes already works.
   */
  approvalGroupKey?: string;
  input: CanonicalMapping;
  outputSchema: JsonSchemaRefOrInline;
  /**
   * HWF-1.1 — how the assignee fills in `outputSchema` in the Work Item Inbox. `DESIGNED_COMPONENT`
   * renders `formComponentRef` (a Component Designer artifact); `DYNAMIC_SCHEMA_FORM` renders a
   * schema-driven form generated at runtime purely from `outputSchema` (no design artifact needed);
   * `RAW_JSON` is today's textarea, kept as a deliberate expert/debug mode. Defaults to `RAW_JSON`
   * when omitted so every already-published graph keeps its current behavior unchanged.
   */
  formMode?: 'DESIGNED_COMPONENT' | 'DYNAMIC_SCHEMA_FORM' | 'RAW_JSON';
  /**
   * HWF-1.5 — reference to a Component Designer component (`folder/name`, stable identity) used when
   * `formMode` is `DESIGNED_COMPONENT`. Validated at publish time that the component actually exists.
   */
  formComponentRef?: string;
  /**
   * HWF-1.1 — optional author-time layout/widget override layer for `DYNAMIC_SCHEMA_FORM`, following
   * RJSF's "uiSchema is an optional override, not a mandatory parallel document" convention: an
   * author who provides nothing still gets a reasonable render purely from `outputSchema`.
   */
  outputUiSchema?: JsonValue;
  outputAssignments?: ContextAssignment[];
  escalationPolicy?: WorkItemEscalationPolicy;
  /**
   * WFV2-19 — Separation of Duties / Four-Eyes (Workflow Resource Patterns). Optional list of other
   * WORK_ITEM node keys in the SAME workflow definition; a user who claimed/completed any of the
   * named Work Items in the SAME running instance is not eligible to claim or complete this one.
   * Validated at publish time (referenced keys must exist and be WORK_ITEM kind, not self); enforced
   * at runtime in `engine/workItemService.ts`'s `isActorEligibleForWorkItem` (doc 07 section 2's
   * "revalidated at query, claim and completion" already covers re-checking this too).
   */
  excludeUsersFromWorkItemKeys?: string[];
  /**
   * HWF-4.5 — optional subset of `allowedOutcomes` for which completion MUST include a non-empty
   * `output.reason` string (e.g. `['REJECT']`) — enforced in `resolveWorkItemCompletionPlan`
   * (`engine/workItemService.ts`), same validation stage as the `outputSchema` check. Deliberately
   * separate from `outputSchema` itself (which the author may not want to touch just to add this one
   * field) and omitted-by-default so every already-published graph keeps accepting completions with
   * no `reason` field, exactly as before.
   */
  requireReasonOutcomes?: string[];
};

export type SubflowNodeDefinition = {
  kind: 'SUBFLOW';
  key: string;
  workflowDefinitionRef: ExactWorkflowDefinitionRef;
  input: CanonicalMapping;
  outputAssignments?: ContextAssignment[];
  /**
   * p-99/WFT-9 — "Cancel Region": an optional external-event trigger that gracefully cancels this
   * SUBFLOW's child instance (and its own descendants) WITHOUT failing the parent instance, non-
   * interrupting like a BPMN boundary cancel event. `correlation` evaluates once at wait-creation
   * time (no CURRENT_EVENT — same timing as WAIT_EVENT's own `correlation`, doc 05 section 26).
   * Requires a CANCEL_REGION outgoing edge (`structuralValidation.ts`) so the parent instance has a
   * defined continuation point once the region is cancelled — mirrors WORK_ITEM's allowedOutcomes<->
   * WORK_ITEM_OUTCOME exact-correspondence, not ON_ERROR's optional-with-fallback shape, since there
   * is no sensible default behavior for "cancelled with nowhere to go".
   */
  cancelEvent?: { eventName: string; correlation: CanonicalExpression };
};

export type EndNodeDefinition = { kind: 'END'; key: string; output: CanonicalMapping };

export type FailNodeDefinition = {
  kind: 'FAIL';
  key: string;
  errorCode: CanonicalExpression;
  safeMessage: CanonicalExpression;
  details?: CanonicalMapping;
};

export type WorkflowNodeDefinition =
  | ActionNodeDefinition
  | ForEachNodeDefinition
  | LoopNodeDefinition
  | DecisionNodeDefinition
  | SwitchNodeDefinition
  | ParallelSplitNodeDefinition
  | ParallelJoinNodeDefinition
  | DelayNodeDefinition
  | WaitEventNodeDefinition
  | WorkItemNodeDefinition
  | SubflowNodeDefinition
  | EndNodeDefinition
  | FailNodeDefinition;

/** Node-kind-independent edge key extraction convenience — every node definition carries `key`. */
export type WorkflowNodeKey = WorkflowNodeDefinition['key'];

// ---------------------------------------------------------------------------
// Edges (doc 05 section 19, section 25)
// ---------------------------------------------------------------------------

export type WorkflowEdgeSelector =
  | { type: 'UNCONDITIONAL' }
  | { type: 'DECISION'; condition: CanonicalExpression; priority?: number }
  | { type: 'DECISION_DEFAULT' }
  | { type: 'SWITCH_CASE'; value: JsonValue }
  | { type: 'SWITCH_DEFAULT' }
  | { type: 'WORK_ITEM_OUTCOME'; outcomeKey: string }
  | { type: 'WAIT_TIMEOUT'; outcomeKey: string }
  /**
   * WFV2-1 — ON_ERROR/CATCH edge (p-60's highest-leverage remaining structural gap). Optional,
   * additive outgoing edge on an ACTION node only, alongside its required UNCONDITIONAL edge: when
   * every configured retry attempt is exhausted (or the failure classification is non-retryable),
   * the node routes here instead of unconditionally failing the whole instance (doc05 section 29's
   * old "always INSTANCE_FAILED" behavior is now the fallback when no ON_ERROR edge is declared, not
   * the only behavior). At most one per ACTION node (`structuralValidation.ts`).
   */
  | { type: 'ON_ERROR' }
  /** p-99/WFT-9 — SUBFLOW's Cancel Region continuation edge; legal only on a SUBFLOW node that declares `cancelEvent`, and required exactly once when it does. */
  | { type: 'CANCEL_REGION' };

export type WorkflowEdgeDefinition = {
  key: string;
  fromNodeKey: string;
  toNodeKey: string;
  selector: WorkflowEdgeSelector;
};

// ---------------------------------------------------------------------------
// Start (doc 05 section 19, section 25)
// ---------------------------------------------------------------------------

export type StartDefinition =
  | { type: 'MANUAL_API'; targetNodeKey: string }
  | { type: 'EVENT'; targetNodeKey: string; eventName: string; correlation?: CanonicalExpression }
  | { type: 'SCHEDULE'; targetNodeKey: string; scheduledTaskBinding: CanonicalPlatformBindingRef }
  | { type: 'WEBHOOK'; targetNodeKey: string; ingressBinding: CanonicalPlatformBindingRef };

// ---------------------------------------------------------------------------
// Variables and workflow-level policy (doc 05 section 24, section 27)
// ---------------------------------------------------------------------------

export type WorkflowVariableDefinition = { key: string; schema: JsonSchemaRefOrInline; initialValue?: CanonicalExpression };

export type WorkflowPolicyDefinition = {
  defaultRetryPolicy?: RetryPolicy;
  eventUnmatchedRecheckWindowMs?: number;
  recoveryDetectionBoundMs: number;
  limits: {
    maxNodes: number;
    maxEdges: number;
    maxPayloadBytes: number;
    maxJsonDepth: number;
    maxExpressionNodes: number;
    maxStructuralPathCandidates: number;
    maxDelayMs: number;
    maxWaitTimeoutMs: number;
    maxWorkItemTitleLength: number;
    /** WFV2-4 — optional; runtime defaults to `DEFAULT_MAX_SUBFLOW_RECURSION_DEPTH` (dispatchService.ts) when absent. Enforced at SUBFLOW dispatch time, not publish time, since a self-referencing recursion's actual depth is a runtime property (doc 05 section 20's acyclic-graph rule only bounds the *static* graph). */
    maxSubflowRecursionDepth?: number;
    /** WFV2-2 — bounds a FOR_EACH node's runtime-evaluated `items` array length; enforced at dispatch time (the array length is not known until runtime), same shape as `maxSubflowRecursionDepth`. Optional; runtime defaults to `DEFAULT_MAX_FOR_EACH_ITEMS` (dispatchService.ts) when absent. */
    maxForEachItems?: number;
    /** WFV2-2 — default in-process concurrency for a FOR_EACH node with no per-node `maxConcurrency` override. */
    defaultForEachConcurrency?: number;
    /** Bounds a LOOP node's iteration count; runtime defaults to 25 when absent. */
    maxLoopIterations?: number;
  };
};

// ---------------------------------------------------------------------------
// WorkflowModel — the canonical AWM root (doc 05 section 1, section 19)
// ---------------------------------------------------------------------------

export type WorkflowModel = {
  schemaVersion: string;
  key: string;
  name: string;
  description?: string;
  inputSchema: JsonSchemaRefOrInline;
  outputSchema: JsonSchemaRefOrInline;
  variables: WorkflowVariableDefinition[];
  start: StartDefinition;
  nodes: WorkflowNodeDefinition[];
  edges: WorkflowEdgeDefinition[];
  policies: WorkflowPolicyDefinition;
};
