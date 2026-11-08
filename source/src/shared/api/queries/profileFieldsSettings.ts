import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ProfileFieldSettingRecord,
  UpdateProfileFieldSettingsPayload,
} from '../contracts/attributes/types';
import { apiGet, apiPut, type ApiListResponse, type ApiMutationResponse } from '../client';
import { settingsAttributesQueryKeys } from './settingsAttributes';

export const profileFieldSettingsQueryKeys = {
  all: ['profile-field-settings'] as const,
};

const getLoadErrorMessage = (data: unknown, fallback: string): string => {
  if (!data || typeof data !== 'object') {
    return fallback;
  }

  const payload = data as { error?: string };
  return typeof payload.error === 'string' && payload.error.trim() ? payload.error : fallback;
};

export async function fetchProfileFieldSettings(): Promise<ProfileFieldSettingRecord[]> {
  const { data, response } = await apiGet<ApiListResponse<ProfileFieldSettingRecord>>(
    '/api/settings/attributes/profile-fields',
  );

  if (!response.ok) {
    throw new Error(getLoadErrorMessage(data, `Failed to load profile field settings (HTTP ${response.status}).`));
  }

  if (!data.success) {
    throw new Error(getLoadErrorMessage(data, 'Failed to load profile field settings.'));
  }

  return (data.items ?? []) as ProfileFieldSettingRecord[];
}

export function useProfileFieldSettingsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: profileFieldSettingsQueryKeys.all,
    queryFn: fetchProfileFieldSettings,
    enabled: options?.enabled ?? true,
  });
}

export function useSaveProfileFieldSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateProfileFieldSettingsPayload) =>
      apiPut<ApiMutationResponse & { items?: ProfileFieldSettingRecord[] }>(
        '/api/settings/attributes/profile-fields',
        payload,
      ),
    onSuccess: ({ data }) => {
      if (data.success && Array.isArray(data.items)) {
        queryClient.setQueryData(profileFieldSettingsQueryKeys.all, data.items);
      }
      void queryClient.invalidateQueries({ queryKey: settingsAttributesQueryKeys.all });
    },
  });
}
