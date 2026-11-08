import type { Request } from 'express';
import { WEB_FONTS_PLATFORM_ASSETS_URL_PREFIX } from '../../shared/lib/platformWebFonts';

export const getRequestPathname = (req: Request): string => (
  (req.originalUrl || req.url || '').split('?')[0] || ''
);

export const isApiRequestPath = (pathname: string): boolean => pathname === '/api' || pathname.startsWith('/api/');

const isPwaRuntimePath = (pathname: string): boolean => pathname === '/manifest.webmanifest';

const isPwaPlatformAssetsPath = (pathname: string): boolean =>
  pathname === '/assets/platform/pwa' || pathname.startsWith('/assets/platform/pwa/');

const isWorkspaceAssetsPath = (pathname: string): boolean =>
  pathname === '/assets/workspace' || pathname.startsWith('/assets/workspace/');

const isWebFontsPlatformAssetsPath = (pathname: string): boolean =>
  pathname === WEB_FONTS_PLATFORM_ASSETS_URL_PREFIX
  || pathname.startsWith(`${WEB_FONTS_PLATFORM_ASSETS_URL_PREFIX}/`);

export const shouldBypassSpaDevMiddleware = (req: Request): boolean => {
  const pathname = getRequestPathname(req);
  return isApiRequestPath(pathname)
    || isPwaRuntimePath(pathname)
    || isWorkspaceAssetsPath(pathname)
    || isPwaPlatformAssetsPath(pathname)
    || isWebFontsPlatformAssetsPath(pathname);
};
