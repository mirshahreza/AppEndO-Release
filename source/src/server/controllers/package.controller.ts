import type { Request, Response } from 'express';
import type { PackageFunctionExportRequest } from '../../shared/api/contracts/package/functionExport';
import type { PackageInstallPreviewRequest } from '../../shared/api/contracts/package/artifactPreview';
import {
  buildPackageFunctionExport,
  previewPackageFunctionExport,
} from '../services/package/packageFunctionExport.service';
import {
  buildBundleDownloadPlan,
  previewPluginInstall,
  previewZipImport,
} from '../services/package/packageArtifactPreview.service';
import { asyncHandler } from '../utils/asyncHandler';

export class PackageController {
  previewFunctionExport = asyncHandler(async (req: Request, res: Response) => {
    const built = previewPackageFunctionExport((req.body || {}) as PackageFunctionExportRequest);
    if (!built.ok) {
      res.status(400).json({
        success: false,
        error: built.error,
        details: built.details,
      });
      return;
    }

    res.json({
      success: true,
      preview: built.preview,
      manifest: built.manifest,
    });
  }, 'Failed to preview function package export.');

  exportFunctions = asyncHandler(async (req: Request, res: Response) => {
    const built = buildPackageFunctionExport((req.body || {}) as PackageFunctionExportRequest);
    if (!built.ok) {
      res.status(400).json({
        success: false,
        error: built.error,
        details: built.details,
      });
      return;
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${built.fileName}"`);
    res.send(built.buffer);
  }, 'Failed to export function package.');

  previewImport = asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded. Send a .zip file as multipart field "file".' });
      return;
    }

    const overridePolicy = typeof req.body?.overridePolicy === 'string'
      ? JSON.parse(req.body.overridePolicy)
      : req.body?.overridePolicy;

    const preview = previewZipImport(req.file.buffer, req.file.originalname, {
      targetDataSource: typeof req.body?.targetDataSource === 'string' ? req.body.targetDataSource : undefined,
      overridePolicy: typeof overridePolicy === 'object' && overridePolicy !== null
        ? overridePolicy
        : undefined,
    });

    res.json({ success: true, preview });
  }, 'Failed to preview ZIP import.');

  previewInstall = asyncHandler(async (req: Request, res: Response) => {
    const built = previewPluginInstall((req.body || {}) as PackageInstallPreviewRequest);
    if (!built.ok) {
      res.status(404).json({
        success: false,
        error: built.error,
        details: built.details,
      });
      return;
    }

    res.json({ success: true, preview: built.preview });
  }, 'Failed to preview package install.');

  bundleDownloadPlan = asyncHandler(async (req: Request, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const built = buildBundleDownloadPlan({
      packageId: typeof body.packageId === 'string' ? body.packageId : undefined,
      packageVersion: typeof body.packageVersion === 'string' ? body.packageVersion : undefined,
    });

    if (!built.ok) {
      res.status(404).json({ success: false, error: built.error });
      return;
    }

    res.json({ success: true, plan: built.plan });
  }, 'Failed to build bundle download plan.');
}
