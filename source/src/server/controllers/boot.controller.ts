import type { Request, Response } from 'express';
import { BootService } from '../services/boot/boot.service';
import { asyncHandler } from '../utils/asyncHandler';

export class BootController {
  constructor(private readonly settingsPath: string) {}

  getBoot = asyncHandler(async (_req: Request, res: Response) => {
    const service = new BootService(this.settingsPath);
    const payload = await service.getBootPayload();
    res.json(payload);
  }, 'Failed to load application boot payload.');
}
