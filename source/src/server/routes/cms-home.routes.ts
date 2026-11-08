import { Router, type Express } from 'express';
import { CmsHomeController } from '../controllers/cms-home.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireCmsPackage } from '../services/cms-site/cmsSiteRuntime';

export const mountCmsHomeRoutes = (app: Express): void => {
  const controller = new CmsHomeController();
  const router = Router();

  router.get('/review-queue', controller.reviewQueue);

  app.use('/api/cms/home', requireCmsPackage, requireAuth, router);
};
