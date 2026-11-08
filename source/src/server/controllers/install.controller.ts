import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { InstallService } from '../services/install/install.service';

export class InstallController {
  constructor(private readonly installService = new InstallService({ settingsPath: '' })) {}

  withSettingsPath(settingsPath: string) {
    return new InstallController(new InstallService({ settingsPath }));
  }

  getStatus = asyncHandler(async (_req: Request, res: Response) => {
    const result = await this.installService.getStatus();
    res.json(result.body);
  });

  testDatabase = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.installService.testDatabase(req.body || {});
    res.json(result.body);
  });

  saveDatabase = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.installService.saveDatabase(req.body || {});
    res.json(result.body);
  });

  ensureDatabase = asyncHandler(async (_req: Request, res: Response) => {
    const result = await this.installService.ensureDatabase();
    res.json(result.body);
  });

  initDatabase = asyncHandler(async (_req: Request, res: Response) => {
    const result = await this.installService.initDatabase();
    res.json(result.body);
  });

  configureAdmin = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.installService.configureAdmin(req.body || {});
    res.json(result.body);
  });

  saveCapabilities = asyncHandler(async (req: Request, res: Response) => {
    const result = this.installService.saveCapabilities(req.body || {});
    res.json(result.body);
  });

  testRedis = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.installService.testRedis(req.body || {});
    res.json(result.body);
  });

  saveRedis = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.installService.saveRedis(req.body || {});
    res.json(result.body);
  });

  saveCache = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.installService.saveCache(req.body || {});
    res.json(result.body);
  });

  testEmail = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.installService.testEmail(req.body || {});
    res.json(result.body);
  });

  saveEmail = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.installService.saveEmail(req.body || {});
    res.json(result.body);
  });

  skipEmail = asyncHandler(async (_req: Request, res: Response) => {
    const result = await this.installService.skipEmail();
    res.json(result.body);
  });

  getCapabilitiesGuide = asyncHandler(async (_req: Request, res: Response) => {
    const result = this.installService.getCapabilitiesGuide();
    res.json(result.body);
  });

  runHealthChecks = asyncHandler(async (_req: Request, res: Response) => {
    const result = await this.installService.runHealthChecks();
    res.json(result.body);
  });

  complete = asyncHandler(async (_req: Request, res: Response) => {
    const result = await this.installService.complete();
    res.json(result.body);
  });
}
