import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../errors/HttpError';
import { toActorContext } from '../utils/requestContext';
import * as recordEventsService from '../services/record-events/recordEvents.service';

export class RecordEventsController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const result = await recordEventsService.listEvents(
      toActorContext(req, req.auth?.role === 'ADMIN'),
      (req.query || {}) as Record<string, unknown>,
    );
    res.json({
      success: true,
      items: result.items,
      totalCount: result.totalCount,
      archiveUnavailable: result.archiveUnavailable,
    });
  }, 'Failed to list record events.');

  getById = asyncHandler(async (req: Request, res: Response) => {
    const item = await recordEventsService.getEvent(
      toActorContext(req, req.auth?.role === 'ADMIN'),
      String(req.params.id),
    );
    res.json({ success: true, item });
  }, 'Failed to load record event.');

  exportList = asyncHandler(async (req: Request, res: Response) => {
    const exported = await recordEventsService.exportEvents(
      toActorContext(req, req.auth?.role === 'ADMIN'),
      (req.query || {}) as Record<string, unknown>,
    );
    res.setHeader('Content-Disposition', `attachment; filename="record-events-${exported.signedAt.slice(0, 10)}.json"`);
    res.json({ success: true, ...exported });
  }, 'Failed to export record events.');

  verifyExport = asyncHandler(async (req: Request, res: Response) => {
    const payload = String(req.body?.payload ?? '');
    const signature = String(req.body?.signature ?? '');
    if (!payload || !signature) {
      throw new HttpError(400, 'payload and signature are required.');
    }
    res.json({ success: true, ...recordEventsService.verifyExport(payload, signature) });
  }, 'Failed to verify export.');

  devices = asyncHandler(async (req: Request, res: Response) => {
    const userId = Number(req.query.userId || req.params.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new HttpError(400, 'userId is required.');
    }
    const items = await recordEventsService.getDevices(
      toActorContext(req, req.auth?.role === 'ADMIN'),
      userId,
    );
    res.json({ success: true, items });
  }, 'Failed to list devices.');

  putHold = asyncHandler(async (req: Request, res: Response) => {
    const result = await recordEventsService.putHold(toActorContext(req, true), req.body);
    res.json(result);
  }, 'Failed to create legal hold.');

  deleteHold = asyncHandler(async (req: Request, res: Response) => {
    const subjectKind = String(req.query.subjectKind || req.body?.subjectKind || '');
    const subjectId = String(req.query.subjectId || req.body?.subjectId || '');
    if (!subjectKind || !subjectId) {
      throw new HttpError(400, 'subjectKind and subjectId are required.');
    }
    const result = await recordEventsService.removeHold(toActorContext(req, true), subjectKind, subjectId);
    res.json(result);
  }, 'Failed to remove legal hold.');

  erase = asyncHandler(async (req: Request, res: Response) => {
    const result = await recordEventsService.eraseHistory(toActorContext(req, true), req.body);
    res.json(result);
  }, 'Failed to erase history.');

  clearAll = asyncHandler(async (req: Request, res: Response) => {
    const result = await recordEventsService.clearHotEvents(toActorContext(req, true));
    res.json({ success: true, ...result });
  }, 'Failed to clear record events.');

  logLink = asyncHandler(async (req: Request, res: Response) => {
    const requestId = String(req.query.requestId || '');
    const result = await recordEventsService.logExpiredForRequest(requestId);
    res.json({ success: true, ...result });
  }, 'Failed to resolve HTTP log.');
}
