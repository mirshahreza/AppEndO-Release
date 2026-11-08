import type { Request, Response } from 'express';
import type { RdpHubConnectionWritePayload, RdpHubSessionTicketPayload } from '../../shared/api/contracts/rdp-hub/types';
import { asyncHandler } from '../utils/asyncHandler';
import { probeGuacd, resolveGuacdOptions } from '../services/rdp-hub/rdpHubSession';
import { createRdpHubSessionTicket } from '../services/rdp-hub/rdpHubToken';
import {
  createRdpHubConnection,
  deleteRdpHubConnection,
  getRdpHubConnection,
  listRdpHubConnections,
  RdpHubStoreError,
  updateRdpHubConnection,
} from '../services/rdp-hub/rdpHubStore';

const actorFromRequest = (req: Request): string => req.auth?.email?.trim() || 'unknown';

const handleStoreError = (error: unknown, res: Response): boolean => {
  if (error instanceof RdpHubStoreError) {
    res.status(error.status).json({ success: false, error: error.message });
    return true;
  }
  return false;
};

export class RdpHubController {
  list = asyncHandler(async (_req: Request, res: Response) => {
    const items = listRdpHubConnections().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    res.json({ success: true, items, totalCount: items.length });
  }, 'Failed to list RDP connections.');

  getOne = asyncHandler(async (req: Request, res: Response) => {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    const item = getRdpHubConnection(id);
    if (!item) {
      res.status(404).json({ success: false, error: 'RDP connection was not found.' });
      return;
    }
    res.json({ success: true, item });
  }, 'Failed to read RDP connection.');

  create = asyncHandler(async (req: Request, res: Response) => {
    try {
      const item = await createRdpHubConnection((req.body || {}) as RdpHubConnectionWritePayload, actorFromRequest(req));
      res.status(201).json({ success: true, item });
    } catch (error) {
      if (handleStoreError(error, res)) {
        return;
      }
      throw error;
    }
  }, 'Failed to create RDP connection.');

  update = asyncHandler(async (req: Request, res: Response) => {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    try {
      const item = await updateRdpHubConnection(id, (req.body || {}) as RdpHubConnectionWritePayload, actorFromRequest(req));
      res.json({ success: true, item });
    } catch (error) {
      if (handleStoreError(error, res)) {
        return;
      }
      throw error;
    }
  }, 'Failed to update RDP connection.');

  remove = asyncHandler(async (req: Request, res: Response) => {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    const deleted = await deleteRdpHubConnection(id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'RDP connection was not found.' });
      return;
    }
    res.json({ success: true });
  }, 'Failed to delete RDP connection.');

  status = asyncHandler(async (_req: Request, res: Response) => {
    const guacd = resolveGuacdOptions();
    const reachable = await probeGuacd();
    res.json({
      success: true,
      guacd: {
        ...guacd,
        reachable,
      },
    });
  }, 'Failed to probe guacd.');

  createTicket = asyncHandler(async (req: Request, res: Response) => {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }
    const body = (req.body || {}) as RdpHubSessionTicketPayload;
    const ticket = createRdpHubSessionTicket(id, userId, body);
    if (!ticket) {
      res.status(404).json({ success: false, error: 'RDP connection was not found.' });
      return;
    }
    res.json({ success: true, ...ticket });
  }, 'Failed to create RDP session ticket.');
}
