import { Router, type Express } from 'express';
import { DataSourcesController } from '../controllers/data-sources.controller';
import { FunctionsController } from '../controllers/functions.controller';
import { ServerFunctionController } from '../controllers/server-function.controller';
import { requireRole } from '../middleware/auth.middleware';
import type { EdgeDbQueryFn } from '../services/server-function.service';
import { ServerFunctionService } from '../services/server-function.service';
import { FunctionsService } from '../services/functions.service';
import { DataSourcesService } from '../services/data-sources.service';
import { createDataSourceSchemaRouter } from './data-source-schema.routes';
import { getDataSourcesFromSettings } from '../db/dataSourcesStore';
import type { FunctionsServiceDeps } from '../services/functions.service';

export type ServerFunctionRoutesDeps = FunctionsServiceDeps & {
  edgeDbQuery: EdgeDbQueryFn;
  settingsPath: string;
};

export const mountServerFunctionRoutes = (app: Express, deps: ServerFunctionRoutesDeps): void => {
  const service = new ServerFunctionService({
    getDataSources: () => getDataSourcesFromSettings(deps.settingsPath),
  });
  const controller = new ServerFunctionController(service, deps.edgeDbQuery);
  const functionsService = new FunctionsService(deps);
  const functionsController = new FunctionsController(functionsService, deps);
  const dataSourcesService = new DataSourcesService({
    settingsPath: deps.settingsPath,
    edgeDbQuery: deps.edgeDbQuery,
  });
  const dataSourcesController = new DataSourcesController(dataSourcesService);
  const adminOnly = requireRole('ADMIN');
  const router = Router();

  router.post('/execute', controller.execute);
  router.get('/catalog/unused', functionsController.listUnused);

  app.use('/api/core/server-functions', adminOnly, router);
  app.use('/api/data-sources/schema', adminOnly, createDataSourceSchemaRouter(dataSourcesController));
};
