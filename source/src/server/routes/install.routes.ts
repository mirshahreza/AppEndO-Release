import { Router, type Express } from 'express';
import { InstallController } from '../controllers/install.controller';

export type InstallRoutesDeps = {
  settingsPath: string;
};

export const mountInstallRoutes = (app: Express, deps: InstallRoutesDeps): void => {
  const controller = new InstallController().withSettingsPath(deps.settingsPath);
  const router = Router();

  router.get('/status', controller.getStatus);
  router.post('/database/test', controller.testDatabase);
  router.post('/database/save', controller.saveDatabase);
  router.post('/database/init', controller.initDatabase);
  router.post('/database/ensure', controller.ensureDatabase);
  router.post('/admin', controller.configureAdmin);
  router.post('/capabilities', controller.saveCapabilities);
  router.post('/redis/test', controller.testRedis);
  router.post('/redis/save', controller.saveRedis);
  router.post('/cache/save', controller.saveCache);
  router.post('/email/test', controller.testEmail);
  router.post('/email/save', controller.saveEmail);
  router.post('/email/skip', controller.skipEmail);
  router.get('/capabilities-guide', controller.getCapabilitiesGuide);
  router.post('/health-checks', controller.runHealthChecks);
  router.post('/complete', controller.complete);

  app.use('/api/install', router);
};
