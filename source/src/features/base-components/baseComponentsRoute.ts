import { STUDIO_MOUNT_ID, toPortalRoutePattern } from '../../shared/api/contracts/platform/mountConstants';
import type { SectionId } from './types';
import {
  BASE_COMPONENTS_NAV_SECTIONS,
  BASE_COMPONENTS_SECTIONS,
} from './baseComponentsSections';

export const DEFAULT_BASE_COMPONENTS_SECTION: SectionId = BASE_COMPONENTS_NAV_SECTIONS[0]?.id ?? 'dialog';

const BASE_COMPONENTS_SECTION_IDS = new Set<SectionId>(BASE_COMPONENTS_SECTIONS.map((section) => section.id));

/** Retired slugs — bookmarks land on the successor section. */
const BASE_COMPONENTS_SECTION_ALIASES: Record<string, SectionId> = {
  'form-fields': 'text-fields',
  'grid-paging': 'grid',
};

export function isBaseComponentsSectionId(value: string): value is SectionId {
  return BASE_COMPONENTS_SECTION_IDS.has(value as SectionId);
}

export function parseBaseComponentsSectionSlug(raw: string | undefined): SectionId | null {
  const slug = raw?.trim().toLowerCase() ?? '';
  if (!slug) {
    return null;
  }

  const aliased = BASE_COMPONENTS_SECTION_ALIASES[slug];
  if (aliased) {
    return aliased;
  }

  return isBaseComponentsSectionId(slug) ? slug : null;
}

/** Strip mount/application prefixes and the `baseComponents` route segment from a raw splat suffix. */
export function resolveBaseComponentsRouteSuffix(rawSuffix: string | undefined): string | undefined {
  const segments = rawSuffix?.split('/').filter(Boolean) ?? [];
  if (segments.length === 0) {
    return undefined;
  }

  const baseComponentsIndex = segments.lastIndexOf('base-components');
  if (baseComponentsIndex >= 0) {
    const afterBaseComponents = segments.slice(baseComponentsIndex + 1);
    return afterBaseComponents.length > 0 ? afterBaseComponents.join('/') : undefined;
  }

  return segments.join('/');
}

export function resolveBaseComponentsSectionFromPathSuffix(pathSuffix: string | undefined): SectionId {
  const routeSuffix = resolveBaseComponentsRouteSuffix(pathSuffix);
  return parseBaseComponentsSectionSlug(routeSuffix?.split('/').filter(Boolean)[0]) ?? DEFAULT_BASE_COMPONENTS_SECTION;
}

export function buildBaseComponentsSectionRelativePath(
  sectionId: SectionId,
  mountId: string = STUDIO_MOUNT_ID,
): string {
  const sectionPath = `base-components/${sectionId}`;
  if (mountId === STUDIO_MOUNT_ID) {
    return sectionPath;
  }

  return toPortalRoutePattern(sectionPath);
}
