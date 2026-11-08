import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { getBusinessHoursCalendar, updateBusinessHoursCalendar } from '../domain/workflow/workflowBusinessHoursCalendarRepository';
import type { BusinessHoursCalendarConfig } from '../domain/workflow/engine/businessHoursCalendar';

/** HWF-2.2 — single global calendar. Read is open to any authenticated user (the Designer needs it to show current config); writing is ADMIN-only, gated at the route layer. */
export class WorkflowBusinessHoursCalendarController {
  get = asyncHandler(async (_req: Request, res: Response) => {
    const calendar = await getBusinessHoursCalendar();
    res.json({ success: true, calendar });
  }, 'Failed to load the Business Hours Calendar.');

  update = asyncHandler(async (req: Request, res: Response) => {
    const { workingDays, startTime, endTime, holidays } = req.body as BusinessHoursCalendarConfig;
    if (!Array.isArray(workingDays) || !startTime || !endTime || !Array.isArray(holidays)) {
      res.status(400).json({ success: false, error: 'workingDays, startTime, endTime, and holidays are required.' });
      return;
    }
    const calendar = await updateBusinessHoursCalendar({ workingDays, startTime, endTime, holidays });
    res.json({ success: true, calendar });
  }, 'Failed to update the Business Hours Calendar.');
}
