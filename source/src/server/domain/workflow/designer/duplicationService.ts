import { WorkflowDomainError } from '../errors';
import { getWorkflowDefinitionById, findWorkflowDefinitionByScopeAndKey, createWorkflowDefinition } from '../workflowDefinitionRepository';
import { getWorkflowRevisionById } from '../workflowRevisionRepository';
import type { WorkflowDefinitionRecord, WorkflowActorType } from '../types';
import type { WorkflowModel } from '../awm/types';

/**
 * `WorkflowDefinitionService.DuplicateWorkflow` (doc 02 section 13) — doc 02 section 9 and doc 11
 * section 16 authority. Duplicate creates a brand-new definition identity and an independent
 * mutable draft from either an immutable source revision or a version-fenced source draft; no
 * runtime rows, publication pointer or revision ID are ever copied — `createWorkflowDefinition`
 * already always starts a new row at `draftVersion: 1`, `currentPublishedRevisionId: null`, which
 * is exactly that guarantee, so this service only needs to source the correct AWM JSON and stamp
 * provenance, not reimplement "independent new definition."
 *
 * This is explicitly NOT a Template Gallery/Marketplace/Remix feature (doc 08 section 9): TEMPLATE
 * remains an unused `WorkflowCreationMode` member here, same as `types.ts`'s pre-existing closed
 * union already declares it without this slice wiring any TEMPLATE path.
 */

export type DuplicateWorkflowSource =
  | { type: 'DRAFT'; workflowDefinitionId: number; expectedDraftVersion: number }
  | { type: 'REVISION'; sourceRevisionId: number };

export type DuplicateWorkflowTarget = { scopeKey: string; key: string; name?: string };

export async function duplicateWorkflow(
  source: DuplicateWorkflowSource,
  target: DuplicateWorkflowTarget,
  actor: { type: WorkflowActorType; id: number | null },
): Promise<WorkflowDefinitionRecord> {
  const existingTarget = await findWorkflowDefinitionByScopeAndKey(target.scopeKey, target.key);
  if (existingTarget) {
    throw new WorkflowDomainError('WF_DEF_INVALID_REFERENCE', `A WorkflowDefinition already exists at scope "${target.scopeKey}" key "${target.key}".`, { scopeKey: target.scopeKey, key: target.key });
  }

  let sourceModel: WorkflowModel;
  let createdFromDefinitionId: number | null;
  let createdFromRevisionId: number | null;

  if (source.type === 'DRAFT') {
    const definition = await getWorkflowDefinitionById(source.workflowDefinitionId);
    if (!definition) {
      throw new WorkflowDomainError('WF_DEF_STALE_DRAFT_VERSION', 'Source WorkflowDefinition not found.', { workflowDefinitionId: source.workflowDefinitionId });
    }
    if (definition.draftVersion !== source.expectedDraftVersion) {
      throw new WorkflowDomainError('WF_DEF_STALE_DRAFT_VERSION', 'Source draftVersion is stale.', { workflowDefinitionId: source.workflowDefinitionId, expectedDraftVersion: source.expectedDraftVersion });
    }
    sourceModel = JSON.parse(definition.draftDefinitionJson) as WorkflowModel;
    createdFromDefinitionId = definition.id;
    createdFromRevisionId = null;
  } else {
    const revision = await getWorkflowRevisionById(source.sourceRevisionId);
    if (!revision) {
      throw new WorkflowDomainError('WF_DEF_STALE_REVISION_VERSION', 'Source WorkflowRevision not found.', { sourceRevisionId: source.sourceRevisionId });
    }
    sourceModel = JSON.parse(revision.definitionJson) as WorkflowModel;
    createdFromDefinitionId = revision.workflowDefinitionId;
    createdFromRevisionId = revision.id;
  }

  const duplicatedModel: WorkflowModel = { ...sourceModel, key: target.key, name: target.name ?? sourceModel.name };

  return createWorkflowDefinition({
    scopeKey: target.scopeKey,
    key: target.key,
    draftDefinitionJson: JSON.stringify(duplicatedModel),
    createdFromDefinitionId,
    createdFromRevisionId,
    creationMode: 'DUPLICATE',
    createdBy: actor.id,
  });
}
