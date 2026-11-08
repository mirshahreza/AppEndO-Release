import type { NextFunction, Request, Response } from 'express';
import { Router, type Express } from 'express';
import { EuaController } from '../controllers/eua.controller';
import { requireAdminOrDeveloper, requireAuth } from '../middleware/auth.middleware';

export type EuaRoutesDeps = {
  euaRateLimiter: (req: Request, res: Response, next: NextFunction) => void;
};

export const mountEuaRoutes = (app: Express, deps: EuaRoutesDeps): void => {
  const controller = new EuaController();
  const router = Router();

  router.get('/status', requireAuth, controller.getStatus);
  router.post('/field-assist/transform', requireAuth, deps.euaRateLimiter, controller.transformText);
  router.post('/field-assist/autocomplete', requireAuth, deps.euaRateLimiter, controller.autocompleteText);
  router.post('/field-assist/context-suggest', requireAuth, deps.euaRateLimiter, controller.contextSuggest);
  router.post('/field-assist/extract-fields', requireAuth, deps.euaRateLimiter, controller.extractFields);
  router.post('/field-assist/fill-from-text', requireAuth, deps.euaRateLimiter, controller.fillFromText);
  router.post('/field-assist/ocr-image', requireAuth, deps.euaRateLimiter, controller.ocrImage);
  router.post('/field-assist/alt-text', requireAuth, deps.euaRateLimiter, controller.generateAltText);
  router.post('/field-assist/semantic-validate', requireAuth, deps.euaRateLimiter, controller.semanticValidate);
  router.get('/vocab-context/:id', requireAuth, requireAdminOrDeveloper, controller.getVocabSemanticContext);
  router.patch('/vocab-context/:id', requireAuth, requireAdminOrDeveloper, controller.patchVocabSemanticContext);
  router.get('/settings', requireAuth, controller.getSettings);
  router.put('/settings', requireAuth, controller.updateSettings);

  app.use('/api/eua', router);
};
