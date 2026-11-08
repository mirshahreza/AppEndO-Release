import type { Express } from 'express';
import { BootController } from '../controllers/boot.controller';

export type BootRoutesDeps = {
  settingsPath: string;
};

export const mountBootRoutes = (app: Express, deps: BootRoutesDeps): void => {
  const controller = new BootController(deps.settingsPath);
  app.get('/api/boot', controller.getBoot);
};
