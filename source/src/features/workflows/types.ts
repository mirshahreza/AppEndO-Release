/**
 * Minimal client-side mirror of the server AWM/Designer shapes actually rendered by this feature.
 * Deliberately NOT importing from `src/server/domain/workflow/**` — server domain code (Prisma,
 * Node-only modules) must never ship in the browser bundle. Fields not used by any component are
 * left as `unknown`/index-signature passthrough rather than fully replicated.
 */

export type JsonValue = unknown;

export type WorkflowNode = { key: string; kind: string; [k: string]: JsonValue };
export type WorkflowEdge = { key: string; fromNodeKey: string; toNodeKey: string; selector: { type: string; [k: string]: JsonValue } };

export type WorkflowModel = {
  schemaVersion: string;
  key: string;
  name: string;
  description?: string;
  start: { type: string; targetNodeKey: string; [k: string]: JsonValue };
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables: Array<{ key: string; [k: string]: JsonValue }>;
  policies: Record<string, JsonValue>;
  inputSchema: JsonValue;
  outputSchema: JsonValue;
};

export type WorkflowDefinitionSummary = {
  id: number;
  scopeKey: string;
  key: string;
  lifecycleStatus: string;
  creationMode: string;
  draftVersion: number;
  currentPublishedRevisionId: number | null;
  stateVersion: number;
  updatedAt: string | null;
};

export type WorkflowDesignerProjection = {
  definition: {
    id: number;
    scopeKey: string;
    key: string;
    lifecycleStatus: string;
    creationMode: string;
    createdFromDefinitionId: number | null;
    createdFromRevisionId: number | null;
    stateVersion: number;
    createdAt: string | null;
    createdBy: string | null;
    updatedAt: string | null;
    updatedBy: string | null;
  };
  publicationStatus: {
    isPublished: boolean;
    lastPublishedAt: string | null;
    lastPublishedBy: string | null;
    lastUnpublishedAt: string | null;
    lastUnpublishedBy: string | null;
  };
  draftVersion: number;
  model: WorkflowModel;
  designerView: { viewJson: string } | null;
  latestValidation: { status: string; issuesJson: string; createdAt: string | null } | null;
  currentPublishedRevision: { id: number; revisionNumber: number; publicationStatus: string; bindingStatus: string; semanticFingerprint: string } | null;
  actionCatalog: Array<{
    key: string;
    version: string;
    availability: string;
    sideEffectClass: string;
    tags: string[];
    configSchema?: { type: 'REF' | 'INLINE'; ref?: string; schema?: JsonValue };
    inputSchema?: { type: 'REF' | 'INLINE'; ref?: string; schema?: JsonValue };
    secretReferenceFields?: string[];
  }>;
};

/** Top-level field names under `root` ("config" | "input") that `secretReferenceFields` (doc 04
 * section 7) marks as secret-reference subtrees — e.g. `["config.headers"]` -> `{root:'config'}` ->
 * `Set(['headers'])`. Deeper pointers (`config.a.b`) still mark their first segment, since that's
 * the field the author-facing form renders a single control for. */
export function secretFieldNamesForRoot(secretReferenceFields: string[] | undefined, root: 'config' | 'input'): Set<string> {
  const names = new Set<string>();
  for (const pointer of secretReferenceFields ?? []) {
    const [rootName, fieldName] = pointer.split('.');
    if (rootName === root && fieldName) names.add(fieldName);
  }
  return names;
}

/** One property of a resolved (INLINE) JSON Schema object, as authored on an `ActionDefinition`'s
 * `configSchema`/`inputSchema` — a loose mirror, not a full JSON Schema type, since this feature only
 * ever reads a handful of keywords to render a field. */
export type ActionJsonSchemaProperty = {
  type?: string;
  title?: string;
  description?: string;
  enum?: Array<string | number>;
  default?: JsonValue;
  format?: string;
  /** p-99/WFT-2 — present alongside `format: 'dynamic-options'`: the resolver key `ActionFieldsMappingEditor` calls `GET /api/workflows/dynamic-options/:source` with, to populate a live dropdown. */
  dynamicOptionsSource?: string;
  /** p-99/WFT-5 — present alongside `format: 'dynamic-record-fields'`: names the sibling config field (e.g. `'apiKey'`) whose literal value identifies which Data API's column list to render. */
  dynamicRecordFieldsSource?: string;
  properties?: Record<string, ActionJsonSchemaProperty>;
  items?: ActionJsonSchemaProperty;
};
export type ActionJsonSchema = { type?: string; properties?: Record<string, ActionJsonSchemaProperty>; required?: string[] };

/** p-99/WFT-2 — one entry in a `format: 'dynamic-options'` field's live dropdown. */
export type DynamicOption = { value: string; label: string };

/** p-99/WFT-5 — one writable column of the EdgeModel behind a Data API key, as returned by
 * `GET /api/workflows/edge-apis/:apiKey/record-fields`. */
export type WorkflowRecordFieldDescriptor = { field: string; name: string; dataType: string; allowNull: boolean };

/** p-99/WFT-8 — "safe subset" in-flight instance migration preflight/result. `reason` is present
 * only on a blocked item; kept loose (`{code:string; [k:string]:JsonValue}`) since the Designer only
 * ever displays it as a plain human-readable line, never branches on the specific code. */
export type WorkflowInstanceMigrationItem = { instanceId: number; safe: boolean; reason?: { code: string; [k: string]: JsonValue } };
export type WorkflowInstanceMigrationImpact = {
  fromRevisionId: number;
  toRevisionId: number;
  totalConsidered: number;
  migratableCount: number;
  blockedCount: number;
  items: WorkflowInstanceMigrationItem[];
};

/** `configSchema`/`inputSchema` are only ever machine-usable when `type === 'INLINE'` — a `REF`
 * points at a registry-side schema this client has no way to resolve, so callers fall back to the
 * generic free-form mapping editor for those (and for `undefined`/empty-`properties` schemas). */
export function resolveInlineActionSchema(ref: { type: 'REF' | 'INLINE'; ref?: string; schema?: JsonValue } | undefined): ActionJsonSchema | null {
  if (!ref || ref.type !== 'INLINE' || typeof ref.schema !== 'object' || ref.schema === null) return null;
  const schema = ref.schema as ActionJsonSchema;
  return schema.properties && Object.keys(schema.properties).length > 0 ? schema : null;
}

export type NodePosition = { x: number; y: number };
export type DesignerViewport = { x: number; y: number; zoom: number };
export type DesignerViewState = { nodePositions: Record<string, NodePosition>; viewport?: DesignerViewport };

export type ReferenceDescriptor = { type: string; label: string; [k: string]: JsonValue };

/** Mirrors the closed `CanonicalExpression` union (awm/types.ts) for the fields this feature now
 * builds real forms for (END output, FAIL errorCode/safeMessage, SWITCH value, ACTION input/config,
 * DECISION/SWITCH edge conditions). Anything outside a literal or a single PATH reference (e.g. a
 * function call) still round-trips through the raw-JSON editor unchanged. */
export type CanonicalExpression =
  | { op: 'LITERAL'; value: JsonValue }
  | { op: 'PATH'; path: { root: PathRoot; segments: Array<string | number> } }
  | { op: string; [k: string]: JsonValue };

export type PathRoot =
  | { type: 'WORKFLOW_INPUT' }
  | { type: 'WORKFLOW_VARIABLE'; variableKey: string }
  | { type: 'NODE_OUTPUT'; nodeKey: string }
  | { type: 'CURRENT_NODE_INPUT' }
  | { type: 'CURRENT_EVENT' }
  | { type: 'CURRENT_WORK_ITEM'; projection: string }
  /** WFV2-2 — legal only within a FOR_EACH node's `input` mapping, or a LOOP node's `condition`/`input`. */
  | { type: 'CURRENT_ITEM' }
  | { type: 'CURRENT_ITEM_INDEX' };

/** Mirrors the backend's recursive `CanonicalMappingValue` (awm/types.ts) — a mapping field's value
 * is not always a single expression: it may itself be a nested object or array of further mapping
 * values (fully supported and validated by the runtime evaluator/publish-time validator today; see
 * `workflowRecordFieldsLookup.ts`'s doc comment / p-99/WFT-5). Most editors here only ever build the
 * flat `EXPRESSION` variant; `DynamicRecordFieldsEditor` is the first to build a nested `OBJECT`. */
export type CanonicalMappingValue =
  | { type: 'EXPRESSION'; expression: CanonicalExpression }
  | { type: 'OBJECT'; fields: Record<string, CanonicalMappingValue> }
  | { type: 'ARRAY'; items: CanonicalMappingValue[] };

export type CanonicalMapping = { type: 'OBJECT'; fields: Record<string, CanonicalMappingValue> };

export type WorkflowExecuteEvidenceEntry = { sequence: number; type: string; nodeKey: string | null; detail: Record<string, JsonValue> };

/** A named pointer to a server environment variable — never a secret value itself (no vault exists
 * in this platform, see `secretResolution.ts`). `configuredOnThisNode` is a live, this-process-only
 * hint, not authoritative for multi-node deployments. */
export type WorkflowSecretReference = {
  id: number;
  name: string;
  label: string;
  description: string | null;
  configuredOnThisNode: boolean;
  /** p-99/WFT-3 — true when this reference has a value stored (encrypted) in the vault, resolved in preference to `process.env[name]`. Never carries the value itself. */
  hasStoredValue: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type WorkflowDeadLetterStatus = 'OPEN' | 'RESOLVED' | 'DISCARDED';

/** Mirrors `WorkflowDeadLetterRecord` (`workflowDeadLetterRepository.ts`) — an operator-facing park
 * for a workflow node that failed without a catching ON_ERROR edge. WFT-6 (p-99): read-only fields
 * plus the two mutable ones (`status`, `resolutionNote`) an operator sets on resolve. */
export type WorkflowDeadLetterRecord = {
  id: number;
  workflowInstanceId: number;
  nodeInstanceId: number;
  attemptId: number | null;
  nodeKey: string;
  status: WorkflowDeadLetterStatus;
  errorCode: string | null;
  errorClass: string | null;
  errorMessage: string | null;
  evidenceJson: string | null;
  resolvedByUserId: number | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  stateVersion: number;
  createdAt: string | null;
  updatedAt: string | null;
};

/** Mirrors `WorkItemSlaViolation` (`engine/workItemSlaService.ts`) — HWF-4.5 SLA Violations dashboard, read-only. */
export type WorkItemSlaViolation = {
  id: number;
  workflowInstanceId: number;
  workItemType: string;
  titleText: string;
  status: 'OPEN' | 'CLAIMED' | 'COMPLETED';
  priority: number;
  dueAt: string;
  completedAt: string | null;
  breachKind: 'STILL_OPEN' | 'COMPLETED_LATE';
  overdueMs: number;
};

/** Minimal mirror of a configured platform Data Source — offered as a quick-pick on any Action
 * field whose schema marks itself `format: 'data-source-id'` (see `dataDbQueryDefinition` in
 * `dbActions.ts`), since a platform can have more than one Data Source and an author should not
 * have to memorize/retype its raw id. */
export type WorkflowDataSourceOption = {
  id: string;
  name: string;
  type: string;
};

/** Published Data API offered as a quick-pick on `format: 'edge-api-key'` fields. */
export type WorkflowEdgeApiOption = {
  key: string;
  label: string;
};

export type WorkflowExecutionInstanceStatus = 'CREATED' | 'RUNNING' | 'SUSPENDED' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

export type WorkflowExecutionInstanceStatusFilter = WorkflowExecutionInstanceStatus | '';

export type WorkflowDefinitionDossier = {
  definition: {
    id: number;
    scopeKey: string;
    key: string;
    lifecycleStatus: string;
    draftVersion: number;
    isPublished: boolean;
    currentPublishedRevisionId: number | null;
    creationMode: string;
    createdFromDefinitionId: number | null;
    createdFromRevisionId: number | null;
    nodeCount: number;
    edgeCount: number;
    createdAt: string | null;
    createdBy: string | null;
    updatedAt: string | null;
    updatedBy: string | null;
  };
  publicationStatus: {
    isPublished: boolean;
    lastPublishedAt: string | null;
    lastPublishedBy: string | null;
    lastUnpublishedAt: string | null;
    lastUnpublishedBy: string | null;
  };
  publication: {
    revisionNumber: number;
    publishedAt: string | null;
    publishedBy: string | null;
    sourceDraftVersion: number;
  } | null;
  instanceSummary: {
    total: number;
    byStatus: Record<string, number>;
    nonTerminal: number;
  };
  revisions: Array<{
    id: number;
    revisionNumber: number;
    publicationStatus: string;
    bindingStatus: string;
    sourceDraftVersion: number;
    publishedAt: string | null;
    publishedBy: string | null;
    isCurrent: boolean;
    instanceCount: number;
  }>;
  instances: Array<{
    id: number;
    status: string;
    revisionNumber: number;
    workflowRevisionId: number;
    startType: string | null;
    startedByType: string;
    createdAt: string | null;
    updatedAt: string | null;
    nodeCount: number;
    activeNodeCount: number;
    nodes: Array<{ semanticNodeKey: string; status: string }>;
    activeWaitCount: number;
    openWorkItemCount: number;
    traceCount: number;
  }>;
  simulations: Array<{
    id: number;
    status: string;
    mode: string;
    sourceDraftVersion: number | null;
    sourceRevisionId: number | null;
    createdAt: string | null;
    completedAt: string | null;
  }>;
  validationReports: Array<{
    id: number;
    status: string;
    draftVersion: number;
    revisionId: number | null;
    validatorVersion: string;
    issueCount: number;
    createdAt: string | null;
  }>;
};

export type WorkflowNodeInstanceStatus =
  | 'PENDING'
  | 'READY'
  | 'RUNNING'
  | 'WAITING'
  | 'WAITING_HUMAN'
  | 'RETRYING'
  | 'COMPENSATING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'SKIPPED'
  | 'CANCELLED'
  | 'COMPENSATED';

export type WorkflowInstanceRecord = {
  id: number;
  workflowRevisionId: number;
  status: WorkflowExecutionInstanceStatus;
  inputJson: string | null;
  contextJson: string | null;
  outputJson: string | null;
  startedByType: string;
  startedById: number | null;
  startType: string | null;
  stateVersion: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type WorkflowExecutionAttemptRecord = {
  id: number;
  nodeInstanceId: number;
  status: string;
  logicalInvocationKey: string;
  createdAt: string | null;
  updatedAt: string | null;
  [k: string]: unknown;
};

export type WorkflowNodeInstanceRecord = {
  id: number;
  workflowInstanceId: number;
  semanticNodeKey: string;
  status: WorkflowNodeInstanceStatus;
  stateVersion: number;
  branchTokenId: number | null;
  inputJson?: string | null;
  outputJson?: string | null;
  selectedIncomingEdgeKey?: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type WorkflowInstanceInspection = {
  instance: WorkflowInstanceRecord;
  nodeInstances: WorkflowNodeInstanceRecord[];
  attemptsByNodeInstanceId: Record<number, WorkflowExecutionAttemptRecord[]>;
};

export type WorkflowProofEntry = {
  sequenceNumber: number;
  traceType: string;
  nodeInstanceId: number | null;
  corePayloadJson: string;
  diagnosticPayloadJson: string | null;
  createdAt: string | null;
  [k: string]: unknown;
};

export type WorkflowInstanceInspectTarget = {
  id: number;
  workflowRevisionId: number;
  revisionNumber: number;
  workflowDefinitionKey: string;
};
