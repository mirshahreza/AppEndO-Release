import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import type { PlatformRouteLoadingConfig } from '../../shared/api/contracts/routeLoading/schema';
import { RouteLoadingService } from '../services/routeLoading/routeLoading.service';

export class RouteLoadingController {
  constructor(private readonly service: RouteLoadingService) {}

  getAdminConfig = asyncHandler(async (_req: Request, res: Response) => {
    res.json({ success: true, config: this.service.getConfig() });
  });

  putAdminConfig = asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as PlatformRouteLoadingConfig;
    const saved = this.service.saveConfig(body);
    res.json({ success: true, config: saved });
  });
}
