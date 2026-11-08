import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut } from '../client';
import type { PlatformRouteLoadingConfig } from '../contracts/routeLoading/schema';
import { normalizePlatformRouteLoadingConfig } from '../contracts/routeLoading/normalizers';
import { bootQueryKeys, fetchAppBoot } from './boot';

export const routeLoadingQueryKeys = {
  all: ['route-loading'] as const,
  config: () => [...routeLoadingQueryKeys.all, 'config'] as const,
};

export async function fetchRouteLoadingSettingsConfig(
  signal?: AbortSignal,
): Promise<PlatformRouteLoadingConfig> {
  const { data, response } = await apiGet<{ success: true; config: PlatformRouteLoadingConfig }>(
    '/api/settings/route-loading/config',
    { signal },
  );
  if (response.ok && data?.success === true && data.config) {
    return normalizePlatformRouteLoadingConfig(data.config);
  }

  if (response.status === 404) {
    const boot = await fetchAppBoot(signal);
    return normalizePlatformRouteLoadingConfig(boot.routeLoading);
  }

  throw new Error('Failed to load route loading settings.');
}

export async function saveRouteLoadingSettingsConfig(
  config: PlatformRouteLoadingConfig,
): Promise<PlatformRouteLoadingConfig> {
  const { data, response } = await apiPut<{ success: true; config: PlatformRouteLoadingConfig }>(
    '/api/settings/route-loading/config',
    config,
  );
  if (!response.ok || data?.success !== true || !data.config) {
    throw new Error('Failed to save route loading settings.');
  }
  return normalizePlatformRouteLoadingConfig(data.config);
}

export function useRouteLoadingSettingsConfigQuery(enabled = true) {
  return useQuery({
    queryKey: routeLoadingQueryKeys.config(),
    queryFn: ({ signal }) => fetchRouteLoadingSettingsConfig(signal),
    enabled,
  });
}

export function useSaveRouteLoadingSettingsConfigMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveRouteLoadingSettingsConfig,
    onSuccess: (config) => {
      queryClient.setQueryData(routeLoadingQueryKeys.config(), config);
      queryClient.setQueryData(bootQueryKeys.all, (current: { routeLoading?: PlatformRouteLoadingConfig } | undefined) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          routeLoading: config,
        };
      });
    },
  });
}
