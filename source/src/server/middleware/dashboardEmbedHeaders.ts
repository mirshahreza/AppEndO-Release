import type { Request, Response } from 'express';
import { parseDashboardEmbedRequest } from '../../shared/lib/dashboardCanvas';
import { readDashboardSnapshot, readPageAccess } from '../services/dashboard-canvas/dashboardCanvas.service';
import { applyDashboardFramePolicy } from './securityHeaders.middleware';

type HeaderResponse = Pick<Response, 'setHeader' | 'removeHeader'>;

export { applyDashboardFramePolicy };

const resolveEmbedPageId = async (urlOrPath: string): Promise<string | null> => {
  const parsed = parseDashboardEmbedRequest(urlOrPath);
  if (parsed.pageId) {
    return parsed.pageId;
  }
  if (!parsed.snapshotId) {
    return null;
  }
  const snapshot = await readDashboardSnapshot(parsed.snapshotId);
  return snapshot.pageId;
};

export const applyDashboardEmbedHeadersForHtml = async (
  req: Pick<Request, 'originalUrl' | 'url'>,
  res: HeaderResponse,
): Promise<void> => {
  const urlOrPath = req.originalUrl || req.url || '';
  const parsed = parseDashboardEmbedRequest(urlOrPath);
  if (!parsed.needsFramePolicy) {
    return;
  }
  try {
    const pageId = await resolveEmbedPageId(urlOrPath);
    if (!pageId) {
      return;
    }
    const access = await readPageAccess(pageId);
    applyDashboardFramePolicy(res, access?.embedAllowedOrigins);
  } catch {
    // Keep the default SAMEORIGIN clickjacking headers.
  }
};

export const sendSpaIndexHtml = async (
  req: Request,
  res: Response,
  indexPath: string,
): Promise<void> => {
  res.setHeader('Cache-Control', 'no-store');
  await applyDashboardEmbedHeadersForHtml(req, res);
  res.sendFile(indexPath);
};
