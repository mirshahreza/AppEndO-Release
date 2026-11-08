import { Router, type Express } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { IdeaFoundryController } from '../controllers/idea-foundry.controller';

export const mountIdeaFoundryRoutes = (app: Express): void => {
  const controller = new IdeaFoundryController();
  const router = Router();

  router.get('/', controller.list);
  router.get('/homes', controller.listHomes);
  router.post('/', controller.create);
  router.route('/:id')
    .get(controller.get)
    .put(controller.update)
    .patch(controller.update);

  app.use('/api/idea-foundry', requireAuth, router);
};
