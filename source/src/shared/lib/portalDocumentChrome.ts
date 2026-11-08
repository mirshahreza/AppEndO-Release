import {
  DEFAULT_PORTAL_LOGO_URL,
  isAllowedPortalBrandLogoUrl,
} from '../api/contracts/platform/portalBrand';
import { HWY_PUBLIC_PORTAL_SEGMENT } from '../../domain/hwy/selfRegistration/hwySelfRegistrationRoutes';
import { HWY_PLATFORM_PORTAL_BRAND_LOGO_URL } from '../../domain/hwy/hwyPlatformPortalBrandDefaults';

import { guessPortalSegmentFromPathname } from './portalBrandCache';

const PORTAL_FAVICON_TYPE_BY_EXT: Record<string, string> = {
  png: 'image/png',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
};

function resolveLinkType(pathOnly: string): string | undefined {
  const ext = pathOnly.split('.').pop()?.toLowerCase();
  if (!ext) {
    return undefined;
  }
  return PORTAL_FAVICON_TYPE_BY_EXT[ext];
}

export function resolvePortalDocumentFaviconUrl(logoUrl: string | null | undefined): string | null {
  const trimmed = logoUrl?.trim().split('?')[0];
  if (!trimmed || trimmed === DEFAULT_PORTAL_LOGO_URL) {
    return null;
  }
  if (!isAllowedPortalBrandLogoUrl(trimmed)) {
    return null;
  }
  return trimmed;
}

export function resolveHawietyPublicPortalFaviconUrl(logoUrl: string | null | undefined): string {
  return resolvePortalDocumentFaviconUrl(logoUrl) ?? HWY_PLATFORM_PORTAL_BRAND_LOGO_URL;
}

/** Browser tab / PWA shortcut icons for portal-owned routes (Settings → Portals logo or Hawiety bundled mark). */
export function applyPortalDocumentFavicon(logoUrl: string): void {
  if (typeof document === 'undefined') {
    return;
  }

  const pathOnly = logoUrl.trim().split('?')[0];
  if (!pathOnly || !isAllowedPortalBrandLogoUrl(pathOnly)) {
    return;
  }

  document.head
    .querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]')
    .forEach((node) => node.remove());

  const type = resolveLinkType(pathOnly);

  const iconLink = document.createElement('link');
  iconLink.rel = 'icon';
  iconLink.href = pathOnly;
  if (type) {
    iconLink.type = type;
  }
  document.head.appendChild(iconLink);

  const touchLink = document.createElement('link');
  touchLink.rel = 'apple-touch-icon';
  touchLink.href = pathOnly;
  document.head.appendChild(touchLink);
}

export function isPortalOwnedDocumentChrome(pathname: string): boolean {
  return guessPortalSegmentFromPathname(pathname) === HWY_PUBLIC_PORTAL_SEGMENT;
}
