import { getEnabledCulturePackIds } from '../../core/culture/CultureRegistry';
import {
  resolveDefaultMountRoute,
} from '../../app/platform/RootZonePage';
import {
  getShellByKey,
  resolveHomeShellRedirectPath,
} from '../../app/platform/platformConfigHelpers';
import { resolvePortalFromPathname } from '../../app/platform/PortalUrlResolver';
import type { PlatformRuntimeConfig } from '../../shared/api/contracts/platform/types';
import {
  DEFAULT_PORTAL_LOGO_URL,
  isAllowedPortalBrandLogoUrl,
  resolvePortalBrand,
  type ResolvedPortalBrand,
} from '../../shared/api/contracts/platform/portalBrand';
import { guessPortalSegmentFromPathname } from '../../shared/lib/portalBrandCache';
import { HWY_PLATFORM_PORTAL_BRAND_LOGO_URL } from '../../domain/hwy/hwyPlatformPortalBrandDefaults';
import { HWY_PUBLIC_PORTAL_SEGMENT } from '../../domain/hwy/selfRegistration/hwySelfRegistrationRoutes';

export type AuthLoginPortalBrand = ResolvedPortalBrand & {
  usesPortalLogo: boolean;
  portalSegment: string;
};

function normalizeAuthLoginReturnPath(returnTo: string): string {
  const trimmed = returnTo.trim() || '/';
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return '/';
  }
  return trimmed;
}

/** Path used to resolve Settings → Portals shell brand on `/login`. */
export function resolveAuthLoginBrandContextPath(
  returnTo: string,
  config: PlatformRuntimeConfig | undefined,
): string {
  const path = normalizeAuthLoginReturnPath(returnTo);

  if (!config) {
    return path;
  }

  if (path === '/') {
    const homeRedirect = resolveHomeShellRedirectPath(config);
    if (homeRedirect) {
      return homeRedirect;
    }
    const defaultRoute = resolveDefaultMountRoute(config).trim();
    if (defaultRoute && defaultRoute !== '/login') {
      return defaultRoute;
    }
    return path;
  }

  const segments = path.replace(/\/+$/, '').split('/').filter(Boolean);
  if (segments.length === 1 && getEnabledCulturePackIds().includes(segments[0])) {
    const homeRedirect = resolveHomeShellRedirectPath(config);
    if (homeRedirect) {
      return homeRedirect;
    }
  }

  return path;
}

function portalLogoIsCustom(logoUrl: string | null | undefined): boolean {
  const trimmed = logoUrl?.trim();
  if (!trimmed || trimmed === DEFAULT_PORTAL_LOGO_URL) {
    return false;
  }
  return isAllowedPortalBrandLogoUrl(trimmed);
}

function resolveShellBrandForLogin(
  config: PlatformRuntimeConfig,
  contextPath: string,
): { segment: string; brand: ResolvedPortalBrand } {
  const resolved = resolvePortalFromPathname(contextPath, config);
  const segment = guessPortalSegmentFromPathname(contextPath) || resolved.portalSegment;
  const shell = getShellByKey(config, resolved.shellKey)
    ?? getShellByKey(config, segment);
  const brand = resolvePortalBrand(shell?.brand, shell?.name);
  return { segment, brand };
}

export function resolveAuthLoginPortalBrand(
  returnTo: string,
  config: PlatformRuntimeConfig | undefined,
): AuthLoginPortalBrand {
  const contextPath = resolveAuthLoginBrandContextPath(returnTo, config);

  if (!config) {
    const brand = resolvePortalBrand(null);
    return {
      ...brand,
      usesPortalLogo: false,
      portalSegment: guessPortalSegmentFromPathname(contextPath) || 'home',
    };
  }

  const { segment, brand } = resolveShellBrandForLogin(config, contextPath);

  let resolvedBrand = brand;
  let usesPortalLogo = portalLogoIsCustom(brand.logoUrl);

  if (segment === HWY_PUBLIC_PORTAL_SEGMENT && !usesPortalLogo) {
    resolvedBrand = resolvePortalBrand({
      logoUrl: HWY_PLATFORM_PORTAL_BRAND_LOGO_URL,
      title: brand.title,
      windowTitle: brand.windowTitle,
      aboutTitle: brand.aboutTitle,
      aboutBody: brand.aboutBody,
    }, brand.title);
    usesPortalLogo = true;
  }

  return {
    ...resolvedBrand,
    usesPortalLogo,
    portalSegment: segment,
  };
}
