import { resolveCultureFromPathname } from '../../core/culture/CultureUrlResolver';
import { HAWIETY_PORTAL_SEGMENT, isHawietyRoutePattern } from '../../core/packages/hawietyPackage';
import { resolvePublishedDesignerNavigateTarget } from '../../domain/component-designer/resolvePublishedDesignerNavigateTarget';
import { resolvePortalShellFromPathname } from '../../app/platform/PortalUrlResolver';
import { getShellByKey } from '../../app/platform/platformConfigHelpers';
import type { PlatformRuntimeConfig } from '../api/contracts/platform/types';
import { STUDIO_MOUNT_ID, STUDIO_PORTAL_SEGMENT } from '../api/contracts/platform/mountConstants';
import { buildNavigationItemAbsolutePath } from './navigationItemPath';

export type ResolveStudioRelativeHrefOptions = {
  config?: PlatformRuntimeConfig;
  mountId?: string;
};

function parsePortalSegmentFromRemainder(remainderPath: string): string {
  const segments = remainderPath.replace(/^\/+/, '').split('/').filter(Boolean);
  if (segments.length === 0) {
    return STUDIO_PORTAL_SEGMENT;
  }
  const first = segments[0];
  if (first === STUDIO_PORTAL_SEGMENT) {
    return STUDIO_PORTAL_SEGMENT;
  }
  return first;
}

/** Preserve nested package portals (`/studio/hawiety/...`) when building personal inbox links. */
export function resolveActiveExperiencePortalSegment(
  pathname: string,
  config: PlatformRuntimeConfig,
  mountId: string = STUDIO_MOUNT_ID,
): string {
  const resolved = resolvePortalShellFromPathname(pathname, config, mountId);
  if (resolved.portalSegment !== STUDIO_PORTAL_SEGMENT) {
    return resolved.portalSegment;
  }

  const remainder = resolved.pageRemainderPath.replace(/^\/+/, '');
  if (!remainder) {
    return resolved.portalSegment;
  }

  const firstSegment = remainder.split('/')[0];
  const nestedShell = getShellByKey(config, firstSegment);
  if (nestedShell?.enabled && firstSegment !== STUDIO_PORTAL_SEGMENT) {
    return firstSegment;
  }

  if (isHawietyRoutePattern(remainder)) {
    return HAWIETY_PORTAL_SEGMENT;
  }

  return resolved.portalSegment;
}

function normalizeTargetRoute(target: string): string {
  const trimmed = target.trim();
  const fromStored = studioRouteRemainderFromHref(trimmed);
  if (fromStored) {
    return fromStored;
  }
  const cultureStudio = trimmed.match(/^\/[^/]+\/studio\/(.+)$/);
  if (cultureStudio) {
    return cultureStudio[1];
  }
  if (trimmed === '/studio' || trimmed.startsWith('/studio/')) {
    return trimmed.slice('/studio'.length).replace(/^\/+/, '');
  }
  return trimmed.replace(/^\/+/, '');
}

/**
 * Navigate to `target` without changing the active culture pack or portal segment.
 * Strips legacy `/studio` / `/us/studio/...` hrefs down to route patterns first.
 */
export function resolveStudioRelativeHref(
  pathname: string,
  target: string,
  options?: ResolveStudioRelativeHrefOptions,
): string {
  const trimmed = target.trim();
  if (
    trimmed.startsWith('/')
    && trimmed !== '/studio'
    && !/^\/(?:[^/]+\/)?studio(?:\/|$)/.test(trimmed)
  ) {
    return resolvePublishedDesignerNavigateTarget(trimmed, pathname);
  }

  const { cultureId, remainderPath } = resolveCultureFromPathname(pathname);
  const portalSegment = options?.config
    ? resolveActiveExperiencePortalSegment(pathname, options.config, options.mountId)
    : parsePortalSegmentFromRemainder(remainderPath);
  const routePattern = normalizeTargetRoute(trimmed);
  const queryIndex = routePattern.indexOf('?');
  const pathPart = queryIndex >= 0 ? routePattern.slice(0, queryIndex) : routePattern;
  const query = queryIndex >= 0 ? routePattern.slice(queryIndex) : '';

  const base = buildNavigationItemAbsolutePath({
    cultureId,
    portalSegment,
    routePattern: pathPart,
  });
  return query ? `${base}${query}` : base;
}

/** Strip a stored notification href to a studio route remainder when possible. */
export function studioRouteRemainderFromHref(href: string | null | undefined): string | null {
  if (!href?.trim()) return null;
  const trimmed = href.trim();
  const match = trimmed.match(/^(?:\/[^/]+)?\/studio\/(.+)$/);
  if (match) return match[1];
  if (trimmed.startsWith('/studio/')) return trimmed.slice('/studio/'.length);
  return null;
}
