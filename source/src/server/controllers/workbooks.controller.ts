import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { isHttpError } from '../errors/HttpError';
import { getWorkbooksService, WorkbooksService, type WorkbookActor } from '../services/workbooks/workbooks.service';

const actorFrom = (req: Request): WorkbookActor => ({
  userId: req.auth?.userId ?? 0,
  email: req.auth?.email,
  role: req.auth?.role,
  roles: req.auth?.roles ?? [],
  isAdmin: (req.auth?.roles ?? []).includes('ADMIN') || req.auth?.role === 'ADMIN',
});

const sendError = (res: Response, error: unknown, fallback: string) => {
  if (isHttpError(error)) {
    res.status(error.statusCode).json({ success: false, error: error.message });
    return;
  }
  res.status(400).json({
    success: false,
    error: error instanceof Error ? error.message : fallback,
  });
};

export class WorkbooksController {
  constructor(private readonly service: WorkbooksService = getWorkbooksService()) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const items = await this.service.list(actorFrom(req));
    res.json({ success: true, items });
  }, 'Failed to list workbooks.');

  listShared = asyncHandler(async (req: Request, res: Response) => {
    const items = await this.service.listShared(actorFrom(req));
    res.json({ success: true, items });
  }, 'Failed to list shared workbooks.');

  resolveUsername = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.resolveUsername(actorFrom(req), String(req.query.username ?? ''));
    res.json({ success: true, ...result });
  }, 'Failed to resolve username.');

  get = asyncHandler(async (req: Request, res: Response) => {
    try {
      const item = await this.service.get(actorFrom(req), String(req.params.id));
      res.json({ success: true, item });
    } catch (error) {
      sendError(res, error, 'Failed to load workbook.');
    }
  }, 'Failed to load workbook.');

  open = asyncHandler(async (req: Request, res: Response) => {
    try {
      const item = await this.service.open(actorFrom(req), String(req.params.id));
      res.json({ success: true, item });
    } catch (error) {
      sendError(res, error, 'Failed to open workbook.');
    }
  }, 'Failed to open workbook.');

  create = asyncHandler(async (req: Request, res: Response) => {
    try {
      const item = await this.service.create(actorFrom(req), req.body ?? {});
      res.status(201).json({ success: true, item });
    } catch (error) {
      sendError(res, error, 'Failed to create workbook.');
    }
  }, 'Failed to create workbook.');

  update = asyncHandler(async (req: Request, res: Response) => {
    try {
      const item = await this.service.update(actorFrom(req), String(req.params.id), req.body ?? {});
      res.json({ success: true, item });
    } catch (error) {
      sendError(res, error, 'Failed to save workbook.');
    }
  }, 'Failed to save workbook.');

  updateAccess = asyncHandler(async (req: Request, res: Response) => {
    try {
      const item = await this.service.updateAccess(actorFrom(req), String(req.params.id), req.body ?? {});
      res.json({ success: true, item });
    } catch (error) {
      sendError(res, error, 'Failed to update workbook sharing.');
    }
  }, 'Failed to update workbook sharing.');

  remove = asyncHandler(async (req: Request, res: Response) => {
    try {
      await this.service.remove(actorFrom(req), String(req.params.id));
      res.json({ success: true });
    } catch (error) {
      sendError(res, error, 'Failed to delete workbook.');
    }
  }, 'Failed to delete workbook.');
}
