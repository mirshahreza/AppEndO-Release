import { Router, type Express, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { ComponentDesignerController } from '../controllers/component-designer.controller';
import { canAccessAnyBuilderFolder } from '../domain/component-designer/builderFolderPermissions';
import { hasAdminRole, normalizeAuthRoles } from '../middleware/auth.middleware';
import { ComponentDesignerService, type ComponentDesignerServiceDeps } from '../services/component-designer.service';

const connectorFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    if (
      !name.endsWith('.json')
      && !name.endsWith('.csv')
      && !name.endsWith('.xlsx')
      && !name.endsWith('.xls')
    ) {
      cb(new Error('Only .json, .csv, and .xlsx files are accepted.'));
      return;
    }
    cb(null, true);
  },
});

const tabularImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    if (
      !name.endsWith('.json')
      && !name.endsWith('.csv')
      && !name.endsWith('.xlsx')
      && !name.endsWith('.xls')
    ) {
      cb(new Error('Only .csv, .xlsx, and .json files are accepted.'));
      return;
    }
    cb(null, true);
  },
});

/**
 * Builder studio gate (Phase 54): ADMIN always; otherwise any role granted via
 * folderPermissions / defaultRoles. Distinct from designerPageAccess (consumer page RBAC).
 */
const requireBuilderStudioAccess = (req: Request, res: Response, next: NextFunction) => {
  const roles = normalizeAuthRoles(req);
  if (roles.length === 0) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }
  if (hasAdminRole(req) || canAccessAnyBuilderFolder(roles)) {
    next();
    return;
  }
  res.status(403).json({ success: false, error: 'Forbidden.' });
};

export const mountComponentDesignerRoutes = (app: Express, deps: ComponentDesignerServiceDeps): void => {
  const service = new ComponentDesignerService(deps);
  const controller = new ComponentDesignerController(service);
  const router = Router();

  router.get('/drafts', controller.listDrafts);
  router.post('/drafts', controller.createDraft);
  router.get('/drafts/by-path', controller.getDraftByPath);
  router.get('/drafts/:id/versions', controller.listVersions);
  router.get('/drafts/:id/publish-state', controller.getPublishState);
  router.get('/drafts/:id/publish-diff', controller.getPublishDiff);
  router.get('/drafts/:id/usage', controller.getUsage);
  router.post('/drafts/:id/publish', controller.publishDraft);
  router.post('/drafts/:id/rollback', controller.rollbackDraft);
  router.post('/drafts/:id/staging-preview', controller.createStagingPreview);
  router.get('/drafts/:id/comments', controller.listDraftComments);
  router.post('/drafts/:id/comments', controller.addDraftComment);
  router.post('/drafts/:id/comments/:commentId/resolve', controller.resolveDraftComment);
  router.get('/drafts/:id/audit-log', controller.listDraftAuditLog);
  router.get('/drafts/:id', controller.getDraft);
  router.put('/drafts/:id', controller.updateDraft);
  router.delete('/drafts/:id', controller.deleteDraft);
  router.post('/preview/runtime', controller.previewRuntime);
  router.post('/validate', controller.validate);
  router.get('/catalog/system-components', controller.systemCatalog);
  router.get('/catalog/reusable-components', controller.reusableCatalog);
  router.get('/catalog/unused-components', controller.listUnusedComponents);
  router.post('/sync/code-to-canvas', controller.syncCodeToCanvas);
  router.post('/shells/duplicate', controller.duplicateShellLayout);

  router.get('/folder-permissions', controller.getFolderPermissions);
  router.put('/folder-permissions', controller.updateFolderPermissions);

  router.get('/connectors', controller.listDataConnectors);
  router.post('/connectors', controller.createDataConnector);
  router.put('/connectors/:id', controller.updateDataConnector);
  router.delete('/connectors/:id', controller.deleteDataConnector);
  router.get('/connectors/:id/query', controller.queryDataConnector);
  router.post('/connectors/:id/query', controller.queryDataConnector);
  router.post(
    '/connectors/:id/upload-file',
    connectorFileUpload.single('file'),
    controller.uploadDataConnectorFile,
  );
  router.post(
    '/import-tabular',
    tabularImportUpload.single('file'),
    controller.importTabularFile,
  );
  router.post('/export', controller.exportDesignerData);

  app.get('/api/component-designer/preview/staging/:token', controller.getStagingPreview);
  app.use('/api/component-designer', requireBuilderStudioAccess, router);
};
