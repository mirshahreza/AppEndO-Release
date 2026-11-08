import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  invalidatePlatformQueries,
  platformCrudQueryKeys,
} from '../platformCrud';
import { bootQueryKeys } from '../boot';
import { platformQueryKeys } from '../platform';

describe('invalidatePlatformQueries', () => {
  it('invalidates platform CRUD list queries and runtime-config bootstrap query', async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    queryClient.setQueryData(platformCrudQueryKeys.mounts(), [{ id: 'studio' }]);
    queryClient.setQueryData(platformQueryKeys.runtimeConfig(), {
      mounts: [],
      shells: [],
      shellRules: [],
      pageModules: [],
      bindings: [],
      version: 'v1',
    });

    invalidatePlatformQueries(queryClient);

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: platformCrudQueryKeys.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: platformQueryKeys.runtimeConfig() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: platformQueryKeys.cultures() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: platformQueryKeys.cultureTranslations() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: bootQueryKeys.all });
    expect(invalidateSpy).toHaveBeenCalledTimes(5);
  });
});
