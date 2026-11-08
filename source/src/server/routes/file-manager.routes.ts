import { Router, type Express } from 'express';
import multer from 'multer';
import { FileManagerController } from '../controllers/file-manager.controller';
import { createBuiltInRouteGuard } from '../middleware/builtInFunctionAccess.middleware';
import { FILE_MANAGER_UPLOAD_MAX_BYTES, FILE_MANAGER_UPLOAD_MAX_FILES } from '../domain/file-manager/pathScope';
import { FileManagerService } from '../services/file-manager.service';

const fileManagerUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: FILE_MANAGER_UPLOAD_MAX_BYTES,
    files: FILE_MANAGER_UPLOAD_MAX_FILES,
  },
});

export const mountFileManagerRoutes = (app: Express): void => {
  const service = new FileManagerService();
  const controller = new FileManagerController(service);
  const routeGuard = createBuiltInRouteGuard('ADMIN');
  const router = Router();

  router.get('/config', controller.getConfig);
  router.get('/entries', controller.listChildren);
  router.get('/content', controller.readContent);
  router.get('/raw', controller.readRaw);
  router.put('/content', controller.writeContent);
  router.post('/image/content', controller.replaceImageContent);
  router.put('/image/content', controller.replaceImageContent);
  router.post('/image', fileManagerUpload.single('file'), controller.replaceImage);
  router.post('/folder', controller.createFolder);
  router.post('/file', controller.createFile);
  router.put('/rename', controller.renameEntry);
  router.put('/move', controller.moveEntry);
  router.delete('/entry', controller.deleteEntry);
  router.post('/empty', controller.emptyFolder);
  router.post('/extract', controller.extractZip);
  router.post('/upload', fileManagerUpload.array('files', FILE_MANAGER_UPLOAD_MAX_FILES), controller.uploadFiles);

  router.get('/zip/entries', controller.listZipEntries);
  router.get('/zip/content', controller.readZipEntryContent);
  router.put('/zip/content', controller.writeZipEntryContent);
  router.delete('/zip/entry', controller.deleteZipEntry);
  router.put('/zip/move', controller.moveZipEntry);
  router.put('/zip/rename', controller.renameZipEntry);
  router.post('/zip/folder', controller.createZipFolder);
  router.post('/zip/file', controller.createZipFile);
  router.post('/zip/import', controller.importZipEntry);
  router.post('/zip/upload', fileManagerUpload.array('files', FILE_MANAGER_UPLOAD_MAX_FILES), controller.uploadZipEntries);

  app.use('/api/file-manager', routeGuard, router);
};
