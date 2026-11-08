import type { Request, Response } from 'express';
import type { CacheSettings } from '../../shared/api/contracts/cache/types';
import { parseCacheEntriesListQuery } from '../../shared/api/contracts/cache/listQuery';
import type { CacheService } from '../services/cache.service';
import { asyncHandler } from '../utils/asyncHandler';

export class CacheController {
  constructor(private readonly cacheService: CacheService) {}

  getSettings = asyncHandler(async (_req: Request, res: Response) => {
    const result = this.cacheService.getSettings();
    res.json(result.body);
  }, 'Failed to read cache settings.');

  updateSettings = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.cacheService.updateSettings((req.body || {}) as Partial<CacheSettings>);
    res.json(result.body);
  }, 'Failed to update cache settings.');

  testSettings = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.cacheService.testSettings((req.body || {}) as Partial<CacheSettings>);
    res.json(result.body);
  }, 'Failed to test cache settings.');

  getStatus = asyncHandler(async (_req: Request, res: Response) => {
    const result = await this.cacheService.getStatus();
    res.json(result.body);
  }, 'Failed to read cache status.');

  list = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.cacheService.listEntries(parseCacheEntriesListQuery(req.query as Record<string, unknown>));
    res.json(result.body);
  }, 'Failed to list cache entries.');

  getEntry = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.cacheService.getEntry(String(req.params.key || ''));
    res.json(result.body);
  }, 'Failed to fetch cache entry.');

  clearAll = asyncHandler(async (_req: Request, res: Response) => {
    const result = await this.cacheService.clearAll();
    res.json(result.body);
  }, 'Failed to clear cache entries.');

  deleteKey = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.cacheService.deleteKey(String(req.params.key || ''));
    res.json(result.body);
  }, 'Failed to delete cache entry.');
}
