import { resolveCultureFromPathname } from '../../core/culture/CultureUrlResolver';
import { getDefaultCulturePackId, getEnabledCulturePackIds } from '../../core/culture/CultureRegistry';
import {
  STUDIO_PORTAL_SEGMENT,
  LEGACY_ADMIN_ROUTE_NAMESPACE,
  STUDIO_MOUNT_ID,
} from '../../shared/api/contracts/platform/mountConstants';
import {
  LIBRARIES_ROUTE_PATTERN,
  PACKAGE_MANAGER_ROUTE_PATTERN,
  PLATFORM_PORTALS_ROUTE_PATTERN,
} from '../../shared/api/contracts/platform/studioPageSeeds';
import type { PlatformRuntimeConfig } from '../../shared/api/contracts/platform/types';
import { getShellByKey, resolveShellRuleForPath } from './platformConfigHelpers';
import { canonicalizeDesignerItemSlug } from '../../shared/lib/designerComponentPath';

function normalizeSegments(path: string): string[] {
  return path.replace(/^\/+/, '').split('/').filter(Boolean);
}

function resolveMountIdForLegacyRedirect(pathname: string): string {
  const segments = normalizeSegments(pathname);
  const enabledCultureIds = new Set(getEnabledCulturePackIds());

  if (segments.length > 0 && enabledCultureIds.has(segments[0])) {
    return segments[0];
  }

  return STUDIO_MOUNT_ID;
}

function isDesignerShellRulePath(
  config: PlatformRuntimeConfig,
  pathname: string,
  mountId: string,
): boolean {
  const rule = resolveShellRuleForPath(config, mountId, pathname);
  if (!rule) {
    return false;
  }

  const shell = getShellByKey(config, rule.shellKey);
  return shell?.enabled === true && shell.surface === 'designer';
}

function buildCanonicalApplicationPath(cultureId: string, routeAfterApplication: string[]): string {
  const portalBase = `/${cultureId}/${STUDIO_PORTAL_SEGMENT}`;

  if (routeAfterApplication.length === 0) {
    return portalBase;
  }

  return `${portalBase}/${routeAfterApplication.join('/')}`;
}

function pathnameHasExplicitCulture(pathname: string): boolean {
  const segments = normalizeSegments(pathname);
  if (segments.length === 0) {
    return false;
  }

  return getEnabledCulturePackIds().includes(segments[0]);
}

/**
 * Redirects legacy p-34 admin-namespace URLs to canonical culture + studio application paths.
 */
export function resolveLegacyAdminCanonicalRedirect(
  pathname: string,
  _config: PlatformRuntimeConfig,
): string | null {
  const { cultureId, remainderPath } = resolveCultureFromPathname(pathname);
  const segments = normalizeSegments(remainderPath);

  if (segments.length === 0 || segments[0] !== LEGACY_ADMIN_ROUTE_NAMESPACE) {
    return null;
  }

  return buildCanonicalApplicationPath(cultureId, segments.slice(1));
}

/**
 * Redirects bare `/studio/*` URLs (no culture prefix) to `/{culture}/studio/*`.
 * Designer shell-rule paths keep their legacy mount host without redirect.
 */
export function resolveBareStudioCultureRedirect(
  pathname: string,
  config: PlatformRuntimeConfig,
): string | null {
  if (pathnameHasExplicitCulture(pathname)) {
    return null;
  }

  const { cultureId, remainderPath } = resolveCultureFromPathname(pathname);
  const segments = normalizeSegments(remainderPath);

  if (segments.length === 0 || segments[0] !== STUDIO_PORTAL_SEGMENT) {
    return null;
  }

  const mountId = resolveMountIdForLegacyRedirect(pathname);
  if (isDesignerShellRulePath(config, pathname, mountId)) {
    return null;
  }

  return buildCanonicalApplicationPath(cultureId, segments.slice(1));
}

const LEGACY_STUDIO_PAGE_ALIASES: Record<string, string> = {
  edge: 'server-functions',
  'edge-functions': 'server-functions',
  applications: PLATFORM_PORTALS_ROUTE_PATTERN,
  sandbox: 'base-components',
  'file-hub': 'sftp',
  'ssh-hub': 'ssh',
  'rdp-hub': 'rdp',
};

/**
 * Redirects retired studio page URL segments to canonical slugs (edge → server-functions, applications → portals).
 */
export function resolveLegacyStudioPageAliasRedirect(pathname: string): string | null {
  const { cultureId, remainderPath } = resolveCultureFromPathname(pathname);
  const segments = normalizeSegments(remainderPath);
  if (segments.length === 0) {
    return null;
  }

  let pageSegment: string | null = null;
  let trailingSegments: string[] = [];

  if (segments[0] === STUDIO_PORTAL_SEGMENT) {
    if (segments.length < 2) {
      return null;
    }

    pageSegment = segments[1];
    trailingSegments = segments.slice(2);
  } else if (segments.length === 1) {
    pageSegment = segments[0];
    trailingSegments = [];
  } else {
    return null;
  }

  if (pageSegment === 'workflows' && trailingSegments.length > 0) {
    if (trailingSegments[0] === 'edit') {
      return null;
    }

    return buildCanonicalApplicationPath(
      cultureId,
      ['workflows', 'edit', ...trailingSegments],
    );
  }

  if (pageSegment === 'workflow-designer' && trailingSegments.length > 0) {
    return buildCanonicalApplicationPath(
      cultureId,
      ['workflows', 'edit', ...trailingSegments],
    );
  }

  if (pageSegment === 'server-functions' && trailingSegments.length > 0) {
    if (trailingSegments[0] === 'edit') {
      return null;
    }

    return buildCanonicalApplicationPath(
      cultureId,
      ['server-functions', 'edit', ...trailingSegments],
    );
  }

  if (pageSegment === 'data-studio' && trailingSegments.length > 0) {
    if (trailingSegments[0] === 'edit') {
      return null;
    }

    return buildCanonicalApplicationPath(
      cultureId,
      ['data-studio', 'edit', ...trailingSegments],
    );
  }

  if (pageSegment === 'extensions' && trailingSegments.length > 0) {
    const nestedPage = trailingSegments[0];
    if (nestedPage === PACKAGE_MANAGER_ROUTE_PATTERN || nestedPage === LIBRARIES_ROUTE_PATTERN) {
      return buildCanonicalApplicationPath(cultureId, [
        nestedPage,
        ...trailingSegments.slice(1),
      ]);
    }
  }

  if (pageSegment === 'client-components' && trailingSegments.length > 0) {
    const itemSegments = trailingSegments[0] === 'edit' || trailingSegments[0] === 'live-designer'
      ? trailingSegments.slice(1)
      : trailingSegments;

    if (trailingSegments[0] === 'edit' && (itemSegments.length === 0 || itemSegments.length === 1)) {
      return null;
    }

    if (itemSegments.length === 0) {
      return null;
    }

    const itemSlug = itemSegments.join('/');
    const canonicalItem = itemSlug === 'new' ? 'new' : canonicalizeDesignerItemSlug(itemSlug);
    if (!canonicalItem) {
      return null;
    }

    if (
      trailingSegments[0] === 'edit'
      && itemSegments.length === 1
      && itemSegments[0] === canonicalItem
    ) {
      return null;
    }

    return buildCanonicalApplicationPath(
      cultureId,
      ['client-components', 'edit', canonicalItem],
    );
  }

  const canonicalPageSegment = LEGACY_STUDIO_PAGE_ALIASES[pageSegment];
  if (!canonicalPageSegment) {
    return null;
  }

  return buildCanonicalApplicationPath(
    cultureId,
    [canonicalPageSegment, ...trailingSegments],
  );
}

/**
 * Redirects mistyped culture prefixes (`/ux/studio/...`) to the default culture route.
 * React Router only registers enabled culture ids, so invalid prefixes would otherwise 404.
 */
export function resolveInvalidCulturePrefixRedirect(pathname: string): string | null {
  const segments = normalizeSegments(pathname);
  if (segments.length < 2) {
    return null;
  }

  const firstSegment = segments[0];
  const enabledCultureIds = new Set(getEnabledCulturePackIds());
  if (enabledCultureIds.has(firstSegment)) {
    return null;
  }

  if (firstSegment.length !== 2 || segments[1] !== STUDIO_PORTAL_SEGMENT) {
    return null;
  }

  return `/${getDefaultCulturePackId()}/${segments.slice(1).join('/')}`;
}

export function resolveLegacyRoutingRedirect(
  pathname: string,
  config: PlatformRuntimeConfig,
): string | null {
  return resolveInvalidCulturePrefixRedirect(pathname)
    ?? resolveLegacyAdminCanonicalRedirect(pathname, config)
    ?? resolveBareStudioCultureRedirect(pathname, config)
    ?? resolveLegacyStudioPageAliasRedirect(pathname);
}
