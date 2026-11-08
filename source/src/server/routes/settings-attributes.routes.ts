import { Router, type Express } from 'express';
import { SettingsAttributesController } from '../controllers/settings-attributes.controller';
import { ProfileFieldsSettingsController } from '../controllers/profile-fields-settings.controller';
import { SessionContextSettingsController } from '../controllers/session-context-settings.controller';
import { requireRole } from '../middleware/auth.middleware';

export const mountSettingsAttributesRoutes = (app: Express): void => {
  const controller = new SettingsAttributesController();
  const profileFieldsController = new ProfileFieldsSettingsController();
  const sessionContextController = new SessionContextSettingsController();
  const adminOnly = requireRole('ADMIN');
  const router = Router();

  router.get('/profile-fields', profileFieldsController.list);
  router.put('/profile-fields', profileFieldsController.save);
  // Compatibility alias; primary path is GET/PUT /api/settings/session-context.
  router.get('/session-context', sessionContextController.list);
  router.put('/session-context', sessionContextController.save);
  router.get('/', controller.list);
  router.post('/', controller.create);
  router.put('/reorder', controller.reorder);
  router.put('/:id(\\d+)', controller.update);
  router.delete('/:id(\\d+)', controller.remove);

  app.use('/api/settings/attributes', adminOnly, router);
};
