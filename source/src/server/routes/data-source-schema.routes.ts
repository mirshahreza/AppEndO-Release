import { Router } from 'express';
import type { DataSourcesController } from '../controllers/data-sources.controller';

export const createDataSourceSchemaRouter = (controller: DataSourcesController): Router => {
  const router = Router();

  router.get('/catalog', controller.listSchemaCatalog);
  router.get('/objects/delete-preview', controller.getSchemaObjectDeletePreview);
  router.get('/objects/definition', controller.getSchemaObjectDefinition);
  router.get('/objects/dependencies', controller.getSchemaObjectDependencies);
  router.get('/objects', controller.listSchemaObjects);
  router.post('/objects', controller.createSchemaObject);
  router.put('/objects/definition', controller.updateSchemaObjectDefinition);
  router.post('/query/execute', controller.executeDataSourceQuery);
  router.delete('/objects', controller.deleteSchemaObject);
  router.post('/objects/truncate', controller.truncateSchemaObject);
  router.get('/fields', controller.listObjectFields);
  router.get('/relations', controller.listObjectRelations);
  router.post('/foreign-keys', controller.addForeignKeyConstraint);
  router.delete('/foreign-keys', controller.dropForeignKeyConstraint);

  return router;
};
