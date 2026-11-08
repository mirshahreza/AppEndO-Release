import type { Request, Response } from 'express';
import { SchedulerValidationError } from '../../shared/api/contracts/scheduler/validators';
import type { SchedulerService } from '../services/scheduler/scheduler.service';
import { asyncHandler } from '../utils/asyncHandler';
import { isHttpError } from '../errors/HttpError';

export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  getSnapshot = asyncHandler(async (_req: Request, res: Response) => {
    const result = await this.schedulerService.getSnapshot();
    res.json(result.body);
  }, 'Failed to load scheduler settings.');

  replaceSettings = asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = this.schedulerService.replaceSettings(req.body || {});
      res.json(result.body);
    } catch (error) {
      if (error instanceof SchedulerValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      throw error;
    }
  }, 'Failed to save scheduler settings.');

  addTask = asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = this.schedulerService.addTask(req.body || {});
      res.status(result.statusCode || 201).json(result.body);
    } catch (error) {
      if (error instanceof SchedulerValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      throw error;
    }
  }, 'Failed to create scheduled task.');

  updateTask = asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = this.schedulerService.updateTask(String(req.params.id || ''), req.body || {});
      res.json(result.body);
    } catch (error) {
      if (error instanceof SchedulerValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      throw error;
    }
  }, 'Failed to update scheduled task.');

  removeTask = asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = this.schedulerService.removeTask(String(req.params.id || ''));
      res.json(result.body);
    } catch (error) {
      if (error instanceof SchedulerValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      throw error;
    }
  }, 'Failed to delete scheduled task.');

  runTaskNow = asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await this.schedulerService.runTaskNow(String(req.params.id || ''));
      res.status(result.statusCode || 201).json(result.body);
    } catch (error) {
      if (error instanceof SchedulerValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      if (isHttpError(error)) {
        res.status(error.statusCode).json({ success: false, error: error.message });
        return;
      }
      throw error;
    }
  }, 'Failed to run scheduled task.');

  previewCron = asyncHandler(async (req: Request, res: Response) => {
    try {
      const cron = String(req.query.cron || '').trim();
      const timezone = String(req.query.timezone || 'UTC').trim() || 'UTC';
      const count = Number(req.query.count ?? 5);
      const result = this.schedulerService.previewCron(
        cron,
        timezone,
        Number.isFinite(count) ? count : 5,
      );
      res.json(result.body);
    } catch (error) {
      if (error instanceof SchedulerValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      throw error;
    }
  }, 'Failed to preview cron expression.');
}
