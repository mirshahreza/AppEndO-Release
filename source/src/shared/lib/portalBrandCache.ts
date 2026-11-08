import type { PlatformShell } from '../api/contracts/platform/types';
import {
  isAllowedPortalBrandLogoUrl,
  normalizePortalBrand,
  resolvePortalBrand,
  type ResolvedPortalBrand,
} from '../api/contracts/platform/portalBrand';
import { HWY_PLATFORM_PORTAL_BRAND_LOGO_URL } from '../../domain/hwy/hwyPlatformPortalBrandDefaults';
import { HWY_PUBLIC_PORTAL_SEGMENT } from '../../domain/hwy/selfRegistration/hwySelfRegistrationRoutes';
import { shouldReplaceHawietyRegistryDocumentTitle } from '../../domain/hwy/selfRegistration/hwyPublicPortalCultureChrome';
import { resolvePortalSegmentBootDocumentTitle } from '../../domain/hwy/hwyPortalBootDocumentTitle';

export const PORTAL_BRAND_CACHE_KEY = 'appendo-portal-brand-v1';

export type CachedPortalBrand = {
  logoUrl?: string;
  title?: string;
  windowTitle?: string;
};

type PortalBrandCacheMap = Record<string, CachedPortalBrand>;

function readCacheMap(): PortalBrandCacheMap {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(PORTAL_BRAND_CACHE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const next: PortalBrandCacheMap = {};
    for (const [segment, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!segment.trim() || !value || typeof value !== 'object' || Array.isArray(value)) {
        continue;
      }
      const record = value as Record<string, unknown>;
      const logoUrl = typeof record.logoUrl === 'string' ? record.logoUrl.trim() : '';
      const title = typeof record.title === 'string' ? record.title.trim() : '';
      const windowTitle = typeof record.windowTitle === 'string' ? record.windowTitle.trim() : '';
      const safeLogo = logoUrl && isAllowedPortalBrandLogoUrl(logoUrl) ? logoUrl.split('?')[0] : undefined;
      const safeTitle = title && !title.includes('<') ? title.slice(0, 80) : undefined;
      const safeWindowTitle = windowTitle && !windowTitle.includes('<') ? windowTitle.slice(0, 80) : undefined;
      if (!safeLogo && !safeTitle && !safeWindowTitle) {
        continue;
      }
      next[segment.trim()] = {
        ...(safeLogo ? { logoUrl: safeLogo } : {}),
        ...(safeTitle ? { title: safeTitle } : {}),
        ...(safeWindowTitle ? { windowTitle: safeWindowTitle } : {}),
      };
    }
    return next;
  } catch {
    return {};
  }
}

function resolveCachedPortalTitle(
  segment: string,
  pathname: string,
  registryTitle?: string | null,
  registryWindowTitle?: string | null,
): string | undefined {
  return resolvePortalSegmentBootDocumentTitle(segment, pathname, registryTitle, registryWindowTitle);
}

export function guessPortalSegmentFromPathname(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) {
    return 'home';
  }

  if (parts.length === 1) {
    return parts[0] === 'login' || parts[0] === 'install' || parts[0] === 'register'
      ? ''
      : 'home';
  }

  const hawietyIdx = parts.indexOf('hawiety');
  if (hawietyIdx !== -1) {
    return 'hawiety';
  }

  return parts[1] ?? 'home';
}

/** Seed localStorage from Settings → Portals shell identity (logo/title) for boot loading. */
export function primePortalBrandCacheFromShells(shells: PlatformShell[] | null | undefined): void {
  if (!shells?.length) {
    return;
  }

  for (const shell of shells) {
    const segment = shell.shellKey?.trim();
    if (!segment) {
      continue;
    }

    const normalized = normalizePortalBrand(shell.brand);
    if (!normalized?.logoUrl && !normalized?.title) {
      continue;
    }

    const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
    const resolved = resolvePortalBrand(shell.brand, shell.name);
    const title = resolveCachedPortalTitle(
      segment,
      pathname,
      resolved.title,
      resolved.windowTitle,
    );

    cachePortalBrand(segment, {
      logoUrl: normalized.logoUrl ?? undefined,
      title,
      windowTitle: resolved.windowTitle,
    });
  }
}

export function readCachedPortalBrand(segment: string): CachedPortalBrand | null {
  const trimmed = segment.trim();
  if (!trimmed) {
    return null;
  }

  return readCacheMap()[trimmed] ?? null;
}

export function readCachedPortalBrandForPathname(pathname: string): CachedPortalBrand | null {
  return readCachedPortalBrand(guessPortalSegmentFromPathname(pathname));
}

/** Loading surfaces — Settings → Portals shell brand first, then localStorage cache. */
export function resolvePortalLoadingBrandForPathname(
  pathname: string,
  shells?: PlatformShell[] | null,
): CachedPortalBrand | null {
  const segment = guessPortalSegmentFromPathname(pathname);
  if (!segment) {
    return null;
  }

  if (shells?.length) {
    const shell = shells.find((item) => item.shellKey?.trim() === segment);
    if (shell) {
      const resolved = resolvePortalBrand(shell.brand, shell.name);
      const title = resolveCachedPortalTitle(
        segment,
        pathname,
        resolved.title,
        resolved.windowTitle,
      );
      return {
        logoUrl: resolved.logoUrl,
        title,
        windowTitle: resolved.windowTitle,
      };
    }
  }

  const cached = readCachedPortalBrand(segment);
  if (cached) {
    return cached;
  }

  if (segment === HWY_PUBLIC_PORTAL_SEGMENT) {
    return { logoUrl: HWY_PLATFORM_PORTAL_BRAND_LOGO_URL };
  }

  return null;
}

export function cachePortalBrand(segment: string, brand: ResolvedPortalBrand | CachedPortalBrand | null): void {
  if (typeof window === 'undefined') {
    return;
  }

  const trimmed = segment.trim();
  if (!trimmed) {
    return;
  }

  const map = readCacheMap();
  const logoUrl = brand?.logoUrl?.trim();
  const windowTitleRaw = brand && 'windowTitle' in brand
    ? (brand as ResolvedPortalBrand).windowTitle?.trim()
    : undefined;
  let title = brand?.title?.trim();
  if (typeof window !== 'undefined') {
    const bootTitle = resolvePortalSegmentBootDocumentTitle(
      trimmed,
      window.location.pathname,
      title,
      windowTitleRaw,
    );
    if (bootTitle?.trim()) {
      title = bootTitle;
    } else if (trimmed === HWY_PUBLIC_PORTAL_SEGMENT && title && shouldReplaceHawietyRegistryDocumentTitle(title)) {
      title = '';
    }
  }
  const safeLogo = logoUrl && isAllowedPortalBrandLogoUrl(logoUrl) ? logoUrl.split('?')[0] : undefined;
  const safeTitle = title && !title.includes('<') ? title.slice(0, 80) : undefined;
  const safeWindowTitle = windowTitleRaw && !windowTitleRaw.includes('<') ? windowTitleRaw.slice(0, 80) : undefined;

  if (!safeLogo && !safeTitle && !safeWindowTitle) {
    if (!(trimmed in map)) {
      return;
    }
    delete map[trimmed];
  } else {
    map[trimmed] = {
      ...(safeLogo ? { logoUrl: safeLogo } : {}),
      ...(safeTitle ? { title: safeTitle } : {}),
      ...(safeWindowTitle ? { windowTitle: safeWindowTitle } : {}),
    };
  }

  try {
    window.localStorage.setItem(PORTAL_BRAND_CACHE_KEY, JSON.stringify(map));
  } catch {
    // Quota / private mode — loading still works with the built-in mark.
  }
}
