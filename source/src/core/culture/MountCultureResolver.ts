import type { CultureCalendarId, CulturePackExtension } from '../../shared/api/contracts/systemExtensions/types';
import type { MountExperienceConfig, PlatformMount } from '../../shared/api/contracts/platform/types';
import { DEFAULT_BUILTIN_CULTURE_PACKS } from '../../shared/api/contracts/platform/cultures';
import { buildCustomCulturePackAdapter } from './buildCustomCulturePackAdapter';
import {
  getDefaultCulturePackId,
  getEnabledCulturePackAdapters,
  getMasterCulturePackAdapter,
  resolveCulturePackAdapter,
} from './CultureRegistry';

export type ResolvedMountCulture = {
  cultureId: string;
  locale: string;
  language: string;
  calendar: CultureCalendarId;
  direction: 'ltr' | 'rtl';
  timezone?: string;
  extension: CulturePackExtension;
};

export function resolveMountCultureId(mount: PlatformMount): string {
  if (mount.cultureId?.trim()) {
    return mount.cultureId.trim();
  }

  return getDefaultCulturePackId();
}

function experienceConfigFromCulture(
  culture: ResolvedMountCulture,
): MountExperienceConfig {
  return {
    locale: culture.locale,
    calendar: culture.calendar,
    direction: culture.direction,
    timezone: culture.timezone,
  };
}

function resolveCulturePackAdapterOrBuiltin(cultureId: string) {
  const fromRegistry = resolveCulturePackAdapter(cultureId);
  if (fromRegistry) {
    return fromRegistry;
  }

  const builtinPack = DEFAULT_BUILTIN_CULTURE_PACKS.find((pack) => pack.id === cultureId);
  if (builtinPack) {
    return buildCustomCulturePackAdapter(builtinPack);
  }

  return getMasterCulturePackAdapter();
}

export function resolveCultureById(
  cultureId: string,
  timezoneOverride?: string,
): ResolvedMountCulture {
  const normalizedCultureId = cultureId.trim() || getDefaultCulturePackId();
  const adapter = resolveCulturePackAdapterOrBuiltin(normalizedCultureId);
  const extension = adapter.extension;
  const timezone = timezoneOverride?.trim() || extension.defaultTimezone;

  return {
    cultureId: extension.id,
    locale: extension.locale,
    language: extension.language,
    calendar: extension.calendar,
    direction: extension.direction,
    timezone,
    extension,
  };
}

export function resolveMountCulture(mount: PlatformMount): ResolvedMountCulture {
  return resolveCultureById(resolveMountCultureId(mount), mount.timezoneOverride);
}

function listEnabledMountCultureOptions(): Array<{ cultureId: string; label: string }> {
  return getEnabledCulturePackAdapters().map((adapter) => ({
    cultureId: adapter.extension.id,
    label: adapter.extension.label,
  }));
}
