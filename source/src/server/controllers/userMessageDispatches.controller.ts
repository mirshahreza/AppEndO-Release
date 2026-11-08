import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import {
  getUserMessageDispatchById,
  listUserMessageDispatches,
} from '../services/notifications/userMessageDispatch.service';

/** MSGI-2 — self-scoped outbound message dispatch ledger (recipient only). */
export class UserMessageDispatchesController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const channel = typeof req.query.channel === 'string' ? req.query.channel.trim() : undefined;
    const deliveryStatus = typeof req.query.deliveryStatus === 'string' ? req.query.deliveryStatus.trim() : undefined;
    const eventType = typeof req.query.eventType === 'string' ? req.query.eventType.trim() : undefined;
    const skip = req.query.skip !== undefined ? Number(req.query.skip) : 0;
    const take = req.query.take !== undefined ? Number(req.query.take) : 20;
    const items = await listUserMessageDispatches(userId, {
      channel: channel || undefined,
      deliveryStatus: deliveryStatus || undefined,
      eventType: eventType || undefined,
      skip: Number.isFinite(skip) ? skip : 0,
      take: Number.isFinite(take) ? take : 20,
    });
    res.json({ success: true, items });
  }, 'Failed to list message dispatches.');

  getById = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const dispatchId = Number(req.params.dispatchId);
    if (!Number.isInteger(dispatchId) || dispatchId <= 0) {
      res.status(400).json({ success: false, error: 'Invalid dispatch id.' });
      return;
    }
    const item = await getUserMessageDispatchById(userId, dispatchId);
    if (!item) {
      res.status(404).json({ success: false, error: 'Message dispatch not found.' });
      return;
    }
    res.json({ success: true, item });
  }, 'Failed to load message dispatch.');
}
