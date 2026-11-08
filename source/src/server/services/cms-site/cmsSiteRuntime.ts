import { isPluginRuntimeEnabled } from '../../domain/package-domain/installStateRepository';
import { PUBLIC_SITE_PACKAGE_ID } from '../../../shared/api/contracts/platform/mountConstants';
import type { NextFunction, Request, Response } from 'express';

export function isCmsRuntimeEnabled(): boolean {
  return isPluginRuntimeEnabled(PUBLIC_SITE_PACKAGE_ID);
}

export function requireCmsPackage(_req: Request, res: Response, next: NextFunction): void {
  if (!isCmsRuntimeEnabled()) {
    res.status(404).json({ success: false, error: 'API route not found.' });
    return;
  }
  next();
}
