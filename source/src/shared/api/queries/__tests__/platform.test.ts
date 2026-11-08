import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { normalizePlatformRuntimeConfig, platformQueryKeys, refetchPlatformBootQueries } from '../platform';
import { bootQueryKeys } from '../boot';
import type { PlatformRuntimeConfig } from '../../contracts/platform/types';

const sampleConfig: PlatformRuntimeConfig = {
  mounts: [
    {
      id: 'studio',
      pathPrefix: '/studio',
      name: 'Studio',
      enabled: true,
      defaultRoute: '/studio',
      designerRoutePropagation: 'none',
      authProfile: { requireAuth: true },
    },
  ],
  shells: [],
  shellRules: [],
  pageModules: [],
  bindings: [],
  navigations: [],
  version: 'abc123',
};

describe('normalizePlatformRuntimeConfig', () => {
  it('returns empty collections for missing payload fields', () => {
    expect(normalizePlatformRuntimeConfig(null)).toEqual({
      mounts: [],
      shells: [],
      shellRules: [],
      pageModules: [],
      bindings: [],
      navigations: [],
      version: '',
    });
  });

  it('preserves valid runtime config payload', () => {
    expect(normalizePlatformRuntimeConfig(sampleConfig)).toEqual(sampleConfig);
  });
});

describe('refetchPlatformBootQueries', () => {
  it('invalidates boot so portal shell changes apply without a restart', async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const refetchSpy = vi.spyOn(queryClient, 'refetchQueries').mockResolvedValue([]);

    await refetchPlatformBootQueries(queryClient);

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: bootQueryKeys.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: platformQueryKeys.all });
    expect(refetchSpy).toHaveBeenCalledWith({ queryKey: bootQueryKeys.all });
    expect(refetchSpy).toHaveBeenCalledWith({ queryKey: platformQueryKeys.runtimeConfig() });
    expect(refetchSpy).toHaveBeenCalledWith({ queryKey: platformQueryKeys.cultures() });
  });
});
