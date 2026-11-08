import type { Request, Response } from 'express';
import type { DashboardSummaryService } from '../services/dashboard/dashboardSummary.service';
import { asyncHandler } from '../utils/asyncHandler';

export class DashboardController {
  constructor(private readonly dashboardSummaryService: DashboardSummaryService) {}

  summary = asyncHandler(async (_req: Request, res: Response) => {
    const result = await this.dashboardSummaryService.getSummary();
    res.json(result.body);
  }, 'Failed to load dashboard summary.');
}
