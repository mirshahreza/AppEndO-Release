import type { Request, Response } from 'express';
import {
  listProfileFieldSettings,
  saveProfileFieldSettings,
} from '../services/profile/profileFieldsSettings.service';
import { asyncHandler } from '../utils/asyncHandler';
import { toActorContext } from '../utils/requestContext';

export class ProfileFieldsSettingsController {
  list = asyncHandler(async (_req: Request, res: Response) => {
    const result = await listProfileFieldSettings();
    res.json(result.body);
  }, 'Failed to list profile field settings.');

  save = asyncHandler(async (req: Request, res: Response) => {
    const result = await saveProfileFieldSettings(
      toActorContext(req, true),
      req.body || {},
    );
    res.json(result.body);
  }, 'Failed to save profile field settings.');
}
