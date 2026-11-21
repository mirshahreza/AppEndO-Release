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

  it('upgrades v1 config and drops removed keys', () => {
    const config = normalizePlatformRouteLoadingConfig({
      version: 1,
      showLogo: true,
      logoSize: 'large',
      logoGlow: true,
      logoBreathe: false,
      stackOrder: 'activity-first',
      progressStyle: 'ecg',
      embedded: { progressStyle: 'simple-line', logoSize: 'compact' },
    });

    expect(config.version).toBe(2);
    expect(config.logoSize).toBe('large');
    expect(config.logoBreathe).toBe(false);
    expect(config).not.toHaveProperty('progressStyle');
    expect(config).not.toHaveProperty('stackOrder');
    expect(config.embedded?.logoSize).toBe('compact');
    expect(config.embedded).not.toHaveProperty('progressStyle');
  });

  it('merges embedded overrides for embedded variant only', () => {
    const config = normalizePlatformRouteLoadingConfig({
      ...DEFAULT_PLATFORM_ROUTE_LOADING_CONFIG,
      logoGlow: true,
      embedded: { logoGlow: false, logoSize: 'compact' },
    });

    const fullscreen = resolveEffectiveRouteLoadingExperience(config, 'fullscreen');
    const embedded = resolveEffectiveRouteLoadingExperience(config, 'embedded');

    expect(fullscreen.logoGlow).toBe(true);
    expect(embedded.logoGlow).toBe(false);
    expect(embedded.logoSize).toBe('compact');
  });
});