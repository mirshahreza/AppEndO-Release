import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { isHttpError } from '../errors/HttpError';
import type { ActorContext } from '../types/requestContext';
import { getIdeaFoundryService, IdeaFoundryService } from '../services/idea-foundry/ideaFoundry.service';

const actorFrom = (req: Request): ActorContext => ({
  userId: req.auth?.userId ?? 0,
  email: req.auth?.email,
  role: req.auth?.role,
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

export class IdeaFoundryController {
  constructor(private readonly service: IdeaFoundryService = getIdeaFoundryService()) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const items = await this.service.list(actorFrom(req));
    res.json({ success: true, items });
  }, 'Failed to list ideas.');

  get = asyncHandler(async (req: Request, res: Response) => {
    try {
      const item = await this.service.get(actorFrom(req), String(req.params.id ?? ''));
      res.json({ success: true, item });
    } catch (error) {
      sendError(res, error, 'Failed to load idea.');
    }
  }, 'Failed to load idea.');

  create = asyncHandler(async (req: Request, res: Response) => {
    try {
      const item = await this.service.create(actorFrom(req), req.body ?? {});
      res.status(201).json({ success: true, item });
    } catch (error) {
      sendError(res, error, 'Failed to register idea.');
    }
  }, 'Failed to register idea.');

  update = asyncHandler(async (req: Request, res: Response) => {
    try {
      const item = await this.service.update(actorFrom(req), String(req.params.id ?? ''), req.body ?? {});
      res.json({ success: true, item });
    } catch (error) {
      sendError(res, error, 'Failed to reconfigure idea.');
    }
  }, 'Failed to reconfigure idea.');

  listHomes = asyncHandler(async (req: Request, res: Response) => {
    const items = await this.service.listHomes(actorFrom(req));
    res.json({ success: true, items });
  }, 'Failed to list idea homes.');
}
