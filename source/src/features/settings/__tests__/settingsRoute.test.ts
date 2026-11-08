import { describe, expect, it } from 'vitest';
import { SETTINGS_NAV_LANDING_SECTION } from '../../../shared/api/contracts/platform/mountConstants';
import {
  buildSettingsSectionRelativePath,
  DEFAULT_SETTINGS_SECTION,
  parseSettingsSectionSlug,
  resolveSettingsRouteSuffix,
  resolveSettingsSectionFromPathSuffix,
} from '../settingsRoute';

describe('settingsRoute', () => {
  it('parses known section slugs case-insensitively', () => {
    expect(parseSettingsSectionSlug('pwa')).toBe('pwa');
    expect(parseSettingsSectionSlug('PWA')).toBe('pwa');
    expect(parseSettingsSectionSlug('ai-models')).toBe('ai-models');
    expect(parseSettingsSectionSlug('mcp-servers')).toBe('mcp-servers');
    expect(parseSettingsSectionSlug('platform-transfer')).toBe('platform-transfer');
  });

  it('rejects unknown section slugs', () => {
    expect(parseSettingsSectionSlug('missing')).toBeNull();
    expect(parseSettingsSectionSlug('')).toBeNull();
  });

  it('resolves the default section when the path suffix is empty', () => {
    expect(DEFAULT_SETTINGS_SECTION).toBe(SETTINGS_NAV_LANDING_SECTION);
    expect(resolveSettingsSectionFromPathSuffix(undefined)).toBe('server-functions');
    expect(resolveSettingsSectionFromPathSuffix('')).toBe('server-functions');
  });

  it('resolves nested path suffixes to the first section segment', () => {
    expect(resolveSettingsSectionFromPathSuffix('pwa/extra')).toBe('pwa');
  });

  it('strips application and settings route prefixes from splat suffixes', () => {
    expect(resolveSettingsRouteSuffix('studio/settings')).toBeUndefined();
    expect(resolveSettingsRouteSuffix('studio/settings/pwa')).toBe('pwa');
    expect(resolveSettingsRouteSuffix('us/studio/settings/cultures')).toBe('cultures');
    expect(resolveSettingsRouteSuffix('settings/cache')).toBe('cache');
  });

  it('resolves sections from application remainder paths', () => {
    expect(resolveSettingsSectionFromPathSuffix('settings/pwa')).toBe('pwa');
    expect(resolveSettingsSectionFromPathSuffix('studio/settings/server-functions')).toBe('server-functions');
  });

  it('builds bookmarkable relative paths', () => {
    expect(buildSettingsSectionRelativePath('pwa')).toBe('settings/pwa');
    expect(buildSettingsSectionRelativePath('profile-fields')).toBe('settings/profile-fields');
  });

  it('includes the studio portal segment for culture mounts', () => {
    expect(buildSettingsSectionRelativePath('profile-fields', 'us')).toBe('studio/settings/profile-fields');
    expect(buildSettingsSectionRelativePath('pwa', 'ir')).toBe('studio/settings/pwa');
  });
});
