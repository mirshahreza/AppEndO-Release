import type { Request, Response } from 'express';
import type { BaseInfoService } from '../services/base-info.service';
import { asyncHandler } from '../utils/asyncHandler';
import { toActorContext, toRequestDbContext } from '../utils/requestContext';

export class BaseInfoController {
  constructor(private readonly baseInfoService: BaseInfoService) {}

  listOptions = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.baseInfoService.listOptions(toRequestDbContext(req), req.query);
    res.json(result.body);
  }, 'Failed to load base info options.');

  listTree = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.baseInfoService.listTree(toRequestDbContext(req), req.query);
    res.json(result.body);
  }, 'Failed to load base info tree.');

  listChildren = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.baseInfoService.listChildren(toRequestDbContext(req), req.query);
    res.json(result.body);
  }, 'Failed to load base info children.');

  getOne = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.baseInfoService.getNode(
      toRequestDbContext(req),
      String(req.params.id || ''),
    );
    res.json(result.body);
  }, 'Failed to load base info node.');

  create = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.baseInfoService.createNode(
      toRequestDbContext(req),
      toActorContext(req, true),
      (req.body || {}) as Record<string, unknown>,
    );
    res.status(result.statusCode || 200).json(result.body);
  }, 'Failed to create base info node.');

  update = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.baseInfoService.updateNode(
      toRequestDbContext(req),
      toActorContext(req, true),
      String(req.params.id || ''),
      (req.body || {}) as Record<string, unknown>,
    );
    res.json(result.body);
  }, 'Failed to update base info node.');

  move = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.baseInfoService.moveNode(
      toRequestDbContext(req),
      toActorContext(req, true),
      decodeURIComponent(String(req.params.id || '')),
      (req.body || {}) as Record<string, unknown>,
    );
    res.json(result.body);
  }, 'Failed to move base info node.');

  remove = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.baseInfoService.deleteNode(
      toRequestDbContext(req),
      String(req.params.id || ''),
    );
    res.json(result.body);
  }, 'Failed to delete base info node.');

  setActive = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.baseInfoService.setActive(
      toRequestDbContext(req),
      toActorContext(req, true),
      String(req.params.id || ''),
      Boolean(req.body?.isActive),
    );
    res.json(result.body);
  }, 'Failed to update node state.');
}
