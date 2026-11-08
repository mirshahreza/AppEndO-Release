import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { loadWorkflowDesignerProjection, saveWorkflowDesignerView } from '../domain/workflow/designer/workflowDesignerProjectionService';
import { loadWorkflowDefinitionDossier } from '../domain/workflow/designer/workflowDefinitionDossierService';
import { applyDraftOperationsToDefinition, createWorkflowDefinition, listWorkflowDefinitions } from '../domain/workflow/workflowDefinitionRepository';
import {
  listWorkflowSecretReferences,
  createWorkflowSecretReference,
  updateWorkflowSecretReference,
  deleteWorkflowSecretReference,
} from '../domain/workflow/workflowSecretReferenceRepository';
import { validateWorkflowDraft } from '../domain/workflow/publication/validateDraftPreview';
import { resolveDynamicOptions } from '../domain/workflow/actions/dynamicOptionsRegistry';
import { listWorkflowRecordFieldsForEdgeApiKey } from '../domain/workflow/workflowRecordFieldsLookup';
import { getInstanceMigrationImpact, migrateInstancesToRevision } from '../domain/workflow/publication/instanceMigrationService';
import {
  publishWorkflowDefinition,
  retryBindingActivation as retryBindingActivationService,
  reconcileBinding as reconcileBindingService,
  getWorkflowRevision,
  listWorkflowRevisions,
  disableWorkflowDefinition,
  archiveWorkflowDefinition,
  reEnableWorkflowDefinition,
  getWorkflowUnpublishImpact,
  unpublishWorkflowDefinition,
} from '../domain/workflow/publication/workflowPublicationService';
import { computeSemanticDiff } from '../domain/workflow/designer/semanticDiff';
import { getAuthorizedWorkflowReferences, searchWorkflowReferences, compileWorkflowReference, type WorkflowReferenceContext, type WorkflowReferenceDescriptor } from '../domain/workflow/designer/workflowReferenceCatalog';
import { deleteWorkflowDefinition, getWorkflowDeleteImpact } from '../domain/workflow/workflowDefinitionDeletionService';
import { duplicateWorkflow } from '../domain/workflow/designer/duplicationService';
import { exportWorkflowDefinition, importWorkflowDefinition } from '../domain/workflow/portability/workflowDefinitionPortabilityService';
import { runWorkflowSimulation } from '../domain/workflow/designer/simulation/workflowSimulationService';
import { buildEmptyWorkflowModel } from '../domain/workflow/designer/newWorkflowModel';
import { getWorkflowRevisionById } from '../domain/workflow/workflowRevisionRepository';
import type { WorkflowModel } from '../domain/workflow/awm/types';
import { handleWorkflowError, handleTransportError, actorFromRequest, paginateArray, resolvePageSize } from './workflowTransportSupport';

/**
 * Transport for the Slice 11 Designer surface plus (Slice 12) the doc 10 Integration/API contract's
 * ListRevisions/GetRevision/RetryBindingActivation/ReconcileBinding and definition
 * lifecycle (Disable/Archive/Re-enable) endpoints — see
 * `docs/architecture/workflow-designer-frontend-wiring.md` for the Slice 11 architecture decisions
 * this controller implements, and `docs/standards/workflow-engine-testing.md` for the Slice 12 API-contract
 * scope decision (this is the platform-internal, admin-authenticated Native/API surface; the doc 10
 * *external* third-party contract is explicitly not built — see that report). Every handler here
 * delegates to an already-tested domain service and adds no additional business logic of its own,
 * matching doc 02 section 13's "transport handlers MUST delegate to these authorities and may not
 * duplicate domain transitions."
 */

export class WorkflowsController {
  listDefinitions = asyncHandler(async (req: Request, res: Response) => {
    const scopeKey = typeof req.query.scopeKey === 'string' ? req.query.scopeKey : undefined;
    const pageSize = resolvePageSize(req.query.pageSize);
    const all = await listWorkflowDefinitions(scopeKey);
    const page = paginateArray(all, req.query.cursor, pageSize);
    res.json({ success: true, definitions: page.items, nextCursor: page.nextCursor });
  }, 'Failed to list Workflow definitions.', { onError: handleTransportError });

  createDefinition = asyncHandler(async (req: Request, res: Response) => {
    const { scopeKey, key, name } = req.body as { scopeKey?: string; key: string; name?: string };
    const model = buildEmptyWorkflowModel(key, name ?? key);
    const record = await createWorkflowDefinition({ scopeKey: scopeKey ?? 'global', key, draftDefinitionJson: JSON.stringify(model), creationMode: 'NEW', createdBy: req.auth?.userId ?? null });
    res.json({ success: true, record });
  }, 'Failed to create Workflow definition.', { onError: handleWorkflowError });

  getProjection = asyncHandler(async (req: Request, res: Response) => {
    const projection = await loadWorkflowDesignerProjection(Number(req.params.definitionId));
    res.json({ success: true, projection });
  }, 'Failed to load Workflow Designer projection.', { onError: handleWorkflowError });

  getDossier = asyncHandler(async (req: Request, res: Response) => {
    const dossier = await loadWorkflowDefinitionDossier(Number(req.params.definitionId));
    res.json({ success: true, dossier });
  }, 'Failed to load Workflow dossier.', { onError: handleWorkflowError });

  applyDraftOperations = asyncHandler(async (req: Request, res: Response) => {
    const { expectedDraftVersion, operations } = req.body as { expectedDraftVersion: number; operations: unknown[] };
    const result = await applyDraftOperationsToDefinition(Number(req.params.definitionId), Number(expectedDraftVersion), operations as never);
    res.json({ success: true, record: result.record, affectedNodeKeys: result.affectedNodeKeys, affectedEdgeKeys: result.affectedEdgeKeys, workflowLevelChanged: result.workflowLevelChanged });
  }, 'Failed to apply draft operations.', { onError: handleWorkflowError });

  saveDesignerView = asyncHandler(async (req: Request, res: Response) => {
    const { draftVersion, viewJson } = req.body as { draftVersion: number; viewJson: string };
    const view = await saveWorkflowDesignerView(Number(req.params.definitionId), Number(draftVersion), viewJson, req.auth?.userId ?? null);
    res.json({ success: true, view });
  }, 'Failed to save Designer view state.', { onError: handleWorkflowError });

  validateDraft = asyncHandler(async (req: Request, res: Response) => {
    const { expectedDraftVersion } = req.body as { expectedDraftVersion: number };
    const report = await validateWorkflowDraft(Number(req.params.definitionId), Number(expectedDraftVersion));
    res.json({ success: true, report });
  }, 'Failed to validate draft.', { onError: handleWorkflowError });

  getPublishDiff = asyncHandler(async (req: Request, res: Response) => {
    const projection = await loadWorkflowDesignerProjection(Number(req.params.definitionId));
    const previousModel = projection.currentPublishedRevision ? (JSON.parse((await getWorkflowRevisionById(projection.currentPublishedRevision.id))!.definitionJson) as WorkflowModel) : null;
    const diff = computeSemanticDiff(previousModel, projection.model);
    res.json({ success: true, diff });
  }, 'Failed to compute publish diff.', { onError: handleWorkflowError });

  publish = asyncHandler(async (req: Request, res: Response) => {
    const { expectedDraftVersion } = req.body as { expectedDraftVersion: number };
    const result = await publishWorkflowDefinition(Number(req.params.definitionId), Number(expectedDraftVersion), req.auth?.userId ?? null);
    res.json({ success: true, revision: result.revision, bindingActivation: result.bindingActivation ?? null });
  }, 'Failed to publish.', { onError: handleWorkflowError });

  /** `WorkflowPublicationService.ListRevisions` (doc 02 section 13) — cursor-paginated, newest-first (existing `listWorkflowRevisions` ordering). */
  listRevisions = asyncHandler(async (req: Request, res: Response) => {
    const pageSize = resolvePageSize(req.query.pageSize);
    const all = await listWorkflowRevisions(Number(req.params.definitionId));
    const page = paginateArray(all, req.query.cursor, pageSize);
    res.json({ success: true, revisions: page.items, nextCursor: page.nextCursor });
  }, 'Failed to list Workflow revisions.', { onError: handleTransportError });

  /** `WorkflowPublicationService.GetRevision` (doc 02 section 13). */
  getRevision = asyncHandler(async (req: Request, res: Response) => {
    const revision = await getWorkflowRevision(Number(req.params.revisionId));
    if (!revision) {
      res.status(404).json({ success: false, error: 'WorkflowRevision not found.' });
      return;
    }
    res.json({ success: true, revision });
  }, 'Failed to load Workflow revision.', { onError: handleWorkflowError });

  /** `WorkflowPublicationService.RetryBindingActivation` (doc 02 section 13, doc 03 section 10 row "ACTIVATING_BINDING/FAILED -> retry"). */
  retryBindingActivation = asyncHandler(async (req: Request, res: Response) => {
    const { expectedRevisionStateVersion } = req.body as { expectedRevisionStateVersion: number };
    const result = await retryBindingActivationService(Number(req.params.revisionId), Number(expectedRevisionStateVersion));
    res.json({ success: true, revision: result.revision, bindingActivation: result.bindingActivation ?? null });
  }, 'Failed to retry binding activation.', { onError: handleWorkflowError });

  /** `WorkflowPublicationService.ReconcileBinding` (doc 02 section 13, doc 03 section 10 "reconciliation repairs adapter drift only"). */
  reconcileBinding = asyncHandler(async (req: Request, res: Response) => {
    const { expectedRevisionStateVersion } = req.body as { expectedRevisionStateVersion: number };
    const result = await reconcileBindingService(Number(req.params.revisionId), Number(expectedRevisionStateVersion));
    res.json({ success: true, revision: result.revision, bindingActivation: result.bindingActivation ?? null });
  }, 'Failed to reconcile binding.', { onError: handleWorkflowError });

  /** p-99/WFT-8 — read-only preflight: which non-terminal instances on `fromRevisionId` are safely migratable to `toRevisionId`. */
  getInstanceMigrationImpact = asyncHandler(async (req: Request, res: Response) => {
    const { fromRevisionId, toRevisionId } = req.body as { fromRevisionId: number; toRevisionId: number };
    const impact = await getInstanceMigrationImpact(Number(fromRevisionId), Number(toRevisionId));
    res.json({ success: true, impact });
  }, 'Failed to compute instance migration impact.', { onError: handleWorkflowError });

  /** p-99/WFT-8 — commits the "safe subset" migration; re-validates server-side, never trusts a stale client-held impact list. */
  migrateInstances = asyncHandler(async (req: Request, res: Response) => {
    const { fromRevisionId, toRevisionId } = req.body as { fromRevisionId: number; toRevisionId: number };
    const impact = await migrateInstancesToRevision(Number(fromRevisionId), Number(toRevisionId));
    res.json({ success: true, impact });
  }, 'Failed to migrate instances.', { onError: handleWorkflowError });

  /** WorkflowDefinition lifecycle DISABLE (doc 03 section 10 rows 7-8) — not enumerated in doc 02 section 13's authority table by name, but it is an existing tested `workflowPublicationService.ts` authority with no other transport; exposing it is required for the Designer/operations surface to actually reach every reachable lifecycle transition per the doc 11 section 1 item 12 completion goal. */
  disableDefinition = asyncHandler(async (req: Request, res: Response) => {
    const { expectedDefinitionStateVersion } = req.body as { expectedDefinitionStateVersion: number };
    const record = await disableWorkflowDefinition(Number(req.params.definitionId), Number(expectedDefinitionStateVersion));
    res.json({ success: true, record });
  }, 'Failed to disable Workflow definition.', { onError: handleWorkflowError });

  /** WorkflowDefinition lifecycle ARCHIVE (doc 03 section 10 row 9, ARCHIVED is terminal per doc 03 section 2). */
  archiveDefinition = asyncHandler(async (req: Request, res: Response) => {
    const { expectedDefinitionStateVersion } = req.body as { expectedDefinitionStateVersion: number };
    const record = await archiveWorkflowDefinition(Number(req.params.definitionId), Number(expectedDefinitionStateVersion));
    res.json({ success: true, record });
  }, 'Failed to archive Workflow definition.', { onError: handleWorkflowError });

  /** WorkflowDefinition lifecycle RE_ENABLE (doc 03 section 10 row 10). */
  reEnableDefinition = asyncHandler(async (req: Request, res: Response) => {
    const { expectedDefinitionStateVersion } = req.body as { expectedDefinitionStateVersion: number };
    const record = await reEnableWorkflowDefinition(Number(req.params.definitionId), Number(expectedDefinitionStateVersion));
    res.json({ success: true, record });
  }, 'Failed to re-enable Workflow definition.', { onError: handleWorkflowError });

  getUnpublishImpact = asyncHandler(async (req: Request, res: Response) => {
    const impact = await getWorkflowUnpublishImpact(Number(req.params.definitionId));
    res.json({ success: true, impact });
  }, 'Failed to load unpublish impact.', { onError: handleWorkflowError });

  unpublish = asyncHandler(async (req: Request, res: Response) => {
    const { expectedDefinitionStateVersion } = req.body as { expectedDefinitionStateVersion: number };
    const record = await unpublishWorkflowDefinition(
      Number(req.params.definitionId),
      Number(expectedDefinitionStateVersion),
      req.auth?.userId ?? null,
    );
    res.json({ success: true, record });
  }, 'Failed to unpublish Workflow definition.', { onError: handleWorkflowError });

  getDeleteImpact = asyncHandler(async (req: Request, res: Response) => {
    const impact = await getWorkflowDeleteImpact(Number(req.params.definitionId));
    res.json({ success: true, impact });
  }, 'Failed to load delete impact.', { onError: handleWorkflowError });

  deleteDefinition = asyncHandler(async (req: Request, res: Response) => {
    const { expectedDefinitionStateVersion } = req.body as { expectedDefinitionStateVersion: number };
    await deleteWorkflowDefinition(Number(req.params.definitionId), Number(expectedDefinitionStateVersion));
    res.json({ success: true });
  }, 'Failed to delete Workflow definition.', { onError: handleWorkflowError });

  duplicate = asyncHandler(async (req: Request, res: Response) => {
    const { source, target } = req.body as { source: Parameters<typeof duplicateWorkflow>[0]; target: Parameters<typeof duplicateWorkflow>[1] };
    const record = await duplicateWorkflow(source, target, actorFromRequest(req));
    res.json({ success: true, record });
  }, 'Failed to duplicate workflow.', { onError: handleWorkflowError });

  /** WFV2-23 — portable JSON bundle (draft AWM + optional designer view; no secrets/runtime). */
  exportDefinition = asyncHandler(async (req: Request, res: Response) => {
    const result = await exportWorkflowDefinition(Number(req.params.definitionId));
    res.json({ success: true, bundle: result.bundle, sourceDefinitionId: result.sourceDefinitionId });
  }, 'Failed to export workflow definition.', { onError: handleWorkflowError });

  importDefinition = asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as {
      bundle?: unknown;
      scopeKey?: string;
      key?: string;
      overwrite?: boolean;
    };
    const result = await importWorkflowDefinition(body.bundle ?? req.body, {
      scopeKey: body.scopeKey,
      key: body.key,
      overwrite: body.overwrite === true,
      actor: actorFromRequest(req),
    });
    res.status(result.created ? 201 : 200).json({
      success: true,
      record: result.definition,
      created: result.created,
      overwritten: result.overwritten,
    });
  }, 'Failed to import workflow definition.', { onError: handleWorkflowError });

  getReferenceCatalog = asyncHandler(async (req: Request, res: Response) => {
    const projection = await loadWorkflowDesignerProjection(Number(req.params.definitionId));
    const context = req.body as WorkflowReferenceContext;
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const all = getAuthorizedWorkflowReferences(projection.model, context);
    const filtered = searchWorkflowReferences(all, query);
    res.json({ success: true, descriptors: filtered });
  }, 'Failed to load reference catalog.', { onError: handleWorkflowError });

  compileReference = asyncHandler(async (req: Request, res: Response) => {
    const { descriptor, segments } = req.body as { descriptor: WorkflowReferenceDescriptor; segments?: Array<string | number> };
    const path = compileWorkflowReference(descriptor, segments ?? []);
    res.json({ success: true, path });
  }, 'Failed to compile reference.', { onError: handleWorkflowError });

  runWorkflowExecute = asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as Omit<Parameters<typeof runWorkflowSimulation>[0], 'createdBy'>;
    const result = await runWorkflowSimulation({ ...body, createdBy: actorFromRequest(req) });
    res.json({ success: true, run: result.run, outcome: result.outcome, evidence: result.evidence, missingFixturePaths: result.missingFixturePaths });
  }, 'Failed to run workflow execution.', { onError: handleWorkflowError });

  /**
   * Named env-var-name registry for `secretReferenceFields` (never secret values — see
   * `workflowSecretReferenceRepository.ts`'s doc comment). Admin-only, same as every other route on
   * this router (`mountWorkflowsRoutes`'s `adminOnly` middleware wraps the whole `/api/workflows`
   * router, not re-declared per-handler here).
   */
  listSecretReferences = asyncHandler(async (_req: Request, res: Response) => {
    const references = await listWorkflowSecretReferences();
    res.json({ success: true, references });
  }, 'Failed to list secret references.', { onError: handleTransportError });

  getDynamicOptions = asyncHandler(async (req: Request, res: Response) => {
    const source = String(req.params.source ?? '');
    const options = await resolveDynamicOptions(source);
    if (options === undefined) {
      res.status(404).json({ success: false, error: `No dynamic options resolver is registered for "${source}".` });
      return;
    }
    res.json({ success: true, options });
  }, 'Failed to load dynamic options.', { onError: handleTransportError });

  /**
   * WFT-5 — resolves the writable column list for a Data API key, feeding the Designer's
   * `format:'dynamic-record-fields'` editor for `data.record-create`/`-update`/`-upsert`'s `fields`
   * input. Primary key excluded — see `workflowRecordFieldsLookup.ts` doc comment.
   */
  getRecordFieldsForEdgeApiKey = asyncHandler(async (req: Request, res: Response) => {
    const apiKey = String(req.params.apiKey ?? '');
    const fields = listWorkflowRecordFieldsForEdgeApiKey(apiKey);
    if (fields === null) {
      res.status(404).json({ success: false, error: `No Data API (or its Model) was found for key "${apiKey}".` });
      return;
    }
    res.json({ success: true, fields });
  }, 'Failed to load record fields.', { onError: handleTransportError });

  createSecretReference = asyncHandler(async (req: Request, res: Response) => {
    const { name, label, description, value } = req.body as { name: string; label: string; description?: string | null; value?: string };
    const record = await createWorkflowSecretReference({ name, label, description: description ?? null, value, createdBy: req.auth?.userId ?? null });
    res.json({ success: true, record });
  }, 'Failed to create secret reference.', { onError: handleTransportError });

  updateSecretReference = asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as { label: string; description?: string | null; value?: string | null };
    // Only forward `value` when the client actually sent the key — the repository distinguishes
    // "omitted" (leave stored value untouched) from "explicit null" (clear it).
    const record = await updateWorkflowSecretReference(Number(req.params.id), {
      label: body.label,
      description: body.description ?? null,
      updatedBy: req.auth?.userId ?? null,
      ...(Object.prototype.hasOwnProperty.call(body, 'value') ? { value: body.value } : {}),
    });
    res.json({ success: true, record });
  }, 'Failed to update secret reference.', { onError: handleTransportError });

  deleteSecretReference = asyncHandler(async (req: Request, res: Response) => {
    await deleteWorkflowSecretReference(Number(req.params.id));
    res.json({ success: true });
  }, 'Failed to delete secret reference.', { onError: handleTransportError });
}
