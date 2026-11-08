import type { Request, Response } from 'express';
import type { SettingsService } from '../services/settings.service';
import { SETTINGS_PATH } from '../config/settingsFile';
import {
  exportAllPlatformBlobs,
  exportPlatformTransferBundle,
  importLegacyPlatformPayload,
  importPlatformTransferBundle,
  normalizeTransferSectionKeys,
} from '../services/settings/platformTransfer.service';
import {
  mergeNodeSettings,
  readNodeSettings,
  readPlatformSecuritySettings,
  updatePlatformSecuritySettings,
} from '../services/settings/settingsScope.service';
import { PLATFORM_TRANSFER_CATALOG } from '../../shared/api/contracts/settings/platformTransfer';
import { asyncHandler } from '../utils/asyncHandler';
import { sendHttpError } from '../utils/controllerHttp';
import { toActorContext } from '../utils/requestContext';

export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  get = asyncHandler(async (_req: Request, res: Response) => {
    const result = this.settingsService.readSafe();
    res.json(result.body);
  }, 'Failed to read settings file.', {
    onError: (error, _req, res) => {
      if (error instanceof Error && 'statusCode' in error) {
        res.status(500).json({ error: 'Failed to read settings file.' });
        return true;
      }
      sendHttpError(res, error, 'Failed to read settings file.');
      return true;
    },
  });

  post = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.settingsService.writeSafe(
      (req.body || {}) as Record<string, unknown>,
      toActorContext(req, true),
    );
    res.json(result.body);
  }, 'Failed to write settings file.', {
    onError: (_error, _req, res) => {
      res.status(500).json({ error: 'Failed to write settings file.' });
      return true;
    },
  });

  getNodeSettings = asyncHandler(async (_req: Request, res: Response) => {
    res.json({ success: true as const, node: readNodeSettings(SETTINGS_PATH) });
  });

  putNodeSettings = asyncHandler(async (req: Request, res: Response) => {
    const node = mergeNodeSettings(SETTINGS_PATH, (req.body || {}) as Record<string, unknown>);
    res.json({ success: true as const, node });
  });

  getSecuritySettings = asyncHandler(async (_req: Request, res: Response) => {
    res.json({ success: true as const, security: readPlatformSecuritySettings(SETTINGS_PATH) });
  });

  putSecuritySettings = asyncHandler(async (req: Request, res: Response) => {
    const security = await updatePlatformSecuritySettings(
      SETTINGS_PATH,
      (req.body || {}) as { accessTokenSecret?: string; refreshTokenSecret?: string },
      toActorContext(req, true),
    );
    res.json({ success: true as const, security });
  });

  exportPlatform = asyncHandler(async (_req: Request, res: Response) => {
    const exportBundle = await exportAllPlatformBlobs();
    res.json({ success: true as const, export: exportBundle });
  });

  importPlatform = asyncHandler(async (req: Request, res: Response) => {
    const body = (req.body || {}) as { platform?: Record<string, unknown> };
    const platform = body.platform;
    if (!platform || typeof platform !== 'object') {
      res.status(400).json({ success: false, error: 'platform object is required.' });
      return;
    }
    const result = await importLegacyPlatformPayload(platform, toActorContext(req, true));
    res.json({ success: true as const, ...result });
  });

  getTransferCatalog = asyncHandler(async (_req: Request, res: Response) => {
    res.json({ success: true as const, catalog: PLATFORM_TRANSFER_CATALOG });
  });

  exportTransfer = asyncHandler(async (req: Request, res: Response) => {
    const sectionKeys = normalizeTransferSectionKeys((req.body || {}).sections);
    const exportBundle = await exportPlatformTransferBundle(sectionKeys);
    res.json({ success: true as const, export: exportBundle });
  });

  importTransfer = asyncHandler(async (req: Request, res: Response) => {
    const body = (req.body || {}) as { sections?: unknown; bundle?: unknown };
    const sectionKeys = normalizeTransferSectionKeys(body.sections);
    const result = await importPlatformTransferBundle(body.bundle, sectionKeys, toActorContext(req, true));
    res.json({ success: true as const, ...result });
  });
}
