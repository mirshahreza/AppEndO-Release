import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { toActorContext } from '../utils/requestContext';
import * as retentionService from '../services/retention.service';

export class RetentionController {
  destinations = asyncHandler(async (req: Request, res: Response) => {
    const result = await retentionService.listDestinations(toActorContext(req, true));
    res.json({ success: true, ...result });
  }, 'Failed to list archive destinations.');

  testDestination = asyncHandler(async (req: Request, res: Response) => {
    const result = await retentionService.testDestination(toActorContext(req, true), req.body);
    res.json(result);
  }, 'Failed to test archive destination.');

  dryRun = asyncHandler(async (req: Request, res: Response) => {
    const result = await retentionService.dryRunRetention(toActorContext(req, true), req.body);
    res.json({ success: true, ...result });
  }, 'Failed to dry-run retention.');

  run = asyncHandler(async (req: Request, res: Response) => {
    const result = await retentionService.runRetention(toActorContext(req, true), req.body);
    res.json(result);
  }, 'Failed to enqueue retention.');
}
