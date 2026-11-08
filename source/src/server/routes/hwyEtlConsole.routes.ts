import { Router, type Request, type Response } from 'express';

import type { HwyEtlStartRunRequest, HwyEtlSyncPlanRequest } from '../../shared/api/contracts/hwy/etlConsole';
import {
  cancelHwyEtlConsoleRun,
  getHwyEtlConsoleCatalog,
  getHwyEtlConsoleStatus,
  startHwyEtlConsoleRun,
} from '../domain/hwy/hwyEtlConsole.service';
import { computeHwyEtlSyncPlan } from '../domain/hwy/hwyEtlSyncPlan.service';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

export const registerHwyEtlConsoleRoutes = (router: Router): void => {
  router.get(
    '/etl-console/catalog',
    requireAuth,
    requireRole('ADMIN'),
    (_req: Request, res: Response) => {
      res.json({ success: true, ...getHwyEtlConsoleCatalog() });
    },
  );

  router.get(
    '/etl-console/status',
    requireAuth,
    requireRole('ADMIN'),
    async (_req: Request, res: Response) => {
      try {
        const status = await getHwyEtlConsoleStatus();
        res.json({ success: true, status });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load ETL status.';
        res.status(500).json({ success: false, message });
      }
    },
  );

  router.post(
    '/etl-console/sync-plan',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const body = (req.body ?? {}) as HwyEtlSyncPlanRequest;
      try {
        const plan = await computeHwyEtlSyncPlan(body.options ?? {});
        res.json({ success: true, plan });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not compute sync plan.';
        res.status(500).json({ success: false, message });
      }
    },
  );

  router.post(
    '/etl-console/runs',
    requireAuth,
    requireRole('ADMIN'),
    (req: Request, res: Response) => {
      const body = req.body as HwyEtlStartRunRequest;
      const result = startHwyEtlConsoleRun(body);
      if (!result.ok) {
        res.status(400).json({ success: false, message: result.message ?? 'Could not start run.' });
        return;
      }
      res.json({ success: true, run: result.run });
    },
  );

  router.post(
    '/etl-console/runs/cancel',
    requireAuth,
    requireRole('ADMIN'),
    (_req: Request, res: Response) => {
      const result = cancelHwyEtlConsoleRun();
      if (!result.ok) {
        res.status(409).json({ success: false, message: result.message ?? 'Nothing to cancel.' });
        return;
      }
      res.json({ success: true, message: result.message });
    },
  );
};
