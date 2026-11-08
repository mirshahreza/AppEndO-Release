import { Router, type Express } from 'express';
import { createBuiltInRouteGuard } from '../middleware/builtInFunctionAccess.middleware';
import {
  createSqlConsoleCollection,
  createSqlConsoleFolder,
  createSqlConsoleScript,
  deleteSqlConsoleCollection,
  deleteSqlConsoleFolder,
  deleteSqlConsoleScript,
  getSqlConsoleFolder,
  listSqlConsoleCollections,
  listSqlConsoleFolders,
  listSqlConsoleScripts,
  updateSqlConsoleScript,
} from '../services/sql-console/sqlConsoleCollectionsStore';

export const mountSqlConsoleRoutes = (app: Express): void => {
  const routeGuard = createBuiltInRouteGuard('ADMIN');
  const router = Router();

  router.get('/collections', (_req, res) => {
    res.json({ success: true, items: listSqlConsoleCollections() });
  });

  router.post('/collections', (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }
    const name = String(req.body?.name || '').trim();
    if (!name) {
      res.status(400).json({ success: false, error: 'name is required.' });
      return;
    }
    const item = createSqlConsoleCollection({
      name,
      description: typeof req.body?.description === 'string' ? req.body.description : undefined,
      createdByUserId: userId,
    });
    res.json({ success: true, item });
  });

  router.delete('/collections/:id', (req, res) => {
    const deleted = deleteSqlConsoleCollection(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Collection not found.' });
      return;
    }
    res.json({ success: true });
  });

  router.get('/collections/:collectionId/folders', (req, res) => {
    res.json({ success: true, items: listSqlConsoleFolders(req.params.collectionId) });
  });

  router.post('/collections/:collectionId/folders', (req, res) => {
    const name = String(req.body?.name || '').trim();
    if (!name) {
      res.status(400).json({ success: false, error: 'name is required.' });
      return;
    }
    const item = createSqlConsoleFolder({
      collectionId: req.params.collectionId,
      parentFolderId: typeof req.body?.parentFolderId === 'string' ? req.body.parentFolderId : null,
      name,
    });
    if (!item) {
      res.status(404).json({ success: false, error: 'Collection not found.' });
      return;
    }
    res.json({ success: true, item });
  });

  router.delete('/folders/:id', (req, res) => {
    const existing = getSqlConsoleFolder(req.params.id);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Folder not found.' });
      return;
    }
    deleteSqlConsoleFolder(req.params.id);
    res.json({ success: true });
  });

  router.get('/collections/:collectionId/scripts', (req, res) => {
    res.json({ success: true, items: listSqlConsoleScripts(req.params.collectionId) });
  });

  router.post('/collections/:collectionId/scripts', (req, res) => {
    const name = String(req.body?.name || '').trim();
    const sql = String(req.body?.sql || '').trim();
    if (!name || !sql) {
      res.status(400).json({ success: false, error: 'name and sql are required.' });
      return;
    }
    const item = createSqlConsoleScript({
      collectionId: req.params.collectionId,
      folderId: typeof req.body?.folderId === 'string' ? req.body.folderId : null,
      name,
      sql,
      dataSourceId: String(req.body?.dataSourceId || '').trim(),
    });
    if (!item) {
      res.status(404).json({ success: false, error: 'Collection not found.' });
      return;
    }
    res.json({ success: true, item });
  });

  router.get('/scripts', (_req, res) => {
    res.json({ success: true, items: listSqlConsoleScripts(null) });
  });

  router.post('/scripts', (req, res) => {
    const name = String(req.body?.name || '').trim();
    const sql = String(req.body?.sql || '').trim();
    if (!name || !sql) {
      res.status(400).json({ success: false, error: 'name and sql are required.' });
      return;
    }
    const collectionId = typeof req.body?.collectionId === 'string' ? req.body.collectionId.trim() : '';
    const item = createSqlConsoleScript({
      collectionId: collectionId || null,
      folderId: typeof req.body?.folderId === 'string' ? req.body.folderId : null,
      name,
      sql,
      dataSourceId: String(req.body?.dataSourceId || '').trim(),
    });
    if (!item) {
      res.status(404).json({ success: false, error: 'Collection not found.' });
      return;
    }
    res.json({ success: true, item });
  });

  router.patch('/scripts/:id', (req, res) => {
    const patch = req.body || {};
    const item = updateSqlConsoleScript(req.params.id, {
      ...(patch.name !== undefined ? { name: String(patch.name).trim() } : {}),
      ...(patch.folderId !== undefined ? { folderId: patch.folderId } : {}),
      ...(patch.sql !== undefined ? { sql: String(patch.sql) } : {}),
      ...(patch.dataSourceId !== undefined ? { dataSourceId: String(patch.dataSourceId).trim() } : {}),
    });
    if (!item) {
      res.status(404).json({ success: false, error: 'Script not found.' });
      return;
    }
    res.json({ success: true, item });
  });

  router.delete('/scripts/:id', (req, res) => {
    const deleted = deleteSqlConsoleScript(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Script not found.' });
      return;
    }
    res.json({ success: true });
  });

  app.use('/api/sql-console', routeGuard, router);
};
