import { Router, type Express } from 'express';
import multer from 'multer';
import { PlatformController } from '../controllers/platform.controller';
import { requireAdminOrDeveloper, requireAuth, requireRole } from '../middleware/auth.middleware';
import { PlatformCrudService } from '../services/platform/platformCrud.service';
import { getDefaultPlatformCultureSettingsService } from '../services/platform/platformCultureSettings.service';
import { getDefaultPlatformCultureTranslationsService } from '../services/platform/platformCultureTranslations.service';

export const mountPlatformRoutes = (app: Express): void => {
  const crudService = new PlatformCrudService();
  const cultureSettingsService = getDefaultPlatformCultureSettingsService();
  const cultureTranslationsService = getDefaultPlatformCultureTranslationsService();
  const controller = new PlatformController(crudService, cultureSettingsService, cultureTranslationsService);
  const adminOnly = requireRole('ADMIN');
  const router = Router();
  const portalLogoUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 },
  });

  router.get('/runtime-config', controller.getRuntimeConfig);
  router.get('/cultures', controller.getCultures);
  router.put('/cultures', requireAuth, adminOnly, controller.updateCultures);
  router.get('/culture-translations/bundle/:bundleId', controller.getCultureTranslationBundle);
  router.get('/culture-translations', requireAuth, requireAdminOrDeveloper, controller.getCultureTranslations);
  router.put('/culture-translations', requireAuth, requireAdminOrDeveloper, controller.updateCultureTranslations);

  router.get('/experience/manifest', adminOnly, controller.getExperienceManifest);
  router.put('/experience/manifest', adminOnly, controller.compileExperienceManifest);

  router.post('/portals', adminOnly, controller.createPortal);
  router.put('/portals/:segment', adminOnly, controller.updatePortal);
  router.delete('/portals/:segment', adminOnly, controller.deletePortal);
  router.post('/portals/:segment/duplicate', adminOnly, controller.duplicatePortal);
  router.post('/portals/:segment/logo', adminOnly, portalLogoUpload.single('file'), controller.uploadPortalLogo);
  router.post('/portals/:segment/pages/menu', adminOnly, controller.appendPortalPageMenu);

  router.get('/navigations', adminOnly, controller.listNavigations);
  router.get('/navigations/:id', adminOnly, controller.getNavigation);
  router.post('/navigations', adminOnly, controller.createNavigation);
  router.post('/navigations/:id/rename', adminOnly, controller.renameNavigation);
  router.put('/navigations/:id', adminOnly, controller.updateNavigation);
  router.delete('/navigations/:id', adminOnly, controller.deleteNavigation);

  router.get('/mounts', adminOnly, controller.listMounts);
  router.get('/mounts/:id', adminOnly, controller.getMount);
  router.post('/mounts', adminOnly, controller.createMount);
  router.put('/mounts/:id', adminOnly, controller.updateMount);
  router.delete('/mounts/:id', adminOnly, controller.deleteMount);
  router.post('/mounts/:id/export/discover', adminOnly, controller.discoverMountExport);
  router.post('/mounts/:id/export/preview', adminOnly, controller.previewMountExport);
  router.post('/mounts/:id/export/download', adminOnly, controller.downloadMountExport);

  router.get('/shells', adminOnly, controller.listShells);
  router.get('/shells/:shellKey', adminOnly, controller.getShell);
  router.post('/shells', adminOnly, controller.createShell);
  router.put('/shells/:shellKey', adminOnly, controller.updateShell);
  router.delete('/shells/:shellKey', adminOnly, controller.deleteShell);

  router.get('/page-modules', adminOnly, controller.listPageModules);
  router.get('/page-modules/:pageKey', adminOnly, controller.getPageModule);
  router.post('/page-modules', adminOnly, controller.createPageModule);
  router.put('/page-modules/:pageKey', adminOnly, controller.updatePageModule);
  router.delete('/page-modules/:pageKey', adminOnly, controller.deletePageModule);

  router.get('/shell-rules', adminOnly, controller.listShellRules);
  router.get('/shell-rules/:id', adminOnly, controller.getShellRule);
  router.post('/shell-rules', adminOnly, controller.createShellRule);
  router.put('/shell-rules/:id', adminOnly, controller.updateShellRule);
  router.delete('/shell-rules/:id', adminOnly, controller.deleteShellRule);

  router.get('/route-bindings', adminOnly, controller.listRouteBindings);
  router.get('/route-bindings/:id', adminOnly, controller.getRouteBinding);
  router.post('/route-bindings', adminOnly, controller.createRouteBinding);
  router.put('/route-bindings/:id', adminOnly, controller.updateRouteBinding);
  router.delete('/route-bindings/:id', adminOnly, controller.deleteRouteBinding);

  app.use('/api/platform', router);
};
