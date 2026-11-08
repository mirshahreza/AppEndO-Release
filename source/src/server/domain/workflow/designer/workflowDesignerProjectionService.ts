import { WorkflowDomainError } from '../errors';
import { getWorkflowDefinitionById } from '../workflowDefinitionRepository';
import { getWorkflowRevisionById } from '../workflowRevisionRepository';
import { getViewByDraftIdentity, upsertDraftView } from '../workflowDesignerViewRepository';
import { findValidationReportsByDefinitionDraftVersion } from '../workflowValidationReportRepository';
import { listAvailableActionDefinitions } from '../actions/registry';
import type { WorkflowDefinitionRecord, WorkflowRevisionRecord, WorkflowDesignerViewRecord, WorkflowValidationReportRecord } from '../types';
import type { WorkflowModel } from '../awm/types';
import type { ActionDefinition } from '../actions/types';
import { prisma, toId } from '../prismaHelpers';

const resolveAuditUsername = async (userId: number | null): Promise<string | null> => {
  if (userId === null) {
    return null;
  }
  const row = await prisma().baseUser.findUnique({ where: { id: toId(userId) }, select: { username: true } });
  return row?.username ?? null;
};

/**
 * `WorkflowDesignerProjection` — sole read-side authority per doc 08 section 12: "Designer loads
 * one WorkflowDesignerProjection containing definition identity/lifecycle, exact draftVersion,
 * canonical WorkflowModel, separately keyed WorkflowDesignerView, latest exact-source validation
 * summary, current published revision identity/status, and authorized Action/reference catalog
 * metadata. The projection is read-only evidence; canonical draft remains server authority."
 *
 * "Authorized Action/reference catalog metadata" here is the safe, static Action catalog
 * (`listAvailableActionDefinitions()` — already the doc 04 section 3 authorized read projection);
 * node-scoped `@` reference descriptors are NOT included, since those depend on which specific
 * field/node the author is currently editing (`WorkflowReferenceCatalog.GetAuthorizedDescriptors`,
 * `designer/workflowReferenceCatalog.ts`) — the client calls that per-editing-context, it does not
 * come bundled in one whole-definition projection.
 */
export type WorkflowDesignerProjection = {
  definition: {
    id: number;
    scopeKey: string;
    key: string;
    lifecycleStatus: WorkflowDefinitionRecord['lifecycleStatus'];
    creationMode: WorkflowDefinitionRecord['creationMode'];
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
  designerView: WorkflowDesignerViewRecord | null;
  latestValidation: WorkflowValidationReportRecord | null;
  currentPublishedRevision: { id: number; revisionNumber: number; publicationStatus: WorkflowRevisionRecord['publicationStatus']; bindingStatus: WorkflowRevisionRecord['bindingStatus']; semanticFingerprint: string } | null;
  actionCatalog: ActionDefinition[];
};

export async function loadWorkflowDesignerProjection(workflowDefinitionId: number): Promise<WorkflowDesignerProjection> {
  const definition = await getWorkflowDefinitionById(workflowDefinitionId);
  if (!definition) {
    throw new WorkflowDomainError('WF_DEF_STALE_DRAFT_VERSION', 'WorkflowDefinition not found.', { workflowDefinitionId });
  }

  const [designerView, validationReports, currentRevision, createdByUsername, updatedByUsername, lastPublishedByUsername, lastUnpublishedByUsername] = await Promise.all([
    getViewByDraftIdentity(definition.id, definition.draftVersion),
    findValidationReportsByDefinitionDraftVersion(definition.id, definition.draftVersion),
    definition.currentPublishedRevisionId != null ? getWorkflowRevisionById(definition.currentPublishedRevisionId) : Promise.resolve(undefined),
    resolveAuditUsername(definition.createdBy),
    resolveAuditUsername(definition.updatedBy),
    resolveAuditUsername(definition.lastPublishedBy ?? null),
    resolveAuditUsername(definition.lastUnpublishedBy),
  ]);

  const isPublished = definition.currentPublishedRevisionId !== null;
  const resolvedLastPublishedBy = lastPublishedByUsername
    ?? (currentRevision?.createdBy != null ? await resolveAuditUsername(currentRevision.createdBy) : null);

  return {
    definition: {
      id: definition.id,
      scopeKey: definition.scopeKey,
      key: definition.key,
      lifecycleStatus: definition.lifecycleStatus,
      creationMode: definition.creationMode,
      createdFromDefinitionId: definition.createdFromDefinitionId,
      createdFromRevisionId: definition.createdFromRevisionId,
      stateVersion: definition.stateVersion,
      createdAt: definition.createdAt,
      createdBy: createdByUsername,
      updatedAt: definition.updatedAt,
      updatedBy: updatedByUsername,
    },
    publicationStatus: {
      isPublished,
      lastPublishedAt: definition.lastPublishedAt ?? currentRevision?.publishedAt ?? null,
      lastPublishedBy: resolvedLastPublishedBy,
      lastUnpublishedAt: definition.lastUnpublishedAt,
      lastUnpublishedBy: lastUnpublishedByUsername,
    },
    draftVersion: definition.draftVersion,
    model: JSON.parse(definition.draftDefinitionJson) as WorkflowModel,
    designerView: designerView ?? null,
    // findValidationReportsByDefinitionDraftVersion already orders createdAt desc — [0] is latest-exact-source.
    latestValidation: validationReports[0] ?? null,
    currentPublishedRevision: currentRevision
      ? { id: currentRevision.id, revisionNumber: currentRevision.revisionNumber, publicationStatus: currentRevision.publicationStatus, bindingStatus: currentRevision.bindingStatus, semanticFingerprint: currentRevision.semanticFingerprint }
      : null,
    actionCatalog: listAvailableActionDefinitions(),
  };
}

/** Drag/viewport/comment changes write ONLY WorkflowDesignerView (doc 08 section 12) — never the semantic draft, never bumping draftVersion. */
export async function saveWorkflowDesignerView(workflowDefinitionId: number, draftVersion: number, viewJson: string, updatedBy: number | null): Promise<WorkflowDesignerViewRecord> {
  return upsertDraftView({ workflowDefinitionId, draftVersion, viewSchemaVersion: 1, viewJson, updatedBy });
}
