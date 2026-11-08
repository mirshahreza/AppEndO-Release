import type { Request, Response } from 'express';
import type { PwaService } from '../services/pwa.service';
import {
  deletePwaIcon,
  parsePwaIconSlot,
  writePwaIcon,
} from '../services/pwaAssets.service';
import { resolvePwaIconFilePath } from '../services/pwaIconAsset.service';
import { isAllowedPwaIconAssetUrl } from '../../shared/api/contracts/settings/pwa';
import { asyncHandler } from '../utils/asyncHandler';

export class PwaController {
  constructor(private readonly pwaService: PwaService) {}

  getConfig = asyncHandler(async (_req: Request, res: Response) => {
    res.json(this.pwaService.readConfig());
  });

  getManifest = asyncHandler(async (_req: Request, res: Response) => {
    const config = this.pwaService.readConfig();
    if (!config.enabled) {
      res.status(404).json({ error: 'PWA is disabled.' });
      return;
    }

    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.json(this.pwaService.buildManifest(config));
  });

  getIconFile = asyncHandler(async (req: Request, res: Response) => {
    const slot = parsePwaIconSlot(String(req.params.slot ?? ''));
    if (!slot) {
      res.status(404).json({ error: 'Invalid PWA icon slot.' });
      return;
    }

    const overrideUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    if (overrideUrl && !isAllowedPwaIconAssetUrl(overrideUrl)) {
      res.status(400).json({ error: 'Invalid PWA icon URL.' });
      return;
    }

    const filePath = resolvePwaIconFilePath(
      this.pwaService.readConfig(),
      slot,
      overrideUrl || undefined,
    );
    if (!filePath) {
      res.status(404).json({ error: 'PWA icon file not found.' });
      return;
    }

    res.setHeader('Cache-Control', 'private, no-cache');
    res.sendFile(filePath);
  });

  uploadIcon = asyncHandler(async (req: Request, res: Response) => {
    const slot = parsePwaIconSlot(String(req.params.slot ?? ''));
    if (!slot) {
      res.status(400).json({ success: false, error: 'Invalid PWA icon slot. Use 32, 192, 512, or maskable.' });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, error: 'No file uploaded. Send an image as multipart field "file".' });
      return;
    }

    const result = writePwaIcon(slot, file.originalname, file.buffer);
    if (!result.ok) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, slot, url: result.url });
  });

  deleteIcon = asyncHandler(async (req: Request, res: Response) => {
    const slot = parsePwaIconSlot(String(req.params.slot ?? ''));
    if (!slot) {
      res.status(400).json({ success: false, error: 'Invalid PWA icon slot. Use 32, 192, 512, or maskable.' });
      return;
    }

    const result = deletePwaIcon(slot);
    if (!result.ok) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, slot });
  });
}
