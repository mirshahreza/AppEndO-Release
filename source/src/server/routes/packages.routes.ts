import multer from 'multer';
import { Router, type Express } from 'express';
import { PackagesController } from '../controllers/packages.controller';
import { requireRole } from '../middleware/auth.middleware';
import { PackagesService, type PackagesServiceDeps } from '../services/packages.service';
import { PACKAGE_ARTIFACT_MAX_BYTES } from '../../core/packages/packageArtifactLimits';
import { isAnonymousCmsPublicSiteUiModule } from '../../core/packages/cmsPublicSitePack';
import { readPackageUiModuleKeyFromParams } from '../../shared/api/contracts/package-manifest/extensionUiRoutes';
import { isCmsRuntimeEnabled } from '../services/cms-site/cmsSiteRuntime';

const packageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PACKAGE_ARTIFACT_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith('.zip')) {
      cb(new Error('Only .zip files are accepted.'));
      return;
    }
    cb(null, true);
  },
});

const workspaceAssetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const mountPackagesRoutes = (app: Express, deps: PackagesServiceDeps): void => {
  const service = new PackagesService(deps);
  const controller = new PackagesController(service);
  const adminOnly = requireRole('ADMIN');

  const publicRouter = Router();
  publicRouter.get('/:id/assets/:assetKey', controller.serveStaticAsset);
  publicRouter.get('/:id/ui/*', (req, res, next) => {
    const packageId = String(req.params.id || '');
    const componentKey = readPackageUiModuleKeyFromParams(req.params);
    if (!isCmsRuntimeEnabled() || !isAnonymousCmsPublicSiteUiModule(packageId, componentKey)) {
      next('router');
      return;
    }
    void controller.serveUiModule(req, res);
  });
  app.use('/api/packages', publicRouter);

  const router = Router();

  router.get('/feature-flags', controller.featureFlags);
  router.get('/builder/catalog', controller.builderCatalog);
  router.get('/builder/workspace-assets', controller.listWorkspaceAssets);
  router.get('/builder/workspace-assets/content', controller.readWorkspaceAsset);
  router.get('/builder/platform-fonts/content', controller.readPlatformFontAsset);
  router.post('/builder/workspace-assets/upload', workspaceAssetUpload.single('file'), controller.uploadWorkspaceAsset);
  router.delete('/builder/workspace-assets', controller.deleteWorkspaceAsset);
  router.get('/builder/sql-files', controller.listCapturableSqlFiles);
  router.get('/builder/sql-files/content', controller.readCapturableSqlFile);
  router.post('/builder/db-capture/seed', controller.captureSeedInserts);
  router.post('/builder/db-capture/cms-module', controller.captureCmsModule);
  router.post('/builder/edge-data-export', controller.edgeDataExport);
  router.post('/builder/workflow-export', controller.workflowExport);
  router.post('/upload', packageUpload.single('file'), controller.upload);
  router.get('/dependency-graph', controller.dependencyGraph);
  router.get('/', controller.list);
  router.get('/:id/download', controller.download);
  router.get('/:id/deployment/preview', controller.deploymentPreview);
  router.post('/:id/deployment/apply', controller.applyDeployment);
  router.get('/:id/ui/*', controller.serveUiModule);
  router.get('/:id', controller.detail);
  router.delete('/:id', controller.remove);
  router.post('/:id/install', controller.install);
  router.post('/:id/uninstall', controller.uninstall);
  router.post('/:id/reinstall', controller.reinstall);
  router.get('/:id/repack/drift', controller.repackDrift);
  router.get('/:id/repack/diff', controller.repackDiff);
  router.post('/:id/repack/revert', controller.repackRevert);
  router.post('/:id/repack', controller.repack);
  router.post('/:id/enable', controller.enable);
  router.post('/:id/disable', controller.disable);

  // Mock API Connectors Routes
  const mockConnections = new Map<string, { familyId: string; status: string }>();

  router.get('/api-connectors/connections', (req, res) => {
    res.json({ connections: Array.from(mockConnections.values()) });
  });

  router.post('/api-connectors/connections/:familyId/connect', (req, res) => {
    const { familyId } = req.params;
    mockConnections.set(familyId, { familyId, status: 'active' });
    res.json({ success: true, connection: { familyId, status: 'active' } });
  });

  router.delete('/api-connectors/connections/:familyId', (req, res) => {
    const { familyId } = req.params;
    mockConnections.delete(familyId);
    res.json({ success: true });
  });

  router.all('/api-connectors/proxy/:familyId/*', (req, res) => {
    const { familyId } = req.params;
    const connection = mockConnections.get(familyId);
    if (!connection || connection.status !== 'active') {
      res.status(401).json({ error: 'Connection Required', message: `No active connection for provider family ${familyId}.` });
      return;
    }

    // Return mock data for preview fetches
    const path = req.path.toLowerCase();
    if (path.includes('product') || path.includes('item') || path.includes('inventory')) {
      res.json([
        { id: 1001, name: 'External API Coffee Beans', price: 18.50, stock: 45 },
        { id: 1002, name: 'External API Green Tea', price: 12.00, stock: 60 }
      ]);
    } else {
      res.json({
        success: true,
        source: 'External API Proxy',
        familyId,
        data: [
          { id: 1, title: 'External Item 1' },
          { id: 2, title: 'External Item 2' }
        ]
      });
    }
  });

  app.use('/api/packages', adminOnly, router);
};
