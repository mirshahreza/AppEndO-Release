import { WorkflowDomainError } from '../errors';
import { getWorkflowDefinitionById, transitionWorkflowDefinitionLifecycle, unpublishWorkflowDefinitionAtomically } from '../workflowDefinitionRepository';
import {
  createCandidateWorkflowRevision,
  getWorkflowRevisionById,
  listWorkflowRevisionsByDefinition,
  attachValidationReportToRevision,
  transitionPublicationBindingState,
  activateWorkflowRevisionPublicationAtomically,
  publishManualApiRevisionAtomically,
} from '../workflowRevisionRepository';
import { createValidationReport } from '../workflowValidationReportRepository';
import type { WorkflowModel, StartDefinition } from '../awm/types';
import type { WorkflowRevisionRecord, WorkflowDefinitionRecord } from '../types';
import type { BindingStatus } from '../transitions';
import { validateWorkflowDraftForPublication } from './publicationValidator';
import { buildResolvedSnapshot } from './resolvedSnapshot';
import { VALIDATOR_VERSION } from './validationTypes';
import { getBindingActivationAdapter, type BindingActivationOutcome } from './bindingAdapters';
import { canonicalJsonFingerprint } from '../canonicalJson';
import { cancelInstance } from '../engine/operationalCommands';
import {
  countNonTerminalInstancesByDefinitionId,
  getWorkflowInstanceById,
  listNonTerminalInstancesByDefinitionId,
} from '../workflowInstanceRepository';

/**
 * `WorkflowPublicationService` (doc 02 section 13) — Publish/RetryBindingActivation/
 * ReconcileBinding/GetRevision/ListRevisions, plus the Disable/Archive/ReEnable definition-lifecycle
 * commands that doc 03 section 10's binding matrix requires an owning authority for even though
 * doc 02 section 13's table does not name them explicitly (Slice 4 design decision: this service
 * owns them because it already owns the binding-adapter port those transitions must call through).
 */

const bindingStatusForStart = (startType: StartDefinition['type'] | undefined): BindingStatus => (startType === 'MANUAL_API' ? 'NOT_REQUIRED' : 'PENDING');

const parseStartTypeBestEffort = (rawJson: string): StartDefinition['type'] | undefined => {
  try {
    const parsed = JSON.parse(rawJson) as { start?: { type?: unknown } };
    const type = parsed.start?.type;
    return typeof type === 'string' ? (type as StartDefinition['type']) : undefined;
  } catch {
    return undefined;
  }
};

const definitionLifecycleInput = (definition: WorkflowDefinitionRecord): { from: 'DRAFT'; command: 'FIRST_REVISION_PUBLISHED' } | null =>
  definition.lifecycleStatus === 'DRAFT' ? { from: 'DRAFT', command: 'FIRST_REVISION_PUBLISHED' } : null;

export type PublishResult = { revision: WorkflowRevisionRecord; bindingActivation?: BindingActivationOutcome };

/** `Publish(expectedDraftVersion)` — doc 02 section 13, doc 03 sections 10 and 28. Never throws for a validation or binding-activation failure; those are legal terminal candidate states, reflected in the returned revision. */
export async function publishWorkflowDefinition(workflowDefinitionId: number, expectedDraftVersion: number, createdBy?: number): Promise<PublishResult> {
  const definition = await getWorkflowDefinitionById(workflowDefinitionId);
  if (!definition) {
    throw new WorkflowDomainError('WF_DEF_STALE_DRAFT_VERSION', 'WorkflowDefinition not found.', { workflowDefinitionId });
  }
  if (definition.draftVersion !== expectedDraftVersion) {
    throw new WorkflowDomainError('WF_DEF_STALE_DRAFT_VERSION', 'WorkflowDefinition draftVersion is stale.', { workflowDefinitionId, expectedDraftVersion });
  }
  if (definition.lifecycleStatus === 'ARCHIVED') {
    throw new WorkflowDomainError('WF_DEF_NOT_STARTABLE', 'Cannot publish an ARCHIVED WorkflowDefinition.', { workflowDefinitionId });
  }

  const shapeResult = (() => {
    try {
      return { model: JSON.parse(definition.draftDefinitionJson) as WorkflowModel, parseError: null as null };
    } catch (error) {
      return { model: null as null, parseError: error instanceof Error ? error.message : String(error) };
    }
  })();

  const validation = shapeResult.model
    ? await validateWorkflowDraftForPublication(shapeResult.model, definition.scopeKey)
    : { status: 'FAILED' as const, issues: [{ code: 'WF_DEF_INVALID_AWM', severity: 'ERROR' as const, message: `draftDefinitionJson is not valid JSON: ${shapeResult.parseError}` }], actionBindings: [] };

  const startType = shapeResult.model?.start.type ?? parseStartTypeBestEffort(definition.draftDefinitionJson);
  const bindingStatus = bindingStatusForStart(startType);

  const snapshot = validation.status === 'PASSED' && shapeResult.model ? buildResolvedSnapshot(shapeResult.model, validation.actionBindings) : null;
  const definitionJson = snapshot ? snapshot.definitionJson : definition.draftDefinitionJson;
  const actionBindingsJson = snapshot ? snapshot.actionBindingsJson : '[]';
  const schemaProjectionsJson = snapshot ? snapshot.schemaProjectionsJson : null;
  const semanticFingerprint = snapshot ? snapshot.semanticFingerprint : canonicalJsonFingerprint({ rejectedDraftVersion: expectedDraftVersion, workflowDefinitionId });

  const candidate = await createCandidateWorkflowRevision({
    workflowDefinitionId,
    sourceDraftVersion: expectedDraftVersion,
    definitionJson,
    actionBindingsJson,
    schemaProjectionsJson,
    semanticFingerprint,
    bindingStatus,
    createdBy: createdBy ?? null,
  });

  const report = await createValidationReport({
    workflowDefinitionId,
    revisionId: candidate.id,
    draftVersion: expectedDraftVersion,
    status: validation.status,
    validatorVersion: VALIDATOR_VERSION,
    issuesJson: JSON.stringify(validation.issues),
  });
  await attachValidationReportToRevision(candidate.id, report.id);

  if (validation.status === 'FAILED') {
    const rejected = await transitionPublicationBindingState(candidate.id, candidate.stateVersion, 'VALIDATION_FAILS');
    return { revision: rejected };
  }

  if (startType === 'MANUAL_API') {
    const { revision } = await publishManualApiRevisionAtomically({
      revisionId: candidate.id,
      expectedRevisionStateVersion: candidate.stateVersion,
      workflowDefinitionId: definition.id,
      expectedDefinitionStateVersion: definition.stateVersion,
      definitionLifecycle: definitionLifecycleInput(definition),
      publishedBy: createdBy ?? null,
    });
    return { revision };
  }

  // Trigger start (EVENT/SCHEDULE/WEBHOOK): move to ACTIVATING_BINDING/PENDING, then attempt
  // activation once through the exact adapter for this binding type.
  const activating = await transitionPublicationBindingState(candidate.id, candidate.stateVersion, 'VALIDATION_AND_SNAPSHOT_SUCCEED');
  return attemptBindingActivation(activating, definition, shapeResult.model!.start, createdBy ?? null);
}

async function attemptBindingActivation(
  activatingRevision: WorkflowRevisionRecord,
  definition: WorkflowDefinitionRecord,
  start: StartDefinition,
  publishedBy: number | null = null,
): Promise<PublishResult> {
  const adapter = getBindingActivationAdapter(start.type);
  if (!adapter) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `No binding activation adapter registered for start type "${start.type}".`, { startType: start.type });
  }

  const outcome = await adapter.activate({ workflowDefinitionId: definition.id, workflowRevisionId: activatingRevision.id, start });
  if (outcome.ok) {
    const { revision } = await activateWorkflowRevisionPublicationAtomically({
      revisionId: activatingRevision.id,
      expectedRevisionStateVersion: activatingRevision.stateVersion,
      workflowDefinitionId: definition.id,
      expectedDefinitionStateVersion: definition.stateVersion,
      definitionLifecycle: definitionLifecycleInput(definition),
      publishedBy,
    });
    return { revision, bindingActivation: outcome };
  }

  const failed = await transitionPublicationBindingState(activatingRevision.id, activatingRevision.stateVersion, 'ACTIVATION_FAILS');
  return { revision: failed, bindingActivation: outcome };
}

/** `RetryBindingActivation(expectedRevisionStateVersion)` — doc 02 section 13, doc 03 section 10's ACTIVATE_OR_RETRY_ACTIVATION row. */
export async function retryBindingActivation(
  revisionId: number,
  expectedRevisionStateVersion: number,
  publishedBy?: number | null,
): Promise<PublishResult> {
  const existing = await getWorkflowRevisionById(revisionId);
  if (!existing) {
    throw new WorkflowDomainError('WF_DEF_STALE_REVISION_VERSION', 'WorkflowRevision not found.', { revisionId });
  }
  if (existing.publicationStatus !== 'ACTIVATING_BINDING') {
    throw new WorkflowDomainError('WF_DEF_STALE_REVISION_VERSION', `RetryBindingActivation is only legal from ACTIVATING_BINDING (current: ${existing.publicationStatus}/${existing.bindingStatus}).`, { revisionId });
  }
  const definition = await getWorkflowDefinitionById(existing.workflowDefinitionId);
  if (!definition) {
    throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'Owning WorkflowDefinition not found.', { revisionId });
  }

  const retrying = await transitionPublicationBindingState(revisionId, expectedRevisionStateVersion, 'ACTIVATE_OR_RETRY_ACTIVATION');
  const model = JSON.parse(existing.definitionJson) as WorkflowModel;
  return attemptBindingActivation(retrying, definition, model.start, publishedBy ?? null);
}

/** `ReconcileBinding(expectedRevisionStateVersion)` — doc 02 section 13, doc 03 section 10's REENABLE_OR_RECONCILE row (PUBLISHED+INACTIVE -> PUBLISHED+ACTIVE only). */
export async function reconcileBinding(revisionId: number, expectedRevisionStateVersion: number): Promise<{ revision: WorkflowRevisionRecord; bindingActivation?: BindingActivationOutcome }> {
  const existing = await getWorkflowRevisionById(revisionId);
  if (!existing) {
    throw new WorkflowDomainError('WF_DEF_STALE_REVISION_VERSION', 'WorkflowRevision not found.', { revisionId });
  }
  if (existing.publicationStatus !== 'PUBLISHED' || existing.bindingStatus !== 'INACTIVE') {
    throw new WorkflowDomainError('WF_DEF_STALE_REVISION_VERSION', `ReconcileBinding is only legal from PUBLISHED/INACTIVE (current: ${existing.publicationStatus}/${existing.bindingStatus}).`, { revisionId });
  }
  const definition = await getWorkflowDefinitionById(existing.workflowDefinitionId);
  if (!definition) {
    throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'Owning WorkflowDefinition not found.', { revisionId });
  }
  const model = JSON.parse(existing.definitionJson) as WorkflowModel;
  const adapter = getBindingActivationAdapter(model.start.type);
  if (!adapter) {
    // MANUAL_API revisions are NOT_REQUIRED and never reach PUBLISHED/INACTIVE via disable (they
    // stay NOT_REQUIRED — doc 03 section 10 row 7), so this branch is unreachable for a legal row.
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `No binding activation adapter registered for start type "${model.start.type}".`, { revisionId });
  }
  const outcome = await adapter.reconcile({ workflowDefinitionId: definition.id, workflowRevisionId: revisionId, start: model.start });
  if (!outcome.ok) {
    return { revision: existing, bindingActivation: outcome };
  }
  const revision = await transitionPublicationBindingState(revisionId, expectedRevisionStateVersion, 'REENABLE_OR_RECONCILE');
  return { revision, bindingActivation: outcome };
}

export async function getWorkflowRevision(revisionId: number): Promise<WorkflowRevisionRecord | undefined> {
  return getWorkflowRevisionById(revisionId);
}

export async function listWorkflowRevisions(workflowDefinitionId: number): Promise<WorkflowRevisionRecord[]> {
  return listWorkflowRevisionsByDefinition(workflowDefinitionId);
}

async function currentRevisionBindingSideEffect(
  definition: WorkflowDefinitionRecord,
  action: (adapter: ReturnType<typeof getBindingActivationAdapter>, revision: WorkflowRevisionRecord) => Promise<void>,
): Promise<void> {
  if (definition.currentPublishedRevisionId === null) return;
  const revision = await getWorkflowRevisionById(definition.currentPublishedRevisionId);
  if (!revision || revision.bindingStatus === 'NOT_REQUIRED') return;
  const model = JSON.parse(revision.definitionJson) as WorkflowModel;
  const adapter = getBindingActivationAdapter(model.start.type);
  await action(adapter, revision);
}

/** DISABLE_DEFINITION (doc 03 section 10 rows 7–8). Not fully atomic with the revision-side transition (documented Slice 4 decision — see module doc comment); each mutation is independently CAS-fenced on its own aggregate. */
export async function disableWorkflowDefinition(workflowDefinitionId: number, expectedDefinitionStateVersion: number): Promise<WorkflowDefinitionRecord> {
  const definition = await getWorkflowDefinitionById(workflowDefinitionId);
  if (!definition) throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowDefinition not found.', { workflowDefinitionId });

  await currentRevisionBindingSideEffect(definition, async (adapter, revision) => {
    if (revision.bindingStatus === 'ACTIVE' && adapter) {
      const outcome = await adapter.deactivate({ workflowDefinitionId: definition.id, workflowRevisionId: revision.id, start: (JSON.parse(revision.definitionJson) as WorkflowModel).start });
      if (!outcome.ok) throw new WorkflowDomainError('WF_DEF_MISSING_CANONICAL_PLATFORM_CONTRACT', outcome.message);
    }
    await transitionPublicationBindingState(revision.id, revision.stateVersion, 'DISABLE_DEFINITION');
  });

  return transitionWorkflowDefinitionLifecycle(workflowDefinitionId, expectedDefinitionStateVersion, 'DISABLE');
}

/** ARCHIVE_DEFINITION (doc 03 section 10 row 9) — legal from DRAFT/ACTIVE/DISABLED at the definition level. */
export async function archiveWorkflowDefinition(workflowDefinitionId: number, expectedDefinitionStateVersion: number): Promise<WorkflowDefinitionRecord> {
  const definition = await getWorkflowDefinitionById(workflowDefinitionId);
  if (!definition) throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowDefinition not found.', { workflowDefinitionId });

  await currentRevisionBindingSideEffect(definition, async (adapter, revision) => {
    if (revision.bindingStatus === 'ACTIVE' && adapter) {
      const outcome = await adapter.deactivate({ workflowDefinitionId: definition.id, workflowRevisionId: revision.id, start: (JSON.parse(revision.definitionJson) as WorkflowModel).start });
      if (!outcome.ok) throw new WorkflowDomainError('WF_DEF_MISSING_CANONICAL_PLATFORM_CONTRACT', outcome.message);
    }
    if (revision.bindingStatus === 'ACTIVE' || revision.bindingStatus === 'INACTIVE') {
      await transitionPublicationBindingState(revision.id, revision.stateVersion, 'ARCHIVE_DEFINITION');
    }
  });

  return transitionWorkflowDefinitionLifecycle(workflowDefinitionId, expectedDefinitionStateVersion, 'ARCHIVE');
}

/** RE_ENABLE (definition-level) — doc 03 section 2 requires "a startable current published revision"; reconciles the current revision's binding back to ACTIVE when it is a trigger binding. */
export async function reEnableWorkflowDefinition(workflowDefinitionId: number, expectedDefinitionStateVersion: number): Promise<WorkflowDefinitionRecord> {
  const definition = await getWorkflowDefinitionById(workflowDefinitionId);
  if (!definition) throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowDefinition not found.', { workflowDefinitionId });
  if (definition.currentPublishedRevisionId === null) {
    throw new WorkflowDomainError('WF_DEF_NOT_STARTABLE', 'Cannot re-enable a WorkflowDefinition with no published revision.', { workflowDefinitionId });
  }

  const revision = await getWorkflowRevisionById(definition.currentPublishedRevisionId);
  if (revision && revision.bindingStatus === 'INACTIVE') {
    const { bindingActivation } = await reconcileBinding(revision.id, revision.stateVersion);
    if (bindingActivation && !bindingActivation.ok) {
      throw new WorkflowDomainError('WF_DEF_MISSING_CANONICAL_PLATFORM_CONTRACT', bindingActivation.message);
    }
  }

  return transitionWorkflowDefinitionLifecycle(workflowDefinitionId, expectedDefinitionStateVersion, 'RE_ENABLE');
}

export type UnpublishImpact = { isPublished: boolean; incompleteInstanceCount: number };

/** Read-only preflight for the Designer published switch — how many instances would be cancelled on unpublish. */
export async function getWorkflowUnpublishImpact(workflowDefinitionId: number): Promise<UnpublishImpact> {
  const definition = await getWorkflowDefinitionById(workflowDefinitionId);
  if (!definition) {
    throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowDefinition not found.', { workflowDefinitionId });
  }
  const incompleteInstanceCount = await countNonTerminalInstancesByDefinitionId(workflowDefinitionId);
  return { isPublished: definition.currentPublishedRevisionId !== null, incompleteInstanceCount };
}

/**
 * Unpublish — deactivates trigger bindings, cancels every non-terminal instance, then clears
 * `currentPublishedRevisionId` and returns the definition to DRAFT. The Designer exposes this as a
 * binary published switch (0/1); incomplete instances are terminated, not preserved.
 */
export async function unpublishWorkflowDefinition(
  workflowDefinitionId: number,
  expectedDefinitionStateVersion: number,
  unpublishedBy?: number | null,
): Promise<WorkflowDefinitionRecord> {
  const definition = await getWorkflowDefinitionById(workflowDefinitionId);
  if (!definition) {
    throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowDefinition not found.', { workflowDefinitionId });
  }
  if (definition.currentPublishedRevisionId === null) {
    throw new WorkflowDomainError('WF_DEF_NOT_STARTABLE', 'Workflow is not published.', { workflowDefinitionId });
  }
  if (definition.lifecycleStatus === 'ARCHIVED') {
    throw new WorkflowDomainError('WF_DEF_NOT_STARTABLE', 'Cannot unpublish an ARCHIVED WorkflowDefinition.', { workflowDefinitionId });
  }

  await currentRevisionBindingSideEffect(definition, async (adapter, revision) => {
    if (revision.bindingStatus === 'ACTIVE' && adapter) {
      const outcome = await adapter.deactivate({
        workflowDefinitionId: definition.id,
        workflowRevisionId: revision.id,
        start: (JSON.parse(revision.definitionJson) as WorkflowModel).start,
      });
      if (!outcome.ok) {
        throw new WorkflowDomainError('WF_DEF_MISSING_CANONICAL_PLATFORM_CONTRACT', outcome.message);
      }
    }
  });

  const instances = await listNonTerminalInstancesByDefinitionId(workflowDefinitionId);
  for (const instance of instances) {
    const current = await getWorkflowInstanceById(instance.id);
    if (!current || current.status === 'SUCCEEDED' || current.status === 'FAILED' || current.status === 'CANCELLED') {
      continue;
    }
    await cancelInstance(current.id, current.stateVersion);
  }

  return unpublishWorkflowDefinitionAtomically(workflowDefinitionId, expectedDefinitionStateVersion, unpublishedBy ?? null);
}
