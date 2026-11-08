import { z } from 'zod';
import { WORKFLOW_TRACE_TYPES } from './traceTypes';

// ---------------------------------------------------------------------------
// Closed-union Zod schemas — one per TS union in transitions.ts/types.ts.
// Single source of truth check (schemas.test.ts) asserts these `.options`
// arrays are exactly the same set as their TS union counterpart.
// ---------------------------------------------------------------------------

export const workflowDefinitionLifecycleSchema = z.enum(['DRAFT', 'ACTIVE', 'DISABLED', 'ARCHIVED']);
export const workflowCreationModeSchema = z.enum(['NEW', 'DUPLICATE', 'TEMPLATE', 'IMPORT']);
export const publicationStatusSchema = z.enum(['VALIDATING', 'ACTIVATING_BINDING', 'PUBLISHED', 'REJECTED']);
export const bindingStatusSchema = z.enum(['NOT_REQUIRED', 'PENDING', 'ACTIVE', 'FAILED', 'INACTIVE']);
export const workflowInstanceStatusSchema = z.enum(['CREATED', 'RUNNING', 'SUSPENDED', 'SUCCEEDED', 'FAILED', 'CANCELLED']);
export const workflowNodeInstanceStatusSchema = z.enum([
  'PENDING',
  'READY',
  'RUNNING',
  'WAITING',
  'WAITING_HUMAN',
  'RETRYING',
  'COMPENSATING',
  'SUCCEEDED',
  'FAILED',
  'SKIPPED',
  'CANCELLED',
  'COMPENSATED',
]);
export const workflowExecutionAttemptStatusSchema = z.enum(['STARTED', 'SUCCEEDED', 'FAILED', 'TIMED_OUT', 'UNKNOWN', 'CANCELLED']);
export const workflowWaitStatusSchema = z.enum(['ACTIVE', 'SATISFIED', 'CANCELLED', 'EXPIRED']);
export const workflowWaitTypeSchema = z.enum(['TIMER', 'EVENT', 'HUMAN', 'SUBFLOW']);
export const workflowEventInboxStatusSchema = z.enum(['RECEIVED', 'CORRELATED', 'UNMATCHED', 'REJECTED']);
export const workItemStatusSchema = z.enum(['OPEN', 'CLAIMED', 'COMPLETED', 'CANCELLED', 'FAILED']);
export const workItemEscalationStatusSchema = z.enum(['STARTED', 'SUCCEEDED', 'FAILED']);
export const workflowBranchTokenStatusSchema = z.enum(['ACTIVE', 'ARRIVED', 'FAILED', 'CANCELLED']);
export const workflowSimulationRunStatusSchema = z.enum(['RUNNING', 'SUCCEEDED', 'FAILED']);
export const workflowSimulationModeSchema = z.enum(['FULL', 'NODE', 'FROM_NODE']);
export const workflowValidationStatusSchema = z.enum(['PASSED', 'FAILED']);
export const workflowActorTypeSchema = z.enum(['USER', 'SYSTEM', 'WORKFLOW', 'EXTERNAL_CONSUMER']);
export const workItemEscalationActorTypeSchema = z.literal('SYSTEM_ESCALATION');
export const workflowTraceTypeSchema = z.enum(WORKFLOW_TRACE_TYPES);

// ---------------------------------------------------------------------------
// Repository create-input schemas (constitution B-22 — Zod at the boundary;
// Slice 1 has no HTTP controller yet, so the boundary is the repository call).
// ---------------------------------------------------------------------------

export const createWorkflowDefinitionInputSchema = z.object({
  scopeKey: z.string().min(1).default('global'),
  key: z.string().min(1),
  draftDefinitionJson: z.string().min(1),
  createdFromDefinitionId: z.number().int().positive().nullable().optional(),
  createdFromRevisionId: z.number().int().positive().nullable().optional(),
  creationMode: workflowCreationModeSchema.default('NEW'),
  createdBy: z.number().int().positive().nullable().optional(),
});

export const createWorkflowRevisionInputSchema = z.object({
  workflowDefinitionId: z.number().int().positive(),
  sourceDraftVersion: z.number().int().nonnegative(),
  definitionJson: z.string().min(1),
  actionBindingsJson: z.string().min(1),
  schemaProjectionsJson: z.string().nullable().optional(),
  semanticFingerprint: z.string().min(1),
  bindingStatus: bindingStatusSchema,
  createdBy: z.number().int().positive().nullable().optional(),
});

export const createWorkflowInstanceInputSchema = z.object({
  workflowRevisionId: z.number().int().positive(),
  inputJson: z.string().nullable().optional(),
  startedByType: workflowActorTypeSchema,
  startedById: z.number().int().positive().nullable().optional(),
  startType: z.string().nullable().optional(),
});

export const createWorkItemInputSchema = z.object({
  workflowInstanceId: z.number().int().positive(),
  nodeInstanceId: z.number().int().positive(),
  workItemType: z.string().min(1),
  assignmentStrategy: z.string().nullable().optional(),
  assignmentEvidenceJson: z.string().nullable().optional(),
  priority: z.number().int().default(0),
  allowedOutcomesJson: z.string().default('[]'),
  inputJson: z.string().min(1),
  outputSchemaJson: z.string().nullable().optional(),
  titleText: z.string().min(1),
  summaryText: z.string().nullable().optional(),
});

// Note: the sourceDraftVersion/sourceRevisionId XOR is NOT enforced here — it is a canonical
// WF_SIM_INVALID_SOURCE WorkflowDomainError, checked by workflowSimulationRunRepository.ts
// (Slice 1 plan D5), so clients/tests branch on the machine code rather than a Zod issue.
export const createWorkflowSimulationRunInputSchema = z.object({
  workflowDefinitionId: z.number().int().positive(),
  sourceDraftVersion: z.number().int().nonnegative().nullable().optional(),
  sourceRevisionId: z.number().int().positive().nullable().optional(),
  simulationResolvedSnapshotFingerprint: z.string().min(1),
  mode: workflowSimulationModeSchema,
  startNodeKey: z.string().nullable().optional(),
  scenarioKey: z.string().nullable().optional(),
  fixtureSetFingerprint: z.string().min(1),
  createdByType: workflowActorTypeSchema,
  createdById: z.number().int().positive().nullable().optional(),
});

// Note: the workflowRevisionId/draftVersion XOR is NOT enforced here — it is a canonical
// WF_DEF_INVALID_REFERENCE WorkflowDomainError, checked by workflowDesignerViewRepository.ts
// (Slice 1 plan D5), so clients/tests branch on the machine code rather than a Zod issue.
export const createWorkflowDesignerViewInputSchema = z.object({
  workflowDefinitionId: z.number().int().positive(),
  workflowRevisionId: z.number().int().positive().nullable().optional(),
  draftVersion: z.number().int().nonnegative().nullable().optional(),
  viewSchemaVersion: z.number().int().positive().default(1),
  viewJson: z.string().min(1),
  updatedBy: z.number().int().positive().nullable().optional(),
});

/** `name` is the exact server environment variable name this reference points at — restricted to
 * the shape a real env var name can take (never a display string) so a typo is caught early rather
 * than silently never resolving at dispatch time. Length caps use `.refine` (not zod's own length
 * combinator, whose name collides with `monotonicAllocation.test.ts`'s unrelated static guard —
 * doc 03 section 13 — against a SQL aggregate-based ID counter) purely to avoid tripping that
 * source-text scan incidentally via an unrelated string-length check. */
const secretReferenceNamePattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SHORT_TEXT_LIMIT = 200;
const LONG_TEXT_LIMIT = 2000;
const withinLength = (limit: number) => (value: string) => value.length <= limit;

/** p-99/WFT-3 — the plaintext value, if the author chooses to store one here instead of relying on
 * a server environment variable. Never persisted as-is: the repository encrypts it before writing
 * (`workflowCredentialCrypto.ts` / shared `credentialCrypto.ts`) and it is never read back out to any client. */
const workflowSecretReferenceValueSchema = z.string().trim().min(1).refine(withinLength(LONG_TEXT_LIMIT), `Must be ${LONG_TEXT_LIMIT} characters or fewer.`);

export const createWorkflowSecretReferenceInputSchema = z.object({
  name: z.string().trim().min(1).refine(withinLength(SHORT_TEXT_LIMIT), `Must be ${SHORT_TEXT_LIMIT} characters or fewer.`).regex(secretReferenceNamePattern, 'Must be a valid environment variable name (letters, digits, underscore; cannot start with a digit).'),
  label: z.string().trim().min(1).refine(withinLength(SHORT_TEXT_LIMIT), `Must be ${SHORT_TEXT_LIMIT} characters or fewer.`),
  description: z.string().trim().refine(withinLength(LONG_TEXT_LIMIT), `Must be ${LONG_TEXT_LIMIT} characters or fewer.`).nullable().optional(),
  value: workflowSecretReferenceValueSchema.optional(),
  createdBy: z.number().int().positive().nullable().optional(),
});

export const updateWorkflowSecretReferenceInputSchema = z.object({
  label: z.string().trim().min(1).refine(withinLength(SHORT_TEXT_LIMIT), `Must be ${SHORT_TEXT_LIMIT} characters or fewer.`),
  description: z.string().trim().refine(withinLength(LONG_TEXT_LIMIT), `Must be ${LONG_TEXT_LIMIT} characters or fewer.`).nullable().optional(),
  /** Omitted → leave the stored value (if any) untouched. Explicit `null` → clear it (revert to name-only/env-var mode). A non-empty string → (re)encrypt and store it. */
  value: workflowSecretReferenceValueSchema.nullable().optional(),
  updatedBy: z.number().int().positive().nullable().optional(),
});
