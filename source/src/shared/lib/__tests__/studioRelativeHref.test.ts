import { describe, expect, it } from 'vitest';
import { bootstrapCultureRegistry } from '../../../core/culture/CultureRegistry';
import type { PlatformRuntimeConfig } from '../../api/contracts/platform/types';
import {
  resolveActiveExperiencePortalSegment,
  resolveStudioRelativeHref,
  studioRouteRemainderFromHref,
} from '../studioRelativeHref';

describe('resolveStudioRelativeHref', () => {
  it('keeps culture and studio portal on iq/studio', () => {
    expect(resolveStudioRelativeHref('/iq/studio/dashboard', 'my-inbox')).toBe('/iq/studio/my-inbox');
    expect(resolveStudioRelativeHref('/iq/studio/dashboard', 'my-inbox?workItemId=3')).toBe(
      '/iq/studio/my-inbox?workItemId=3',
    );
  });

  it('rewrites legacy /us/studio hrefs to the active culture, not us', () => {
    expect(resolveStudioRelativeHref('/iq/studio/dashboard', '/studio/my-messages')).toBe('/iq/studio/my-messages');
    expect(resolveStudioRelativeHref('/iq/studio/dashboard', '/us/studio/feedback?ticket=1')).toBe(
      '/iq/studio/feedback?ticket=1',
    );
  });

  it('does not switch portal when the current URL is a non-studio portal', () => {
    expect(resolveStudioRelativeHref('/iq/hawiety/members-all', 'my-inbox')).toBe('/iq/hawiety/my-inbox');
    expect(resolveStudioRelativeHref('/iq/hawiety/members-all', '/us/studio/feedback?ticket=9')).toBe(
      '/iq/hawiety/feedback?ticket=9',
    );
  });

  it('preserves nested hawiety portal under studio mount when config is provided', () => {
    bootstrapCultureRegistry(['iq']);
    const config = {
      version: 'application-v1',
      mounts: [],
      shells: [
        {
          shellKey: 'studio',
          name: 'Studio',
          entry: 'core:AdminLayout',
          surface: 'studio',
          enabled: true,
        },
        {
          shellKey: 'hawiety',
          name: 'Hawiety',
          entry: 'core:AdminLayout',
          surface: 'studio',
          enabled: true,
        },
      ],
      shellRules: [],
      pageModules: [],
      bindings: [],
      navigations: [],
    } as unknown as PlatformRuntimeConfig;

    expect(resolveActiveExperiencePortalSegment('/iq/studio/hawiety/members-all', config, 'studio')).toBe('hawiety');
    expect(
      resolveStudioRelativeHref('/iq/studio/hawiety/members-all', 'my-inbox', { config, mountId: 'studio' }),
    ).toBe('/iq/hawiety/my-inbox');
  });
});

describe('studioRouteRemainderFromHref', () => {
  it('extracts route remainder from stored hrefs', () => {
    expect(studioRouteRemainderFromHref('/us/studio/my-feedback?ticket=2')).toBe('my-feedback?ticket=2');
    expect(studioRouteRemainderFromHref('/studio/my-inbox')).toBe('my-inbox');
  });
});
