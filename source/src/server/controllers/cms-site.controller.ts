import type { Request, Response } from 'express';
import type { CmsPublicContentService } from '../services/cms-site/cmsPublicContent.service';
import { asyncHandler } from '../utils/asyncHandler';

const readLanguage = (req: Request): string | undefined => {
  const value = req.query.language;
  return typeof value === 'string' ? value : undefined;
};

const applyCache = (res: Response, ttlSeconds: number): void => {
  res.setHeader('Cache-Control', `public, max-age=${Math.max(0, ttlSeconds)}`);
};

export class CmsSiteController {
  constructor(private readonly service: CmsPublicContentService) {}

  getPublicSite = asyncHandler(async (req: Request, res: Response) => {
    const payload = await this.service.getPublicSite(readLanguage(req));
    applyCache(res, payload.cacheTtlSeconds);
    res.json({ success: true, ...payload });
  }, 'Failed to load the public site.');

  getBySlug = asyncHandler(async (req: Request, res: Response) => {
    const slug = typeof req.params.slug === 'string' ? req.params.slug : '';
    const item = await this.service.getPublishedBySlug(slug, readLanguage(req));
    applyCache(res, 300);
    res.json({ success: true, item });
  }, 'Failed to load published content.');

  getPublicAsset = asyncHandler(async (req: Request, res: Response) => {
    const assetId = typeof req.params.id === 'string' ? req.params.id : '';
    const variant = req.query.variant === 'xs' ? 'xs' : 'full';
    const asset = await this.service.getPublishedAsset(assetId, variant);
    applyCache(res, 3600);
    res.setHeader('Content-Disposition', `inline; filename="${asset.fileName.replace(/"/g, '')}"`);
    res.type(asset.mime);
    res.send(asset.bytes);
  }, 'Failed to load site image.');
}
