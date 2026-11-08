import type { Request, Response } from 'express';
import type { FileHubConnectionWritePayload } from '../../shared/api/contracts/file-hub/types';
import { basenameRemotePath, parseFileHubEntryType } from '../../shared/api/contracts/file-hub/validation';
import { asyncHandler } from '../utils/asyncHandler';
import {
  createFileHubConnection,
  deleteFileHubConnection,
  FileHubStoreError,
  getFileHubConnection,
  listFileHubConnections,
  updateFileHubConnection,
} from '../services/file-hub/fileHubStore';
import {
  deleteFileHubPath,
  FileHubSessionError,
  listFileHubPath,
  mkdirFileHubPath,
  pipeDownloadFromRemote,
  renameFileHubPath,
} from '../services/file-hub/fileHubFiles';

const actorFromRequest = (req: Request): string => req.auth?.email?.trim() || 'unknown';
const userIdFromRequest = (req: Request): number => req.auth?.userId ?? 0;

const readConnectionId = (req: Request): string => {
  const fromBody = typeof req.body?.connectionId === 'string' ? req.body.connectionId : '';
  const fromQuery = typeof req.query.connectionId === 'string' ? req.query.connectionId : '';
  return (fromBody || fromQuery).trim();
};

const handleKnownError = (error: unknown, res: Response): boolean => {
  if (res.headersSent) {
    return true;
  }
  if (error instanceof FileHubStoreError || error instanceof FileHubSessionError) {
    res.status(error.status).json({ success: false, error: error.message });
    return true;
  }
  return false;
};

export class FileHubController {
  listConnections = asyncHandler(async (_req: Request, res: Response) => {
    const items = listFileHubConnections().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    res.json({ success: true, items, totalCount: items.length });
  }, 'Failed to list File Hub connections.');

  getConnection = asyncHandler(async (req: Request, res: Response) => {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    const item = getFileHubConnection(id);
    if (!item) {
      res.status(404).json({ success: false, error: 'File Hub connection was not found.' });
      return;
    }
    res.json({ success: true, item });
  }, 'Failed to read File Hub connection.');

  createConnection = asyncHandler(async (req: Request, res: Response) => {
    try {
      const item = await createFileHubConnection((req.body || {}) as FileHubConnectionWritePayload, actorFromRequest(req));
      res.status(201).json({ success: true, item });
    } catch (error) {
      if (handleKnownError(error, res)) {
        return;
      }
      throw error;
    }
  }, 'Failed to create File Hub connection.');

  updateConnection = asyncHandler(async (req: Request, res: Response) => {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    try {
      const item = await updateFileHubConnection(id, (req.body || {}) as FileHubConnectionWritePayload, actorFromRequest(req));
      res.json({ success: true, item });
    } catch (error) {
      if (handleKnownError(error, res)) {
        return;
      }
      throw error;
    }
  }, 'Failed to update File Hub connection.');

  removeConnection = asyncHandler(async (req: Request, res: Response) => {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    const deleted = await deleteFileHubConnection(id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'File Hub connection was not found.' });
      return;
    }
    res.json({ success: true });
  }, 'Failed to delete File Hub connection.');

  listFiles = asyncHandler(async (req: Request, res: Response) => {
    const connectionId = readConnectionId(req);
    if (!connectionId) {
      res.status(400).json({ success: false, error: 'connectionId is required.' });
      return;
    }
    try {
      const result = await listFileHubPath(userIdFromRequest(req), connectionId, req.body?.remotePath);
      res.json({ success: true, path: result.path, items: result.items });
    } catch (error) {
      if (handleKnownError(error, res)) {
        return;
      }
      throw error;
    }
  }, 'Failed to list remote files.');

  mkdir = asyncHandler(async (req: Request, res: Response) => {
    const connectionId = readConnectionId(req);
    if (!connectionId) {
      res.status(400).json({ success: false, error: 'connectionId is required.' });
      return;
    }
    try {
      const path = await mkdirFileHubPath(userIdFromRequest(req), connectionId, req.body?.remotePath);
      res.json({ success: true, path });
    } catch (error) {
      if (handleKnownError(error, res)) {
        return;
      }
      throw error;
    }
  }, 'Failed to create remote directory.');

  rename = asyncHandler(async (req: Request, res: Response) => {
    const connectionId = readConnectionId(req);
    if (!connectionId) {
      res.status(400).json({ success: false, error: 'connectionId is required.' });
      return;
    }
    try {
      const result = await renameFileHubPath(
        userIdFromRequest(req),
        connectionId,
        req.body?.oldPath,
        req.body?.newPath,
      );
      res.json({ success: true, ...result });
    } catch (error) {
      if (handleKnownError(error, res)) {
        return;
      }
      throw error;
    }
  }, 'Failed to rename remote path.');

  removeFile = asyncHandler(async (req: Request, res: Response) => {
    const connectionId = readConnectionId(req);
    if (!connectionId) {
      res.status(400).json({ success: false, error: 'connectionId is required.' });
      return;
    }
    const type = parseFileHubEntryType(req.body?.type);
    if (!type) {
      res.status(400).json({ success: false, error: 'type must be file or directory.' });
      return;
    }
    try {
      const path = await deleteFileHubPath(userIdFromRequest(req), connectionId, req.body?.remotePath, type);
      res.json({ success: true, path });
    } catch (error) {
      if (handleKnownError(error, res)) {
        return;
      }
      throw error;
    }
  }, 'Failed to delete remote path.');

  download = asyncHandler(async (req: Request, res: Response) => {
    const connectionId = readConnectionId(req);
    const remotePath = typeof req.query.remotePath === 'string' ? req.query.remotePath : '';
    if (!connectionId) {
      res.status(400).json({ success: false, error: 'connectionId is required.' });
      return;
    }
    try {
      await pipeDownloadFromRemote(
        userIdFromRequest(req),
        connectionId,
        remotePath,
        res,
        ({ path, size }) => {
          const fileName = basenameRemotePath(path) || 'download';
          const asciiName = fileName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
          res.setHeader('Content-Type', 'application/octet-stream');
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
          );
          if (size != null) {
            res.setHeader('Content-Length', String(size));
          }
        },
      );
    } catch (error) {
      if (handleKnownError(error, res)) {
        return;
      }
      throw error;
    }
  }, 'Failed to download remote file.');
}

export { handleKnownError, userIdFromRequest };
