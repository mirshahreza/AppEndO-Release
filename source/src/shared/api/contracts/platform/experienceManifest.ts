import type { PlatformRouteBindingAuth, PlatformRouteBindingNav } from './types';
import { defaultPortalBrand, parsePortalBrandField, type PortalBrand } from './portalBrand';
import {
  STUDIO_PORTAL_SEGMENT,
  SITE_PORTAL_SEGMENT,
  COMPONENT_ALONE_PORTAL_SEGMENT,
  HOME_SHELL_KEY,
  ROOT_PORTAL_SEGMENT,
  toPortalRelativePattern,
  toPortalRoutePattern,
} from './mountConstants';
import type { PortalEntryMode } from './types';
import { LATIN_SLUG_RE, validateLatinSlug } from '../../../lib/latinSlug';

export const EXPERIENCE_MANIFEST_SOURCE = 'experience-manifest' as const;

export const DEFAULT_EXPERIENCE_MANIFEST_ID = 'admin';

export type ExperienceManifestPage = {
  path: string;
  pageKey: string;
  loaderRef?: string;
  auth?: PlatformRouteBindingAuth | null;
  nav?: PlatformRouteBindingNav | null;
};

export type ExperienceManifestPortal = {
  segment: string;
  name: string;
  shellKey: string;
  /** Own shell layout, or redirect visitors to another portal root. */
  entryMode?: PortalEntryMode;
  /** Target portal segment when entryMode is redirect. */
  redirectToSegment?: string | null;
  /** Target culture pack id when entryMode is redirect. */
  redirectToCulture?: string | null;
  /**
   * Designer page loaderRef used as this portal's custom 404 page
   * (`folder/name` or pinned `folder/name@vN`). Null/empty → default RouteNotFoundPage.
   */
  notFoundPageRef?: string | null;
  /** Per-portal logo, title, and about copy. Null/omitted uses the AppEnd logo and default about copy. */
  brand?: PortalBrand | null;
  navigationRef?: string;
  /** Navigation manifest ids owned by this portal. */
  navigations?: string[];
  designPackId?: string;
  enabled: boolean;
  auth?: PlatformRouteBindingAuth | null;
  pages: ExperienceManifestPage[];
  /** Set when the portal shell is owned by an installed package. */
  ownerPackageId?: string;
  packageDisplayName?: string;
};

export type ExperienceManifest = {
  id: string;
  cultureId: string;
  portals: ExperienceManifestPortal[];
};

export type ExperienceManifestValidationResult =
  | { valid: true; manifest: ExperienceManifest }
  | { valid: false; errors: string[] };

export type ValidateExperienceManifestOptions = {
  /** Full manifests require home, studio, and component-alone. Package extensions do not. */
  requireBuiltInPortals?: boolean;
};

const ID_RE = /^[a-z][a-z0-9-]{1,63}$/;
/** Experience / platform pageKey: single slug segment (no folder slash). */
export const EXPERIENCE_PAGE_KEY_RE = /^[a-z][a-z0-9-]{1,63}$/;
const PAGE_KEY_RE = EXPERIENCE_PAGE_KEY_RE;

export function isValidExperiencePageKey(pageKey: string): boolean {
  return PAGE_KEY_RE.test(pageKey.trim());
}

/** Lowercase slug for operator-created portal URL segments (duplicate + create). */
export const PORTAL_SEGMENT_SLUG_RE = LATIN_SLUG_RE;

export function validatePortalSegmentSlug(segment: string): string | null {
  const slugError = validateLatinSlug(segment, { fieldLabel: 'URL segment' });
  if (slugError) {
    return slugError;
  }

  const trimmed = segment.trim();
  if (isBuiltInHomePortal({ segment: trimmed }) || isBuiltInStudioPortal({ segment: trimmed })) {
    return 'URL segment is reserved.';
  }

  if (isBuiltInComponentAlonePortal({ segment: trimmed })) {
    return 'URL segment is reserved.';
  }

  if (isBuiltInSitePortal({ segment: trimmed })) {
    return 'URL segment is reserved.';
  }

  return null;
}

export function normalizePortalPagePath(segment: string, path: string): string {
  const trimmed = String(path || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');
  const normalizedSegment = segment.trim();

  if (!trimmed) {
    return normalizedSegment === STUDIO_PORTAL_SEGMENT
      ? toPortalRoutePattern('')
      : normalizedSegment;
  }

  if (trimmed === normalizedSegment || trimmed.startsWith(`${normalizedSegment}/`)) {
    return trimmed;
  }

  if (normalizedSegment === STUDIO_PORTAL_SEGMENT) {
    return toPortalRoutePattern(trimmed);
  }

  return `${normalizedSegment}/${trimmed}`;
}

export function portalPageBindingPattern(segment: string, path: string): string {
  return toPortalRelativePattern(normalizePortalPagePath(segment, path));
}

export function experiencePageIdentityKey(segment: string, path: string, pageKey: string): string {
  return `${normalizePortalPagePath(segment, path)}::${pageKey.trim()}`;
}

export function defaultHomePortal(shellKey = HOME_SHELL_KEY): ExperienceManifestPortal {
  return {
    segment: ROOT_PORTAL_SEGMENT,
    name: 'Home',
    shellKey,
    entryMode: 'redirect',
    redirectToSegment: STUDIO_PORTAL_SEGMENT,
    redirectToCulture: 'us',
    enabled: true,
    pages: [],
  };
}

export function defaultStudioPortal(shellKey = STUDIO_PORTAL_SEGMENT): ExperienceManifestPortal {
  return {
    segment: STUDIO_PORTAL_SEGMENT,
    name: 'Studio',
    shellKey,
    entryMode: 'shell',
    navigationRef: STUDIO_PORTAL_SEGMENT,
    navigations: [STUDIO_PORTAL_SEGMENT],
    enabled: true,
    auth: { accessMode: 'authenticated', allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
    pages: [],
    brand: defaultPortalBrand(),
  };
}

export function defaultSitePortal(shellKey = SITE_PORTAL_SEGMENT): ExperienceManifestPortal {
  return {
    segment: SITE_PORTAL_SEGMENT,
    name: 'Site',
    shellKey,
    entryMode: 'shell',
    navigationRef: SITE_PORTAL_SEGMENT,
    navigations: [SITE_PORTAL_SEGMENT],
    enabled: true,
    auth: { accessMode: 'public', allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
    pages: [],
  };
}

export function defaultComponentAlonePortal(
  shellKey = COMPONENT_ALONE_PORTAL_SEGMENT,
): ExperienceManifestPortal {
  return {
    segment: COMPONENT_ALONE_PORTAL_SEGMENT,
    name: 'Component Alone',
    shellKey,
    entryMode: 'shell',
    enabled: true,
    auth: { accessMode: 'authenticated', allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
    pages: [],
  };
}

/** Platform registry row key and URL routing segment for a portal shell. */
export function resolvePortalRegistryKey(segment: string): string {
  if (isBuiltInHomePortal({ segment })) {
    return HOME_SHELL_KEY;
  }

  if (isBuiltInStudioPortal({ segment })) {
    return STUDIO_PORTAL_SEGMENT;
  }

  if (isBuiltInComponentAlonePortal({ segment })) {
    return COMPONENT_ALONE_PORTAL_SEGMENT;
  }

  if (isBuiltInSitePortal({ segment })) {
    return SITE_PORTAL_SEGMENT;
  }

  return segment.trim();
}

/** Designer layout component key under portal-layouts/{key}. */
export function resolvePortalLayoutKey(
  segment: string,
  shellKey?: string | null,
): string {
  if (isBuiltInHomePortal({ segment })) {
    return shellKey?.trim() || HOME_SHELL_KEY;
  }

  if (isBuiltInStudioPortal({ segment })) {
    return shellKey?.trim() || STUDIO_PORTAL_SEGMENT;
  }

  if (isBuiltInComponentAlonePortal({ segment })) {
    return shellKey?.trim() || COMPONENT_ALONE_PORTAL_SEGMENT;
  }

  if (isBuiltInSitePortal({ segment })) {
    return shellKey?.trim() || SITE_PORTAL_SEGMENT;
  }

  return shellKey?.trim() || segment.trim();
}

export function portalUsesRedirectEntry(
  portal: Pick<ExperienceManifestPortal, 'entryMode' | 'redirectToSegment' | 'redirectToCulture'>,
): boolean {
  return portal.entryMode === 'redirect'
    && Boolean(portal.redirectToSegment?.trim())
    && Boolean(portal.redirectToCulture?.trim());
}

/** Shell portals may own navigation manifests; redirect entry portals may not. */
export function portalSupportsNavigation(
  portal: Pick<ExperienceManifestPortal, 'entryMode' | 'redirectToSegment' | 'redirectToCulture'>,
): boolean {
  return !portalUsesRedirectEntry(portal);
}

export function isBuiltInStudioPortal(portal: Pick<ExperienceManifestPortal, 'segment'>): boolean {
  return portal.segment.trim() === STUDIO_PORTAL_SEGMENT;
}

export function isBuiltInComponentAlonePortal(
  portal: Pick<ExperienceManifestPortal, 'segment'>,
): boolean {
  return portal.segment.trim() === COMPONENT_ALONE_PORTAL_SEGMENT;
}

export function isBuiltInHomePortal(portal: Pick<ExperienceManifestPortal, 'segment'>): boolean {
  return portal.segment.trim() === ROOT_PORTAL_SEGMENT;
}

export function isBuiltInSitePortal(portal: Pick<ExperienceManifestPortal, 'segment'>): boolean {
  return portal.segment.trim() === SITE_PORTAL_SEGMENT;
}

export function isBuiltInPortal(portal: Pick<ExperienceManifestPortal, 'segment'>): boolean {
  return isBuiltInHomePortal(portal)
    || isBuiltInStudioPortal(portal)
    || isBuiltInComponentAlonePortal(portal);
}

/** Operator-grid built-ins (studio, component-alone). Home `/` is excluded. */
export function isOperatorHiddenBuiltinPortal(
  portal: Pick<ExperienceManifestPortal, 'segment'>,
): boolean {
  return isBuiltInStudioPortal(portal) || isBuiltInComponentAlonePortal(portal);
}

export function enforceBuiltInPortals(
  incoming: ExperienceManifest,
  authoritative: ExperienceManifest,
): ExperienceManifest {
  const authoritativeHome = authoritative.portals.find((portal) =>
    isBuiltInHomePortal(portal))
    ?? defaultHomePortal();
  const incomingHome = incoming.portals.find((portal) =>
    isBuiltInHomePortal(portal));
  const homePortal = incomingHome
    ? {
      ...incomingHome,
      segment: authoritativeHome.segment,
    }
    : authoritativeHome;

  const authoritativeStudio = authoritative.portals.find((portal) =>
    isBuiltInStudioPortal(portal))
    ?? defaultStudioPortal();
  const incomingStudio = incoming.portals.find((portal) =>
    isBuiltInStudioPortal(portal));
  const studioPortal = incomingStudio
    ? {
      ...incomingStudio,
      segment: authoritativeStudio.segment,
      shellKey: authoritativeStudio.shellKey,
    }
    : authoritativeStudio;

  const authoritativeComponentAlone = authoritative.portals.find((portal) =>
    isBuiltInComponentAlonePortal(portal))
    ?? defaultComponentAlonePortal();
  const incomingComponentAlone = incoming.portals.find((portal) =>
    isBuiltInComponentAlonePortal(portal));
  const componentAlonePortal = incomingComponentAlone
    ? {
      ...incomingComponentAlone,
      segment: authoritativeComponentAlone.segment,
      shellKey: authoritativeComponentAlone.shellKey,
    }
    : authoritativeComponentAlone;

  const additionalPortals = incoming.portals.filter(
    (portal) => !isBuiltInPortal(portal),
  );

  return {
    ...incoming,
    portals: [homePortal, studioPortal, componentAlonePortal, ...additionalPortals],
  };
}

export function formatPortalUrlSegment(segment: string): string {
  const normalized = segment.trim();
  if (!normalized || normalized === ROOT_PORTAL_SEGMENT) {
    return '/';
  }

  if (normalized === STUDIO_PORTAL_SEGMENT) {
    return `/${STUDIO_PORTAL_SEGMENT}`;
  }

  return `/${normalized}`;
}

function validatePortalPages(
  pages: unknown,
  segment: string,
  errors: string[],
  pathPrefix: string,
): ExperienceManifestPage[] | null {
  if (!Array.isArray(pages)) {
    errors.push(`${pathPrefix}pages must be an array.`);
    return null;
  }

  const seen = new Set<string>();
  const normalized: ExperienceManifestPage[] = [];

  pages.forEach((page, index) => {
    if (!page || typeof page !== 'object' || Array.isArray(page)) {
      errors.push(`${pathPrefix}pages[${index}] must be an object.`);
      return;
    }

    const item = page as Record<string, unknown>;
    if (typeof item.path !== 'string') {
      errors.push(`${pathPrefix}pages[${index}].path must be a string.`);
      return;
    }

    if (typeof item.pageKey !== 'string' || !PAGE_KEY_RE.test(item.pageKey.trim())) {
      errors.push(`${pathPrefix}pages[${index}].pageKey must match ^[a-z][a-z0-9-]{1,63}$.`);
      return;
    }

    const identity = experiencePageIdentityKey(segment, item.path, item.pageKey);
    if (seen.has(identity)) {
      errors.push(`${pathPrefix}pages[${index}] duplicates path/pageKey pair "${identity}".`);
      return;
    }
    seen.add(identity);

    if (item.loaderRef !== undefined && item.loaderRef !== null && typeof item.loaderRef !== 'string') {
      errors.push(`${pathPrefix}pages[${index}].loaderRef must be a string when provided.`);
      return;
    }

    normalized.push({
      path: normalizePortalPagePath(segment, item.path),
      pageKey: String(item.pageKey).trim(),
      loaderRef: item.loaderRef == null ? undefined : String(item.loaderRef).trim(),
      auth: item.auth == null ? null : item.auth as PlatformRouteBindingAuth,
      nav: item.nav == null ? null : item.nav as PlatformRouteBindingNav,
    });
  });

  return normalized;
}

function isAllowedPortalRedirectTarget(
  target: string,
  portals: ExperienceManifestPortal[],
  allowBuiltInTargets: boolean,
): boolean {
  if (portals.some((item) => item.segment === target && item.enabled)) {
    return true;
  }

  if (!allowBuiltInTargets) {
    return false;
  }

  return isBuiltInHomePortal({ segment: target })
    || isBuiltInStudioPortal({ segment: target })
    || isBuiltInComponentAlonePortal({ segment: target })
    || isBuiltInSitePortal({ segment: target });
}

export function validatePackageExtensionPortals(
  manifestId: string,
  rawPortals: unknown[],
): ExperienceManifestValidationResult {
  return validateExperienceManifest(
    { id: manifestId, cultureId: 'us', portals: rawPortals },
    { requireBuiltInPortals: false },
  );
}

export function validateExperienceManifest(
  raw: unknown,
  options?: ValidateExperienceManifestOptions,
): ExperienceManifestValidationResult {
  const requireBuiltInPortals = options?.requireBuiltInPortals ?? true;
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, errors: ['Experience manifest must be a JSON object.'] };
  }

  const record = raw as Record<string, unknown>;

  if (typeof record.id !== 'string' || !ID_RE.test(record.id.trim())) {
    errors.push('id must match ^[a-z][a-z0-9-]{1,63}$.');
  }

  if (typeof record.cultureId !== 'string' || !ID_RE.test(record.cultureId.trim())) {
    errors.push('cultureId must match ^[a-z][a-z0-9-]{1,63}$.');
  }

  if (!Array.isArray(record.portals) || record.portals.length === 0) {
    errors.push('portals must be a non-empty array.');
  }

  const portals: ExperienceManifestPortal[] = [];
  const seenSegments = new Set<string>();

  if (Array.isArray(record.portals)) {
    record.portals.forEach((portal, index) => {
      const pathPrefix = `portals[${index}].`;

      if (!portal || typeof portal !== 'object' || Array.isArray(portal)) {
        errors.push(`${pathPrefix}must be an object.`);
        return;
      }

      const item = portal as Record<string, unknown>;

      if (typeof item.segment !== 'string' || !PORTAL_SEGMENT_SLUG_RE.test(item.segment.trim())) {
        errors.push(`${pathPrefix}segment must use lowercase letters, numbers, dash, dot, and underscore only.`);
        return;
      }

      const segment = item.segment.trim();
      if (!requireBuiltInPortals && isBuiltInPortal({ segment })) {
        errors.push(`${pathPrefix}segment "${segment}" is reserved for built-in portals.`);
        return;
      }
      if (seenSegments.has(segment)) {
        errors.push(`${pathPrefix}segment "${segment}" is duplicated.`);
        return;
      }
      seenSegments.add(segment);

      if (typeof item.name !== 'string' || !item.name.trim()) {
        errors.push(`${pathPrefix}name must be a non-empty string.`);
        return;
      }

      const entryMode = item.entryMode == null ? 'shell' : item.entryMode;
      if (entryMode !== 'shell' && entryMode !== 'redirect') {
        errors.push(`${pathPrefix}entryMode must be "shell" or "redirect".`);
        return;
      }

      const shellKey = resolvePortalLayoutKey(
        segment,
        typeof item.shellKey === 'string' ? item.shellKey : null,
      );

      if (entryMode === 'redirect') {
        if (typeof item.redirectToSegment !== 'string' || !ID_RE.test(item.redirectToSegment.trim())) {
          errors.push(`${pathPrefix}redirectToSegment must match ^[a-z][a-z0-9-]{1,63}$ when entryMode is redirect.`);
          return;
        }
        if (typeof item.redirectToCulture !== 'string' || !ID_RE.test(item.redirectToCulture.trim())) {
          errors.push(`${pathPrefix}redirectToCulture must match ^[a-z][a-z0-9-]{1,63}$ when entryMode is redirect.`);
          return;
        }
        if (item.redirectToSegment.trim() === segment) {
          errors.push(`${pathPrefix}redirectToSegment must reference a different portal segment.`);
          return;
        }
      }

      if (item.navRenderer !== undefined && item.navRenderer !== null) {
        errors.push(`${pathPrefix}navRenderer is no longer supported. Place a platform navigation component in the shell layout instead.`);
        return;
      }

      if (entryMode === 'shell' && item.navigationRef !== undefined && item.navigationRef !== null) {
        if (typeof item.navigationRef !== 'string' || !PORTAL_SEGMENT_SLUG_RE.test(item.navigationRef.trim())) {
          errors.push(`${pathPrefix}navigationRef must use lowercase letters, numbers, dash, dot, and underscore only.`);
          return;
        }
      }

      let navigations: string[] | undefined;
      if (item.navigations !== undefined && item.navigations !== null) {
        if (!Array.isArray(item.navigations)) {
          errors.push(`${pathPrefix}navigations must be an array when provided.`);
          return;
        }
        const seenNavIds = new Set<string>();
        navigations = [];
        for (const [navIndex, navId] of item.navigations.entries()) {
          if (typeof navId !== 'string' || !PORTAL_SEGMENT_SLUG_RE.test(navId.trim())) {
            errors.push(`${pathPrefix}navigations[${navIndex}] must use lowercase letters, numbers, dash, dot, and underscore only.`);
            return;
          }
          const normalizedNavId = navId.trim();
          if (seenNavIds.has(normalizedNavId)) {
            errors.push(`${pathPrefix}navigations[${navIndex}] duplicates id "${normalizedNavId}".`);
            return;
          }
          seenNavIds.add(normalizedNavId);
          navigations.push(normalizedNavId);
        }
      }

      if (item.designPackId !== undefined && item.designPackId !== null) {
        if (typeof item.designPackId !== 'string' || !item.designPackId.trim()) {
          errors.push(`${pathPrefix}designPackId must be a non-empty string when provided.`);
          return;
        }
      }

      let brand: PortalBrand | null | undefined;
      if (item.brand !== undefined) {
        const parsedBrand = parsePortalBrandField(item.brand);
        if (!parsedBrand.ok) {
          errors.push(`${pathPrefix}${parsedBrand.error}`);
          return;
        }
        brand = parsedBrand.brand;
      }

      let notFoundPageRef: string | null = null;
      if (entryMode === 'shell' && item.notFoundPageRef !== undefined && item.notFoundPageRef !== null) {
        if (typeof item.notFoundPageRef !== 'string' || !item.notFoundPageRef.trim()) {
          errors.push(`${pathPrefix}notFoundPageRef must be a non-empty designer loaderRef when provided.`);
          return;
        }
        const trimmedRef = item.notFoundPageRef.trim();
        if (!/^[a-z0-9][a-z0-9._/@-]*$/i.test(trimmedRef) || !trimmedRef.includes('/')) {
          errors.push(`${pathPrefix}notFoundPageRef must be a designer component path (folder/name).`);
          return;
        }
        notFoundPageRef = trimmedRef;
      }

      if (typeof item.enabled !== 'boolean') {
        errors.push(`${pathPrefix}enabled must be a boolean.`);
        return;
      }

      if (item.auth !== undefined && item.auth !== null) {
        if (typeof item.auth !== 'object' || Array.isArray(item.auth)) {
          errors.push(`${pathPrefix}auth must be an object when provided.`);
          return;
        }

        const authRecord = item.auth as Record<string, unknown>;
        if (authRecord.roles !== undefined) {
          if (!Array.isArray(authRecord.roles)
            || !authRecord.roles.every((role) => typeof role === 'string' && role.trim().length > 0)) {
            errors.push(`${pathPrefix}auth.roles must be an array of non-empty strings when provided.`);
            return;
          }
        }
      }

      const pages = entryMode === 'redirect'
        ? []
        : validatePortalPages(item.pages, segment, errors, pathPrefix);
      if (pages === null) {
        return;
      }

      portals.push({
        segment,
        name: String(item.name).trim(),
        shellKey,
        entryMode,
        redirectToSegment: entryMode === 'redirect'
          ? String(item.redirectToSegment).trim()
          : null,
        redirectToCulture: entryMode === 'redirect'
          ? String(item.redirectToCulture).trim()
          : null,
        notFoundPageRef: entryMode === 'shell' ? notFoundPageRef : null,
        ...(brand !== undefined ? { brand: entryMode === 'shell' ? brand : null } : {}),
        navigationRef: entryMode === 'shell' && item.navigationRef != null
          ? String(item.navigationRef).trim()
          : undefined,
        navigations: entryMode === 'shell' ? navigations : undefined,
        designPackId: entryMode === 'shell' && item.designPackId != null
          ? String(item.designPackId).trim()
          : undefined,
        enabled: item.enabled,
        auth: entryMode === 'shell' && item.auth != null ? item.auth as PlatformRouteBindingAuth : null,
        pages,
      });
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  if (requireBuiltInPortals) {
    if (!portals.some((portal) => isBuiltInHomePortal(portal))) {
      errors.push(`portals must include the built-in "${ROOT_PORTAL_SEGMENT}" portal.`);
      return { valid: false, errors };
    }

    if (!portals.some((portal) => isBuiltInStudioPortal(portal))) {
      errors.push(`portals must include the built-in "${STUDIO_PORTAL_SEGMENT}" portal.`);
      return { valid: false, errors };
    }

    if (!portals.some((portal) => isBuiltInComponentAlonePortal(portal))) {
      errors.push(`portals must include the built-in "${COMPONENT_ALONE_PORTAL_SEGMENT}" portal.`);
      return { valid: false, errors };
    }
  }

  for (const portal of portals) {
    if (portalUsesRedirectEntry(portal)) {
      const target = portal.redirectToSegment?.trim();
      if (!target || !isAllowedPortalRedirectTarget(target, portals, !requireBuiltInPortals)) {
        errors.push(`portals segment "${portal.segment}" redirectToSegment must reference an enabled portal.`);
        return { valid: false, errors };
      }
    }
  }

  return {
    valid: true,
    manifest: {
      id: String(record.id).trim(),
      cultureId: String(record.cultureId).trim(),
      portals,
    },
  };
}
