import { describe, expect, it } from 'vitest';

import { DEFAULT_PLATFORM_ROUTE_LOADING_CONFIG } from '../constants';
import {
  normalizePlatformRouteLoadingConfig,
  resolveEffectiveRouteLoadingExperience,
} from '../normalizers';

describe('routeLoading normalizers', () => {
  it('returns defaults for invalid input', () => {
    expect(normalizePlatformRouteLoadingConfig(null)).toEqual(DEFAULT_PLATFORM_ROUTE_LOADING_CONFIG);
  });

  it('merges embedded overrides for embedded variant only', () => {
    const config = normalizePlatformRouteLoadingConfig({
      ...DEFAULT_PLATFORM_ROUTE_LOADING_CONFIG,
      progressStyle: 'ecg',
      embedded: { progressStyle: 'simple-line', logoSize: 'compact' },
    });

    const fullscreen = resolveEffectiveRouteLoadingExperience(config, 'fullscreen');
    const embedded = resolveEffectiveRouteLoadingExperience(config, 'embedded');

    expect(fullscreen.progressStyle).toBe('ecg');
    expect(embedded.progressStyle).toBe('simple-line');
    expect(embedded.logoSize).toBe('compact');
  });

  it('honors activity-first stack order', () => {
    const config = normalizePlatformRouteLoadingConfig({
      ...DEFAULT_PLATFORM_ROUTE_LOADING_CONFIG,
      stackOrder: 'activity-first',
    });
    expect(resolveEffectiveRouteLoadingExperience(config, 'fullscreen').stackOrder).toBe('activity-first');
  });
});
