import { Router, type Express, type Request, type Response } from 'express';
import {
  buildDesignerExportFile,
  parseDesignerExportRequestBody,
} from '../domain/component-designer/export/exportDataFiles';
import { asyncHandler } from '../utils/asyncHandler';

export const mountDataExportRoutes = (app: Express): void => {
  const router = Router();

  router.post('/', asyncHandler(async (req: Request, res: Response) => {
    const parsed = parseDesignerExportRequestBody(req.body);
    const result = await buildDesignerExportFile(parsed);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename.replace(/"/g, '')}"`,
    );
    res.status(200).send(result.buffer);
  }, 'Failed to export data.', {
    onError: (error, _req, res) => {
      const message = error instanceof Error ? error.message : 'Failed to export data.';
      res.status(400).json({ success: false, error: message });
      return true;
    },
  }));

  app.use('/api/data-export', router);
};
