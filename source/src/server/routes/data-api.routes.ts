import { Router, type Express } from 'express';
import { requireRole } from '../middleware/auth.middleware';
import type { EdgeDbQueryFn } from '../services/server-function.service';
import { DataApiController } from '../controllers/data-api.controller';
import { EdgeModelService } from '../services/data-api/edgeModelService';
import { EdgeApiService } from '../services/data-api/edgeApiService';
import { DataApiExecutor } from '../services/data-api/dataApiExecutor';
import { EdgeModelDatasheetService } from '../services/data-api/edgeModelDatasheet.service';
import { getDataSourcesFromSettings } from '../db/dataSourcesStore';
import { ensureEdgeApiStoreDirs } from '../services/data-api/edgeApiStore';
import { ensureEdgeModelStoreDirs } from '../services/data-api/edgeModelStore';
import { ensureEdgeModelStudioMetaStoreDirs } from '../services/data-api/edgeModelStudioMetaStore';
import { reconcileDeletedEdgeCapabilities } from '../services/data-api/edgeCapabilityDeleteCleanup';

export type DataApiRoutesDeps = {
  settingsPath: string;
  edgeDbQuery: EdgeDbQueryFn;
};

export const mountDataApiRoutes = (app: Express, deps: DataApiRoutesDeps): void => {
  ensureEdgeModelStoreDirs();
  ensureEdgeApiStoreDirs();
  ensureEdgeModelStudioMetaStoreDirs();
  reconcileDeletedEdgeCapabilities();

  const getDataSources = () => getDataSourcesFromSettings(deps.settingsPath);
  const edgeModelService = new EdgeModelService({
    settingsPath: deps.settingsPath,
    edgeDbQuery: deps.edgeDbQuery,
    getDataSources,
  });
  const edgeApiService = new EdgeApiService(new DataApiExecutor({ getDataSources }));
  const datasheetService = new EdgeModelDatasheetService(getDataSources);
  const controller = new DataApiController(edgeModelService, edgeApiService, datasheetService);
  const adminOnly = requireRole('ADMIN');
  const router = Router();

  router.get('/models', controller.listModels);
  router.post('/models/import', controller.importModel);
  // Specific suffixes before `/models/:id` so they never compete with the bare id route.
  router.get('/models/:id/studio-meta', controller.getModelStudioMeta);
  router.put('/models/:id/studio-meta', controller.upsertModelStudioMeta);
  router.patch('/models/:id/studio-meta', controller.upsertModelStudioMeta);
  router.get('/resolve-edge-model', controller.resolveEdgeModelForListEndpoint);
  router.get('/models/:id/query-surfaces/runtime', controller.getModelQuerySurfaceRuntime);
  router.get('/models/:id/query-surface-binding', controller.getModelQuerySurfaceBinding);
  router.put('/models/:id/query-surface-binding', adminOnly, controller.saveModelQuerySurfaceBinding);
  router.post('/models/:id/refresh', controller.refreshModel);
  router.post('/models/:id/datasheet/query', controller.queryDatasheet);
  router.get('/models/:id/datasheet', controller.queryDatasheet);
  router.post('/models/:id/datasheet/row/delete', controller.deleteDatasheetRow);
  router.post('/models/:id/datasheet/row', controller.commitDatasheetRow);
  router.get('/models/:id', controller.getModel);
  router.patch('/models/:id', controller.patchModel);
  router.delete('/models/:id', controller.deleteModel);
  router.get('/explorer/catalog', controller.explorerCatalog);

  router.get('/definitions', controller.listDefinitions);
  router.post('/definitions', controller.createDefinition);
  router.get('/definitions/:id', controller.getDefinition);
  router.patch('/definitions/:id', controller.patchDefinition);
  router.post('/definitions/:id/publish', controller.publishDefinition);
  router.post('/definitions/:id/unpublish', controller.unpublishDefinition);
  router.post('/definitions/:id/try', controller.tryDefinition);
  router.post('/definitions/:id/export', controller.exportDefinition);
  router.delete('/definitions/:id', controller.deleteDefinition);

  app.use('/api/data-api', adminOnly, router);
};
