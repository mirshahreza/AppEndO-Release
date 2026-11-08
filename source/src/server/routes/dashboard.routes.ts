import { Router, type Express } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';
import { DashboardSummaryService } from '../services/dashboard/dashboardSummary.service';
import { requireRole } from '../middleware/auth.middleware';

export type DashboardRoutesDeps = {
  settingsPath: string;
};

export const mountDashboardRoutes = (app: Express, deps: DashboardRoutesDeps): void => {
  const service = new DashboardSummaryService(deps);
  const controller = new DashboardController(service);
  const adminOnly = requireRole('ADMIN');
  const router = Router();

  router.get('/summary', controller.summary);

  app.use('/api/dashboard', adminOnly, router);
};
