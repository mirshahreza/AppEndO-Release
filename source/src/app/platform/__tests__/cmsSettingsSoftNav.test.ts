import { describe, expect, it } from 'vitest';
import {
  isCmsSettingsPublishedComponentPath,
  isCmsSettingsSectionPath,
  isCmsSettingsSoftNavigation,
} from '../cmsSettingsSoftNav';

describe('cmsSettingsSoftNav', () => {
  it('detects CMS Settings section paths with culture prefixes', () => {
    expect(isCmsSettingsSectionPath('/us/studio/cms/settings')).toBe(true);
    expect(isCmsSettingsSectionPath('/us/studio/cms/settings/content-tags')).toBe(true);
    expect(isCmsSettingsSectionPath('/studio/cms/settings/statuses')).toBe(true);
    expect(isCmsSettingsSectionPath('/us/studio/cms/contents')).toBe(false);
    expect(isCmsSettingsSectionPath('/us/studio/settings')).toBe(false);
  });

  it('soft-nav only when both from and to are settings sections', () => {
    expect(isCmsSettingsSoftNavigation(
      '/us/studio/cms/settings',
      '/us/studio/cms/settings/content-tags',
    )).toBe(true);
    expect(isCmsSettingsSoftNavigation(
      '/us/studio/cms/contents',
      '/us/studio/cms/settings',
    )).toBe(false);
    expect(isCmsSettingsSoftNavigation(
      '/us/studio/cms/settings',
      '/us/studio/cms/comments',
    )).toBe(false);
  });

  it('recognizes published CMS Settings component paths', () => {
    expect(isCmsSettingsPublishedComponentPath('cms/cms-settings')).toBe(true);
    expect(isCmsSettingsPublishedComponentPath('cms/cms-vocab-languages')).toBe(true);
    expect(isCmsSettingsPublishedComponentPath('cms/cms-contents-list')).toBe(false);
  });
});
