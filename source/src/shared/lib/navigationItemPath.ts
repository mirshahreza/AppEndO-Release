import {
  buildMountAbsolutePath,
  buildPortalRootPath,
  normalizeRoutePatternForNavPath,
  withNavLandingPath,
} from '../../app/platform/platformConfigHelpers';
import {
  ROOT_PORTAL_SEGMENT,
  STUDIO_PORTAL_SEGMENT,
  toPortalRelativePattern,
  toPortalRoutePattern,
} from '../api/contracts/platform/mountConstants';

function normalizePortalSegment(portalSegment: string): string {
  const trimmed = portalSegment.trim();
  return trimmed || STUDIO_PORTAL_SEGMENT;
}

function pageRemainderForPortal(portalSegment: string, routePattern: string): string {
  const portal = normalizePortalSegment(portalSegment);
  const normalized = normalizeRoutePatternForNavPath(routePattern);

  if (!normalized) {
    return '';
  }

  if (normalized === portal) {
    return '';
  }

  if (normalized.startsWith(`${portal}/`)) {
    return normalized.slice(portal.length + 1);
  }

  if (portal === STUDIO_PORTAL_SEGMENT) {
    return toPortalRelativePattern(toPortalRoutePattern(normalized));
  }

  return normalized;
}

/** Build an absolute SPA path for a navigation item target. */
export function buildNavigationItemAbsolutePath(input: {
  cultureId: string;
  portalSegment: string;
  routePattern: string;
}): string {
  const cultureId = input.cultureId.trim();
  const portalSegment = normalizePortalSegment(input.portalSegment);
  const culturePrefix = `/${cultureId}`;
  const portalRoot = buildPortalRootPath(culturePrefix, portalSegment);
  const pageRemainder = pageRemainderForPortal(portalSegment, input.routePattern);

  if (portalSegment === ROOT_PORTAL_SEGMENT) {
    return portalRoot;
  }

  return buildMountAbsolutePath(portalRoot, withNavLandingPath(pageRemainder));
}

/** Store studio-relative route patterns in navigation manifests (`users`, not `studio/users`). */
export function toNavigationManifestRoutePattern(routePattern: string): string {
  return toPortalRelativePattern(toPortalRoutePattern(routePattern));
}
