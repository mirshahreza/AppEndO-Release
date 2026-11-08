import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { createSavedFilter, listSavedFiltersForOwner, deleteOwnSavedFilter } from '../domain/workflow/workItemSavedFilterRepository';

/** HWF-4.3 — every operation scoped to `req.auth.userId`; a user manages only their own saved filters. */
export class WorkItemSavedFiltersController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const filters = await listSavedFiltersForOwner(req.auth!.userId);
    res.json({ success: true, filters });
  }, 'Failed to list saved filters.');

  create = asyncHandler(async (req: Request, res: Response) => {
    const { name, filter } = req.body as { name: string; filter: unknown };
    if (!name?.trim() || filter === undefined) {
      res.status(400).json({ success: false, error: 'name and filter are required.' });
      return;
    }
    const saved = await createSavedFilter({ userId: req.auth!.userId, name: name.trim(), filterJson: JSON.stringify(filter) });
    res.json({ success: true, filter: saved });
  }, 'Failed to create saved filter.');

  remove = asyncHandler(async (req: Request, res: Response) => {
    const deleted = await deleteOwnSavedFilter(Number(req.params.filterId), req.auth!.userId);
    res.json({ success: true, deleted });
  }, 'Failed to delete saved filter.');
}
