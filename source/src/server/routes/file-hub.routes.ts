import type { Request } from 'express';
import { Router, type Express } from 'express';
import multer from 'multer';
import { FileHubController, handleKnownError, userIdFromRequest } from '../controllers/file-hub.controller';
import { requireRole } from '../middleware/auth.middleware';
import { requireRemoteHubsPackage } from '../services/remote-hubs/remoteHubsRuntime';
import { buildUploadPath, pipeUploadToRemote } from '../services/file-hub/fileHubFiles';
import { asyncHandler } from '../utils/asyncHandler';

const MAX_UPLOAD_FILES = 32;

function readQueryValue(req: Request, key: string): string {
  const value = req.query[key];
  return typeof value === 'string' ? value.trim() : '';
}

function uploadFileName(originalName: string): string {
  const normalized = originalName.replace(/\\/g, '/');
  return normalized.split('/').pop()?.trim() || 'upload';
}

const streamingStorage: multer.StorageEngine = {
  _handleFile(req, file, callback) {
    const connectionId = readQueryValue(req, 'connectionId');
    const remoteDir = readQueryValue(req, 'remotePath') || '/';
    if (!connectionId) {
      callback(new Error('connectionId is required.'));
      return;
    }
    try {
      const destPath = buildUploadPath(remoteDir, uploadFileName(file.originalname));
      pipeUploadToRemote(userIdFromRequest(req), connectionId, destPath, file.stream)
        .then(() => callback(null, { path: destPath }))
        .catch((error) => callback(error instanceof Error ? error : new Error('Upload failed.')));
    } catch (error) {
      callback(error instanceof Error ? error : new Error('Upload failed.'));
    }
  },
  _removeFile(_req, _file, callback) {
    callback(null);
  },
};

const upload = multer({
  storage: streamingStorage,
  limits: {
    files: MAX_UPLOAD_FILES,
  },
});

export const mountFileHubRoutes = (app: Express): void => {
  const controller = new FileHubController();
  const router = Router();
  const adminOnly = requireRole('ADMIN');

  router.get('/connections', controller.listConnections);
  router.get('/connections/:id', controller.getConnection);
  router.post('/connections', controller.createConnection);
  router.put('/connections/:id', controller.updateConnection);
  router.delete('/connections/:id', controller.removeConnection);

  router.post('/files/list', controller.listFiles);
  router.post('/files/mkdir', controller.mkdir);
  router.post('/files/rename', controller.rename);
  router.post('/files/delete', controller.removeFile);
  router.get('/files/download', controller.download);
  router.post(
    '/files/upload',
    upload.array('files', MAX_UPLOAD_FILES),
    asyncHandler((req, res) => {
      const files = Array.isArray(req.files) ? req.files : [];
      if (files.length === 0) {
        res.status(400).json({ success: false, error: 'At least one file is required.' });
        return;
      }
      res.json({
        success: true,
        items: files.map((file) => ({
          name: uploadFileName(file.originalname),
          path: typeof file.path === 'string' ? file.path : '',
        })),
      });
    }, 'Failed to upload remote files.', {
      onError: (error, _req, res) => handleKnownError(error, res),
    }),
  );

  app.use('/api/file-hub', requireRemoteHubsPackage, adminOnly, router);
};
