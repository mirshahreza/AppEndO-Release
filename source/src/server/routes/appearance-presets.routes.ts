import { Router, type Express } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  resolveUserThemePreset,
  updateUserThemePreset,
} from '../services/appearance-presets/userThemePreset.service';
import { asyncHandler } from '../utils/asyncHandler';

export const mountAppearancePresetRoutes = (app: Express): void => {
  const router = Router();

  router.get('/:swatchId', asyncHandler(async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const swatchId = String(req.params.swatchId || '').trim();
    const preset = await resolveUserThemePreset(userId, swatchId);
    if (!preset) {
      res.status(404).json({ success: false, error: `Accent swatch "${swatchId}" not found.` });
      return;
    }
    res.json({ success: true, preset });
  }, 'Failed to load theme preset.'));

  router.put('/:swatchId', asyncHandler(async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const swatchId = String(req.params.swatchId || '').trim();
    const result = await updateUserThemePreset(userId, userId, swatchId, req.body ?? {});
    if (result.ok === false) {
      res.status(result.statusCode).json({ success: false, error: result.error });
      return;
    }
    res.json({ success: true, preset: result.preset });
  }, 'Failed to update theme preset.'));

  app.use('/api/appearance/presets', requireAuth, router);
};
