import { SETTINGS_NAV_LANDING_SECTION, STUDIO_MOUNT_ID, toPortalRoutePattern } from '../../shared/api/contracts/platform/mountConstants';
import type { SectionId } from './types';
import { SETTINGS_SECTIONS } from './settingsSections';

export const DEFAULT_SETTINGS_SECTION: SectionId = SETTINGS_NAV_LANDING_SECTION;

const SETTINGS_SECTION_IDS = new Set<SectionId>(SETTINGS_SECTIONS.map((section) => section.id));

function isSettingsSectionId(value: string): value is SectionId {
  return SETTINGS_SECTION_IDS.has(value as SectionId);
}

export function parseSettingsSectionSlug(raw: string | undefined): SectionId | null {
  const slug = raw?.trim().toLowerCase() ?? '';
  if (!slug) {
    return null;
  }

  return isSettingsSectionId(slug) ? slug : null;
}

/** Strip mount/application prefixes and the `settings` route segment from a raw splat suffix. */
export function resolveSettingsRouteSuffix(rawSuffix: string | undefined): string | undefined {
  const segments = rawSuffix?.split('/').filter(Boolean) ?? [];
  if (segments.length === 0) {
    return undefined;
  }

  const settingsIndex = segments.lastIndexOf('settings');
  if (settingsIndex >= 0) {
    const afterSettings = segments.slice(settingsIndex + 1);
    return afterSettings.length > 0 ? afterSettings.join('/') : undefined;
  }

  return segments.join('/');
}

export function resolveSettingsSectionFromPathSuffix(pathSuffix: string | undefined): SectionId {
  const routeSuffix = resolveSettingsRouteSuffix(pathSuffix);
  return parseSettingsSectionSlug(routeSuffix?.split('/').filter(Boolean)[0]) ?? DEFAULT_SETTINGS_SECTION;
}

export function buildSettingsSectionRelativePath(
  sectionId: SectionId,
  mountId: string = STUDIO_MOUNT_ID,
): string {
  const sectionPath = `settings/${sectionId}`;
  if (mountId === STUDIO_MOUNT_ID) {
    return sectionPath;
  }

  return toPortalRoutePattern(sectionPath);
}
