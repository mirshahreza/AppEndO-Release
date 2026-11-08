import type { Request, Response } from 'express';
import type { LogsService } from '../services/logs.service';
import { asyncHandler } from '../utils/asyncHandler';
import { toActorContext, toRequestDbContext } from '../utils/requestContext';

export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.logsService.list(toRequestDbContext(req), req.query);
    res.json(result.body);
  }, 'Failed to fetch logs.');

  getById = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.logsService.getById(toRequestDbContext(req), String(req.params.id || ''));
    res.json(result.body);
  }, 'Failed to fetch log detail.');

  clearAll = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.logsService.clearAll(toRequestDbContext(req));
    res.json(result.body);
  }, 'Failed to clear logs.');

  getConfig = asyncHandler(async (_req: Request, res: Response) => {
    const result = this.logsService.getMethodConfigs();
    res.json(result.body);
  }, 'Failed to fetch log method config.');

  saveConfig = asyncHandler(async (req: Request, res: Response) => {
    const { methodConfigs } = (req.body || {}) as { methodConfigs?: unknown };
    const result = await this.logsService.saveMethodConfigs(
      toActorContext(req, true),
      methodConfigs,
    );
    res.json(result.body);
  }, 'Failed to save log method config.');
}
