import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  SettingsAttributePayload,
  SettingsAttributeRecord,
  AttributeScope,
  UpdateSettingsAttributePayload,
} from '../contracts/attributes/types';
import { apiDelete, apiGet, apiPost, apiPut, type ApiListResponse, type ApiMutationResponse } from '../client';

export type {
  SettingsAttributePayload,
  SettingsAttributeRecord,
  AttributeScope,
  UpdateSettingsAttributePayload,
};

export const settingsAttributesQueryKeys = {
  all: ['settings-attributes'] as const,
  list: (scope: AttributeScope) => [...settingsAttributesQueryKeys.all, scope] as const,
};

const getLoadErrorMessage = (data: unknown, fallback: string): string => {
  if (!data || typeof data !== 'object') {
    return fallback;
  }

  const payload = data as { error?: string };
  return typeof payload.error === 'string' && payload.error.trim() ? payload.error : fallback;
};

export async function fetchSettingsAttributes(scope: AttributeScope): Promise<SettingsAttributeRecord[]> {
  const { data, response } = await apiGet<ApiListResponse<SettingsAttributeRecord>>(
    `/api/settings/attributes?scope=${encodeURIComponent(scope)}`,
  );

  if (!response.ok) {
    throw new Error(getLoadErrorMessage(data, `Failed to load settings attributes (HTTP ${response.status}).`));
  }

  if (!data.success) {
    throw new Error(getLoadErrorMessage(data, 'Failed to load settings attributes.'));
  }

  return (data.items ?? []) as SettingsAttributeRecord[];
}

const invalidateSettingsAttributeQueries = (queryClient: QueryClient, scope?: AttributeScope) => {
  if (scope) {
    void queryClient.invalidateQueries({ queryKey: settingsAttributesQueryKeys.list(scope) });
    return;
  }
  void queryClient.invalidateQueries({ queryKey: settingsAttributesQueryKeys.all });
};

export function useSettingsAttributesQuery(scope: AttributeScope) {
  return useQuery({
    queryKey: settingsAttributesQueryKeys.list(scope),
    queryFn: () => fetchSettingsAttributes(scope),
  });
}

export function useCreateSettingsAttributeMutation(scope: AttributeScope) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SettingsAttributePayload) =>
      apiPost<ApiMutationResponse>('/api/settings/attributes', payload),
    onSuccess: ({ data }) => {
      if (data.success) {
        invalidateSettingsAttributeQueries(queryClient, scope);
      }
    },
  });
}

export function useUpdateSettingsAttributeMutation(scope: AttributeScope) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateSettingsAttributePayload }) =>
      apiPut<ApiMutationResponse>(`/api/settings/attributes/${id}`, payload),
    onSuccess: ({ data }) => {
      if (data.success) {
        invalidateSettingsAttributeQueries(queryClient, scope);
      }
    },
  });
}

export function useReorderSettingsAttributesMutation(scope: AttributeScope) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderedIds: number[]) =>
      apiPut<ApiMutationResponse>('/api/settings/attributes/reorder', {
        scope,
        orderedIds,
      }),
    onSuccess: ({ data }) => {
      if (data.success) {
        invalidateSettingsAttributeQueries(queryClient, scope);
      }
    },
  });
}

export function useDeleteSettingsAttributeMutation(scope: AttributeScope) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => apiDelete<ApiMutationResponse>(`/api/settings/attributes/${id}`),
    onSuccess: ({ data }) => {
      if (data.success) {
        invalidateSettingsAttributeQueries(queryClient, scope);
      }
    },
  });
}
