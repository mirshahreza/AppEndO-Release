import { Router, type Express } from 'express';
import { WorkflowsController } from '../controllers/workflows.controller';
import { requireRole } from '../middleware/auth.middleware';

/**
 * Workflows transport — see `docs/architecture/workflow-designer-frontend-wiring.md`.
 * Admin-only, matching `component-designer.routes.ts`'s convention for authoring surfaces.
 */
export const mountWorkflowsRoutes = (app: Express): void => {
  const controller = new WorkflowsController();
  const adminOnly = requireRole('ADMIN');
  const router = Router();

  router.get('/definitions', controller.listDefinitions);
  router.post('/definitions', controller.createDefinition);
  router.get('/definitions/:definitionId/projection', controller.getProjection);
  router.get('/definitions/:definitionId/dossier', controller.getDossier);
  router.post('/definitions/:definitionId/draft-operations', controller.applyDraftOperations);
  router.put('/definitions/:definitionId/designer-view', controller.saveDesignerView);
  router.post('/definitions/:definitionId/validate', controller.validateDraft);
  router.get('/definitions/:definitionId/publish-diff', controller.getPublishDiff);
  router.post('/definitions/:definitionId/publish', controller.publish);
  router.get('/definitions/:definitionId/unpublish-impact', controller.getUnpublishImpact);
  router.post('/definitions/:definitionId/unpublish', controller.unpublish);
  router.get('/definitions/:definitionId/delete-impact', controller.getDeleteImpact);
  router.post('/definitions/:definitionId/delete', controller.deleteDefinition);
  router.get('/definitions/:definitionId/revisions', controller.listRevisions);
  router.get('/revisions/:revisionId', controller.getRevision);
  router.post('/revisions/:revisionId/retry-binding-activation', controller.retryBindingActivation);
  router.post('/revisions/:revisionId/reconcile-binding', controller.reconcileBinding);
  router.post('/revisions/migrate-instances/impact', controller.getInstanceMigrationImpact);
  router.post('/revisions/migrate-instances', controller.migrateInstances);
  router.post('/definitions/:definitionId/disable', controller.disableDefinition);
  router.post('/definitions/:definitionId/archive', controller.archiveDefinition);
  router.post('/definitions/:definitionId/re-enable', controller.reEnableDefinition);
  router.post('/definitions/:definitionId/reference-catalog', controller.getReferenceCatalog);
  router.post('/duplicate', controller.duplicate);
  router.post('/definitions/:definitionId/export', controller.exportDefinition);
  router.post('/import', controller.importDefinition);
  router.post('/reference-catalog/compile', controller.compileReference);
  router.post('/execute/run', controller.runWorkflowExecute);
  router.post('/simulation/run', controller.runWorkflowExecute);
  router.get('/dynamic-options/:source', controller.getDynamicOptions);
  router.get('/edge-apis/:apiKey/record-fields', controller.getRecordFieldsForEdgeApiKey);
  router.get('/secret-references', controller.listSecretReferences);
  router.post('/secret-references', controller.createSecretReference);
  router.put('/secret-references/:id', controller.updateSecretReference);
  router.post('/secret-references/:id/delete', controller.deleteSecretReference);

  app.use('/api/workflows', adminOnly, router);
};
