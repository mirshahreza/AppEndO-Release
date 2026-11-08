import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  SessionContextSettingsResponse,
  UpdateSessionContextSettingsPayload,
} from '../contracts/settings/sessionContext';
import { apiGet, apiPut } from '../client';
import { profileFieldSettingsQueryKeys } from './profileFieldsSettings';
import { settingsAttributesQueryKeys } from './settingsAttributes';

export const sessionContextSettingsQueryKeys = {
  all: ['session-context-settings'] as const,
};

const getErrorMessage = (data: unknown, fallback: string): string => {
  if (!data || typeof data !== 'object') return fallback;
  const payload = data as { error?: string };
  return typeof payload.error === 'string' && payload.error.trim() ? payload.error : fallback;
};

export async function fetchSessionContextSettings(): Promise<SessionContextSettingsResponse['groups']> {
  const { data, response } = await apiGet<SessionContextSettingsResponse>(
    '/api/settings/session-context',
  );

  if (!response.ok) {
    throw new Error(getErrorMessage(data, `Failed to load session context settings (HTTP ${response.status}).`));
  }

  if (!data.success) {
    throw new Error(getErrorMessage(data, 'Failed to load session context settings.'));
  }

  return data.groups ?? [];
}

export function useSessionContextSettingsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: sessionContextSettingsQueryKeys.all,
    queryFn: fetchSessionContextSettings,
    enabled: options?.enabled ?? true,
  });
}

export function useSaveSessionContextSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateSessionContextSettingsPayload) =>
      apiPut<SessionContextSettingsResponse>(
        '/api/settings/session-context',
        payload,
      ),
    onSuccess: ({ data }) => {
      if (data.success && Array.isArray(data.groups)) {
        queryClient.setQueryData(sessionContextSettingsQueryKeys.all, data.groups);
      }
      void queryClient.invalidateQueries({ queryKey: profileFieldSettingsQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: settingsAttributesQueryKeys.all });
    },
  });
}
