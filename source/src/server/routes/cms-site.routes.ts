import { Router, type Express } from 'express';
import { CmsSiteController } from '../controllers/cms-site.controller';
import { CmsPublicContentService } from '../services/cms-site/cmsPublicContent.service';
import { requireCmsPackage } from '../services/cms-site/cmsSiteRuntime';
import type { createEdgeDbQueryExecutor } from '../../core/database/EdgeDbRouter';

export type CmsSiteRoutesDeps = {
  settingsPath: string;
  edgeDbQuery: ReturnType<typeof createEdgeDbQueryExecutor>;
};

export const mountCmsSiteRoutes = (app: Express, deps: CmsSiteRoutesDeps): void => {
  const service = new CmsPublicContentService({
    settingsPath: deps.settingsPath,
    edgeDbQuery: deps.edgeDbQuery,
  });
  const controller = new CmsSiteController(service);
  const router = Router();

  router.get('/public', controller.getPublicSite);
  router.get('/public/assets/:id', controller.getPublicAsset);
  router.get('/public/contents/:slug', controller.getBySlug);

  app.use('/api/cms-site', requireCmsPackage, router);
};
