import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { createDelegationRule, listDelegationRulesForOwner, deleteOwnDelegationRule } from '../domain/workflow/workItemDelegationRuleRepository';

/** HWF-2.4 — self-service Out-of-Office delegation rules. Every operation is scoped to `req.auth.userId` — a user manages only their own rules, never someone else's (no ADMIN-on-behalf-of path in V1). */
export class WorkItemDelegationRulesController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const rules = await listDelegationRulesForOwner(req.auth!.userId);
    res.json({ success: true, rules });
  }, 'Failed to list delegation rules.');

  create = asyncHandler(async (req: Request, res: Response) => {
    const { delegateUserId, startAt, endAt } = req.body as { delegateUserId: number; startAt: string; endAt: string };
    if (!delegateUserId || !startAt || !endAt) {
      res.status(400).json({ success: false, error: 'delegateUserId, startAt, and endAt are required.' });
      return;
    }
    if (new Date(startAt).getTime() >= new Date(endAt).getTime()) {
      res.status(400).json({ success: false, error: 'startAt must be before endAt.' });
      return;
    }
    const rule = await createDelegationRule({ userId: req.auth!.userId, delegateUserId, startAt, endAt });
    res.json({ success: true, rule });
  }, 'Failed to create delegation rule.');

  remove = asyncHandler(async (req: Request, res: Response) => {
    const deleted = await deleteOwnDelegationRule(Number(req.params.ruleId), req.auth!.userId);
    res.json({ success: true, deleted });
  }, 'Failed to delete delegation rule.');
}
