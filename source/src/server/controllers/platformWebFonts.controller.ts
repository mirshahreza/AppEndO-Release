import type { Request, Response } from 'express';
import type { PlatformWebFontsService } from '../services/platform/platformWebFonts.service';
import { asyncHandler } from '../utils/asyncHandler';

export class PlatformWebFontsController {
  constructor(private readonly service: PlatformWebFontsService) {}

  listFonts = asyncHandler(async (_req: Request, res: Response) => {
    const config = this.service.listFonts();
    res.json({ success: true, fonts: config.fonts });
  }, 'Failed to load platform web fonts.');

  uploadFont = asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, error: 'No file uploaded. Send a font file as multipart field "file".' });
      return;
    }

    const label = typeof req.body?.label === 'string' ? req.body.label : '';
    const family = typeof req.body?.family === 'string' ? req.body.family : '';
    const packagePolicy = typeof req.body?.packagePolicy === 'string' ? req.body.packagePolicy : undefined;
    const licenseName = typeof req.body?.licenseName === 'string' ? req.body.licenseName : undefined;
    const licenseUrl = typeof req.body?.licenseUrl === 'string' ? req.body.licenseUrl : undefined;
    const licenseNotice = typeof req.body?.licenseNotice === 'string' ? req.body.licenseNotice : undefined;

    const result = this.service.uploadFont(file.originalname, file.buffer, {
      label,
      family,
      packagePolicy,
      licenseName,
      licenseUrl,
      licenseNotice,
    });
    if ('error' in result) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, font: result.font });
  }, 'Failed to upload web font.');

  updateFontScript = asyncHandler(async (req: Request, res: Response) => {
    const script = req.body?.script;
    const result = this.service.updateFontScript(String(req.params.fontId ?? ''), script);
    if ('error' in result) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, font: result.font });
  }, 'Failed to update web font script.');

  deleteFont = asyncHandler(async (req: Request, res: Response) => {
    const result = this.service.deleteFont(String(req.params.fontId ?? ''));
    if ('error' in result) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true });
  }, 'Failed to delete web font.');
}
