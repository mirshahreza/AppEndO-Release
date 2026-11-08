import { prisma, toId, fromId } from '../prismaHelpers';
import { WorkflowDomainError } from '../errors';
import { canonicalJsonFingerprint } from '../canonicalJson';
import { getWorkflowRevisionById } from '../workflowRevisionRepository';
import { getWorkflowDefinitionById } from '../workflowDefinitionRepository';
import { getWorkflowInstanceById } from '../workflowInstanceRepository';
import { listNodeInstancesForInstance } from '../workflowNodeInstanceRepository';
import { emitTraceAutoRevision } from './traceEmission';
import type { Tx } from './continuationApply';
import type { WorkflowModel, JsonValue } from '../awm/types';
import type { WorkflowInstanceRecord, WorkflowNodeInstanceRecord, WorkflowActorType } from '../types';
import { evaluateExpression } from './expressionEvaluator';
import { buildEvaluationContext } from './evaluationContext';
import { validateAgainstJsonSchema } from '../../../utils/jsonSchemaValidate';

/**
 * `Start` command — doc 06 section 3, doc 03 section 24 (pre-materialization), doc 05 section 24
 * (variable initialization) and section 25 (start-target eligibility). One atomic transaction:
 * validates the revision is startable, initializes variables in declaration order, creates the
 * instance, pre-materializes one PENDING `WorkflowNodeInstance` per semantic node, readies exactly
 * `targetNodeKey`, and commits `CREATED -> RUNNING`.
 *
 * Slice 5 scope: this function takes an already-resolved `workflowRevisionId` (the caller — a
 * future transport/API layer, out of this slice — is responsible for resolving "the current
 * published startable revision" for a `WorkflowDefinition`; `assertRevisionIsStartable` below is
 * the shared startability check doc 05 section 14 requires either way). Input-schema validation
 * against `WorkflowModel.inputSchema` (doc 05 section 30) now runs via the real `ajv`-backed
 * `validateAgainstJsonSchema` (added to the repo after Slice 3's original "no validator exists"
 * finding) — this closes that carried-forward gap; a `REF` schema still honestly reports
 * `SCHEMA_REF_UNRESOLVED` rather than silently passing, since no schema registry exists to resolve
 * one. Reuses `WF_DEF_NOT_STARTABLE` (no dedicated code exists in the closed 33-entry registry for
 * "this exact input is unacceptable" — this is the closest canonical semantic match, same reuse
 * discipline the report's own package-removal `BLOCK` policy already established).
 *
 * Slice 9 extracted the atomic core (`startWorkflowInstanceInTx`) so `subflowContinuationApply.ts`'s
 * SUBFLOW child-start can reuse the exact same instance-creation/materialization/activation logic
 * inside the *parent's own* transaction (doc 05 section 31: "child instance creation/start, durable
 * parent-child link, SUBFLOW wait creation and parent node RUNNING → WAITING commit atomically").
 */

/**
 * Doc 05 section 14 (exact wording): "A revision is startable only in the canonical
 * PUBLISHED/ACTIVE or PUBLISHED/NOT_REQUIRED state required by its start type **and an ACTIVE
 * definition lifecycle**." Pre-Slice-12 this only checked the revision's own two fields — a real,
 * previously-undetected gap: a `NOT_REQUIRED`-binding (MANUAL_API/API) revision's binding status
 * never changes on `Disable` (doc 03 section 10 row 8, "PUBLISHED/NOT_REQUIRED -> disable ->
 * PUBLISHED/NOT_REQUIRED", unchanged by design), so nothing previously stopped a Start against a
 * `DISABLED` definition's current revision. Found by Slice 12's package-removal-impact tests (the
 * first tests to exercise Start after Disable). `definitionLifecycleStatus` is optional only for
 * source compatibility with any pre-existing internal caller that cannot yet supply it; every
 * production call site below now does.
 */
export function assertRevisionIsStartable(revision: { publicationStatus: string; bindingStatus: string }, definitionLifecycleStatus?: string): void {
  const startable = revision.publicationStatus === 'PUBLISHED' && (revision.bindingStatus === 'ACTIVE' || revision.bindingStatus === 'NOT_REQUIRED');
  const definitionActive = definitionLifecycleStatus === undefined || definitionLifecycleStatus === 'ACTIVE';
  if (!startable || !definitionActive) {
    throw new WorkflowDomainError('WF_DEF_NOT_STARTABLE', 'WorkflowRevision is not startable: requires PUBLISHED/ACTIVE or PUBLISHED/NOT_REQUIRED binding state and an ACTIVE WorkflowDefinition lifecycle.', {
      publicationStatus: revision.publicationStatus,
      bindingStatus: revision.bindingStatus,
      definitionLifecycleStatus: definitionLifecycleStatus ?? null,
    });
  }
}

export type StartWorkflowInstanceInput = {
  workflowRevisionId: number;
  input: JsonValue;
  startedByType: WorkflowActorType;
  startedById?: number | null;
  startType?: string;
};

/** Doc 05 section 24 — declaration order, against workflow input plus already-initialized earlier variables. Pure; no I/O. */
export function initializeStartVariables(model: WorkflowModel, workflowInput: JsonValue): Record<string, JsonValue> {
  let variables: Record<string, JsonValue> = {};
  for (const variableDef of model.variables) {
    const context = buildEvaluationContext({ workflowInput, variables, nodeOutputs: {}, currentNodeInput: null });
    const value = variableDef.initialValue !== undefined ? evaluateExpression(variableDef.initialValue, context) : null;
    variables = { ...variables, [variableDef.key]: value };
  }
  return variables;
}

/**
 * The atomic instance-creation core, reusable inside any already-open transaction: creates the
 * instance row (`CREATED`), pre-materializes one `PENDING` node per semantic node, readies exactly
 * `model.start.targetNodeKey`, and commits `CREATED → RUNNING`. Returns the new instance's numeric
 * id. Never opens its own transaction — callers own transaction boundaries.
 */
export async function startWorkflowInstanceInTx(
  tx: Tx,
  input: { workflowRevisionId: number; model: WorkflowModel; variables: Record<string, JsonValue>; workflowInput: JsonValue; startedByType: WorkflowActorType; startedById?: number | null; startType?: string },
): Promise<number> {
  const targetNodeKey = input.model.start.targetNodeKey;
  if (!input.model.nodes.some((n) => n.key === targetNodeKey)) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'Start targetNodeKey is absent from the pinned model — publication should have rejected this.', { targetNodeKey });
  }

  const instanceRow = await tx.workflowInstance.create({
    data: {
      workflowRevisionId: toId(input.workflowRevisionId),
      status: 'CREATED',
      inputJson: JSON.stringify(input.workflowInput),
      contextJson: JSON.stringify(input.variables),
      startedByType: input.startedByType,
      startedById: input.startedById != null ? toId(input.startedById) : null,
      startType: input.startType ?? input.model.start.type,
    },
  });

  await tx.workflowNodeInstance.createMany({
    data: input.model.nodes.map((node) => ({ workflowInstanceId: instanceRow.id, semanticNodeKey: node.key, status: 'PENDING' as const })),
  });

  const instanceId = fromId(instanceRow.id);
  const inputSchemaIdentity = input.model.inputSchema.type === 'REF' ? input.model.inputSchema.ref : 'INLINE';
  await emitTraceAutoRevision(tx, {
    workflowInstanceId: instanceId,
    traceType: 'INSTANCE_STARTED',
    actorType: input.startedByType,
    actorId: input.startedById ?? undefined,
    corePayload: {
      startType: input.startType ?? input.model.start.type,
      startedByType: input.startedByType,
      startedByRef: input.startedById != null ? String(input.startedById) : 'ANONYMOUS',
      inputSchemaIdentity,
      inputSchemaFingerprint: canonicalJsonFingerprint(input.model.inputSchema),
    },
  });

  const targetUpdate = await tx.workflowNodeInstance.updateMany({
    where: { workflowInstanceId: instanceRow.id, semanticNodeKey: targetNodeKey, status: 'PENDING' },
    data: { status: 'READY', stateVersion: { increment: 1 } },
  });
  if (targetUpdate.count !== 1) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'Failed to ready the start-target node occurrence during atomic Start.', { targetNodeKey });
  }
  await emitTraceAutoRevision(tx, {
    workflowInstanceId: instanceId,
    traceType: 'NODE_READY',
    actorType: 'SYSTEM',
    corePayload: { nodeKey: targetNodeKey },
  });

  const instanceUpdate = await tx.workflowInstance.updateMany({
    where: { id: instanceRow.id, stateVersion: instanceRow.stateVersion, status: 'CREATED' },
    data: { status: 'RUNNING', stateVersion: { increment: 1 } },
  });
  if (instanceUpdate.count !== 1) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'Failed to commit the CREATED -> RUNNING start transition.', {});
  }

  return instanceId;
}

export async function startWorkflowInstance(input: StartWorkflowInstanceInput): Promise<{ instance: WorkflowInstanceRecord; nodeInstances: WorkflowNodeInstanceRecord[] }> {
  const revision = await getWorkflowRevisionById(input.workflowRevisionId);
  if (!revision) {
    throw new WorkflowDomainError('WF_DEF_NOT_STARTABLE', 'WorkflowRevision not found.', { workflowRevisionId: input.workflowRevisionId });
  }
  const owningDefinition = await getWorkflowDefinitionById(revision.workflowDefinitionId);
  assertRevisionIsStartable(revision, owningDefinition?.lifecycleStatus);

  const model = JSON.parse(revision.definitionJson) as WorkflowModel;

  const inputValidation = validateAgainstJsonSchema(model.inputSchema, input.input);
  if (inputValidation.valid === false) {
    throw new WorkflowDomainError('WF_DEF_NOT_STARTABLE', 'Start input does not satisfy WorkflowModel.inputSchema.', {
      workflowRevisionId: input.workflowRevisionId,
      schemaViolations: inputValidation.errors,
    });
  }

  const variables = initializeStartVariables(model, input.input);

  const instanceId = await prisma().$transaction((tx) =>
    startWorkflowInstanceInTx(tx, {
      workflowRevisionId: input.workflowRevisionId,
      model,
      variables,
      workflowInput: input.input,
      startedByType: input.startedByType,
      startedById: input.startedById,
      startType: input.startType,
    }),
  );

  const instance = (await getWorkflowInstanceById(instanceId))!;
  const nodeInstances = await listNodeInstancesForInstance(instanceId);
  return { instance, nodeInstances };
}
