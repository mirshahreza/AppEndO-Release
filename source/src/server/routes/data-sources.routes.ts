import { Router, type Express } from 'express';
import { DataSourcesController } from '../controllers/data-sources.controller';
import { requireRole } from '../middleware/auth.middleware';
import type { DataSourcesServiceDeps } from '../services/data-sources.service';
import { DataSourcesService } from '../services/data-sources.service';

export const mountDataSourcesRoutes = (app: Express, deps: DataSourcesServiceDeps): void => {
  const service = new DataSourcesService(deps);
  const controller = new DataSourcesController(service);
  const adminOnly = requireRole('ADMIN');
  const router = Router();

  router.get('/', controller.list);
  router.get('/schema-catalog', controller.listSchemaCatalog);
  router.get('/objects/delete-preview', controller.getSchemaObjectDeletePreview);
  router.get('/objects/definition', controller.getSchemaObjectDefinition);
  router.get('/objects/dependencies', controller.getSchemaObjectDependencies);
  router.get('/objects', controller.listSchemaObjects);
  router.get('/fields', controller.listObjectFields);
  router.get('/relations', controller.listObjectRelations);
  router.post('/foreign-keys', controller.addForeignKeyConstraint);
  router.delete('/foreign-keys', controller.dropForeignKeyConstraint);
  router.post('/objects', controller.createSchemaObject);
  router.put('/objects/definition', controller.updateSchemaObjectDefinition);
  router.post('/query/execute', controller.executeDataSourceQuery);
  router.delete('/objects', controller.deleteSchemaObject);
  router.post('/objects/truncate', controller.truncateSchemaObject);
  router.post('/', controller.create);
  router.post('/test-draft', controller.testDraft);
  router.post('/test-all', controller.testAll);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.remove);
  router.post('/:id/test', controller.testById);

  app.use('/api/data-sources', adminOnly, router);
};
