import type { Request, Response } from 'express';
import type { SshHubConnectionWritePayload } from '../../shared/api/contracts/ssh-hub/types';
import { asyncHandler } from '../utils/asyncHandler';
import {
  createSshHubConnection,
  deleteSshHubConnection,
  getSshHubConnection,
  listSshHubConnections,
  SshHubStoreError,
  updateSshHubConnection,
} from '../services/ssh-hub/sshHubStore';

const actorFromRequest = (req: Request): string => req.auth?.email?.trim() || 'unknown';

const handleStoreError = (error: unknown, res: Response): boolean => {
  if (error instanceof SshHubStoreError) {
    res.status(error.status).json({ success: false, error: error.message });
    return true;
  }
  return false;
};

export class SshHubController {
  list = asyncHandler(async (_req: Request, res: Response) => {
    const items = listSshHubConnections().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    res.json({ success: true, items, totalCount: items.length });
  }, 'Failed to list SSH connections.');

  getOne = asyncHandler(async (req: Request, res: Response) => {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    const item = getSshHubConnection(id);
    if (!item) {
      res.status(404).json({ success: false, error: 'SSH connection was not found.' });
      return;
    }
    res.json({ success: true, item });
  }, 'Failed to read SSH connection.');

  create = asyncHandler(async (req: Request, res: Response) => {
    try {
      const item = await createSshHubConnection((req.body || {}) as SshHubConnectionWritePayload, actorFromRequest(req));
      res.status(201).json({ success: true, item });
    } catch (error) {
      if (handleStoreError(error, res)) {
        return;
      }
      throw error;
    }
  }, 'Failed to create SSH connection.');

  update = asyncHandler(async (req: Request, res: Response) => {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    try {
      const item = await updateSshHubConnection(id, (req.body || {}) as SshHubConnectionWritePayload, actorFromRequest(req));
      res.json({ success: true, item });
    } catch (error) {
      if (handleStoreError(error, res)) {
        return;
      }
      throw error;
    }
  }, 'Failed to update SSH connection.');

  remove = asyncHandler(async (req: Request, res: Response) => {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    const deleted = await deleteSshHubConnection(id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'SSH connection was not found.' });
      return;
    }
    res.json({ success: true });
  }, 'Failed to delete SSH connection.');
}
