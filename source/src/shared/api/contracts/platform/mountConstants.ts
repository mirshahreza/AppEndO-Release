export const STUDIO_MOUNT_ID = 'studio';

/** Core layout entry for the built-in Studio application (AdminLayout). */
export const BUILT_IN_STUDIO_SHELL_ENTRY = 'core:AdminLayout' as const;

/** Designer component name for the built-in public website shell. */
export const SITE_SHELL_LAYOUT_KEY = 'site-shell' as const;

/** Portal shell entry for the built-in public website (Client Components shell). */
export const BUILT_IN_SITE_SHELL_ENTRY = 'designer:portal-layouts/site-shell' as const;

/** Former core React layout — resolver still accepts it and maps to site-shell. */
export const LEGACY_CORE_SITE_SHELL_ENTRY = 'core:SiteLayout' as const;

/** Core layout entry for the built-in Component Alone preview application. */
export const BUILT_IN_COMPONENT_ALONE_SHELL_ENTRY = 'core:ComponentAlone' as const;

/** Canonical shell key for the built-in root (`/`) redirect application. */
export const HOME_SHELL_KEY = 'home-shell';

/** Canonical URL segment for the built-in root redirect application (`/`). */
export const ROOT_PORTAL_SEGMENT = 'home';

/** Canonical URL segment for portal routing (`/us/studio/...`). */
export const STUDIO_PORTAL_SEGMENT = 'studio';

/** Canonical URL segment for the built-in public CMS website (`/us/site/...`). */
export const SITE_PORTAL_SEGMENT = 'site';

/** Shipped CMS page keys that belong to the Site portal — boot must not restore them after Site is deleted. */
export const SITE_PORTAL_PAGE_KEYS = ['cms-site-home', 'cms-site-article'] as const;

/**
 * Extension package that owns the public home site while installed.
 * Uninstall restores `home-shell` to the shipped Studio redirect.
 */
export const PUBLIC_SITE_PACKAGE_ID = 'cms';

/** Studio page key + default catalog section for the Base Components nav landing. */
export const BASE_COMPONENTS_PAGE_KEY = 'base-components';
export const BASE_COMPONENTS_NAV_LANDING_SECTION = 'crud-set';

/** Studio page key + default catalog section for the Settings nav landing. */
export const SETTINGS_PAGE_KEY = 'settings';
export const SETTINGS_NAV_LANDING_SECTION = 'server-functions';

/** Built-in preview-only portal segment (`/us/component-alone/...`). */
export const COMPONENT_ALONE_PORTAL_SEGMENT = 'component-alone';

/** Legacy URL segment from p-34 (`/admin/*` → redirect to `/{culture}/studio/*`). */
export const LEGACY_ADMIN_ROUTE_NAMESPACE = 'admin';

export const EXPERIENCE_ROUTE_SOURCE = 'studio-sync' as const;

function normalizeRoutePatternSegment(routePattern: string): string {
  return routePattern.replace(/^\/+/, '').replace(/\/+$/, '');
}

/** Maps a studio mount route pattern to the equivalent culture-mount pattern (`studio/users`). */
export function toPortalRoutePattern(studioRoutePattern: string): string {
  const normalized = normalizeRoutePatternSegment(studioRoutePattern);
  if (!normalized) {
    return STUDIO_PORTAL_SEGMENT;
  }

  if (
    normalized === STUDIO_PORTAL_SEGMENT
    || normalized.startsWith(`${STUDIO_PORTAL_SEGMENT}/`)
  ) {
    return normalized;
  }

  return `${STUDIO_PORTAL_SEGMENT}/${normalized}`;
}

/** Canonical identity for deduplicating studio + culture route bindings. */
export function portalBindingIdentityKey(routePattern: string, pageKey: string): string {
  return `${toPortalRoutePattern(routePattern)}::${pageKey}`;
}

/** Maps a culture-mount route pattern back to the studio mount equivalent. */
export function toPortalRelativePattern(portalRoutePattern: string): string {
  const normalized = normalizeRoutePatternSegment(portalRoutePattern);
  if (normalized === STUDIO_PORTAL_SEGMENT) {
    return '';
  }

  const portalPrefix = `${STUDIO_PORTAL_SEGMENT}/`;
  if (normalized.startsWith(portalPrefix)) {
    return normalized.slice(portalPrefix.length);
  }

  return normalized;
}
