import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import {
  DeveloperLibrariesService,
  getDeveloperLibrariesService,
} from '../services/libraries/developerLibraries.service';

export class LibrariesController {
  constructor(private readonly service: DeveloperLibrariesService = getDeveloperLibrariesService()) {}

  list = asyncHandler(async (_req: Request, res: Response) => {
    res.json({ success: true, items: this.service.list() });
  }, 'Failed to list libraries.');

  search = asyncHandler(async (req: Request, res: Response) => {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const items = await this.service.search(query);
    res.json({ success: true, items });
  }, 'Failed to search the npm registry.');

  install = asyncHandler(async (req: Request, res: Response) => {
    const name = typeof req.body?.name === 'string' ? req.body.name : '';
    const versionRange = typeof req.body?.versionRange === 'string' ? req.body.versionRange : undefined;
    const result = await this.service.install(name, versionRange);
    if (!result.ok) {
      res.status(result.statusCode).json({ success: false, error: result.error });
      return;
    }
    res.json({ success: true, library: result.library });
  }, 'Failed to install library.');

  upgrade = asyncHandler(async (req: Request, res: Response) => {
    const name = typeof req.body?.name === 'string' ? req.body.name : '';
    const result = await this.service.upgrade(name);
    if (!result.ok) {
      res.status(result.statusCode).json({ success: false, error: result.error });
      return;
    }
    res.json({ success: true, library: result.library });
  }, 'Failed to upgrade library.');

  uninstall = asyncHandler(async (req: Request, res: Response) => {
    const name = typeof req.body?.name === 'string' ? req.body.name : '';
    const result = await this.service.uninstall(name);
    if (!result.ok) {
      res.status(result.statusCode).json({ success: false, error: result.error });
      return;
    }
    res.json({ success: true });
  }, 'Failed to uninstall library.');
}
