import type { Request, Response, NextFunction } from 'express';
import { toActorContext } from '../utils/requestContext';
import {
  listSessionContextSettings,
  saveSessionContextSettings,
} from '../services/settings/sessionContextSettings.service';

export class SessionContextSettingsController {
  list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await listSessionContextSettings();
      res.json(result.body);
    } catch (error) {
      next(error);
    }
  };

  save = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await saveSessionContextSettings(toActorContext(req, true), req.body);
      res.json(result.body);
    } catch (error) {
      next(error);
    }
  };
}
