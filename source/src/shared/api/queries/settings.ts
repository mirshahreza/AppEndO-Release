import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mapAppSettings } from '../contracts/settings/mappers';
import type { AppSettings } from '../contracts/settings/types';
import { apiGet, apiPost } from '../client';
import { pwaQueryKeys } from './pwa';

export const settingsQueryKeys = {
  all: ['settings'] as const,
  app: () => [...settingsQueryKeys.all, 'app'] as const,
};

export async function fetchAppSettings(): Promise<AppSettings> {
  const { data } = await apiGet<Partial<AppSettings>>('/api/settings');
  return mapAppSettings(data);
}

export async function saveAppSettings(payload: AppSettings): Promise<AppSettings> {
  const { pwa, ...rest } = payload;
  const { data } = await apiPost<Record<string, unknown>>('/api/settings', { ...rest, pwa });
  const { success: _success, ...saved } = data ?? {};
  return mapAppSettings(saved);
}

export function useAppSettingsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: settingsQueryKeys.app(),
    queryFn: fetchAppSettings,
    enabled: options?.enabled,
  });
}

export function useSaveAppSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveAppSettings,
    onSuccess: (saved) => {
      queryClient.setQueryData(settingsQueryKeys.app(), saved);
      queryClient.invalidateQueries({ queryKey: pwaQueryKeys.config() });
    },
  });
}
