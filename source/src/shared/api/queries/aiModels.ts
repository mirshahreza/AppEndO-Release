import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPost, apiPut } from '../client';
import type {
  AiGlobalSettings,
  AiModelEntry,
  AiModelPublicEntry,
  AiProviderConfig,
  AiProviderKind,
  AiRemoteModelSummary,
  AiSettingsResponse,
  AiAvailableModel,
} from '../contracts/ai/types';

export const aiModelsQueryKeys = {
  all: ['ai-models'] as const,
  settings: () => [...aiModelsQueryKeys.all, 'settings'] as const,
  models: () => [...aiModelsQueryKeys.all, 'models'] as const,
  available: () => [...aiModelsQueryKeys.all, 'available', 'keyed'] as const,
  remoteModels: (provider: AiProviderKind) => [...aiModelsQueryKeys.all, 'remote-models', provider] as const,
};

type AiSettingsApiResponse = {
  success: boolean;
  ai: AiSettingsResponse;
};

type AiModelsApiResponse = {
  success: boolean;
  models: AiModelPublicEntry[];
};

type AiAvailableApiResponse = {
  success: boolean;
  enabled: boolean;
  defaultModelId: string;
  models: AiAvailableModel[];
};

const getLoadErrorMessage = (data: unknown, fallback: string): string => {
  if (!data || typeof data !== 'object') {
    return fallback;
  }

  const payload = data as { error?: string };
  return typeof payload.error === 'string' && payload.error.trim() ? payload.error : fallback;
};

export async function fetchAiSettings(signal?: AbortSignal): Promise<AiSettingsResponse> {
  const { data, response } = await apiGet<AiSettingsApiResponse>('/api/ai/settings', { signal });

  if (!response.ok) {
    throw new Error(getLoadErrorMessage(data, `Failed to load AI settings (HTTP ${response.status}).`));
  }

  if (!data.success || !data.ai) {
    throw new Error(getLoadErrorMessage(data, 'Failed to load AI settings.'));
  }

  return data.ai;
}

export async function fetchAiModels(signal?: AbortSignal): Promise<AiModelPublicEntry[]> {
  const { data, response } = await apiGet<AiModelsApiResponse>('/api/ai/models', { signal });

  if (!response.ok) {
    throw new Error(getLoadErrorMessage(data, `Failed to load AI models (HTTP ${response.status}).`));
  }

  if (!data.success || !Array.isArray(data.models)) {
    throw new Error(getLoadErrorMessage(data, 'Failed to load AI models.'));
  }

  return data.models;
}

export async function fetchAvailableAiModels(signal?: AbortSignal) {
  const { data, response } = await apiGet<AiAvailableApiResponse>('/api/ai/models/available', { signal });

  if (!response.ok) {
    throw new Error(getLoadErrorMessage(data, `Failed to load available AI models (HTTP ${response.status}).`));
  }

  if (!data.success || !Array.isArray(data.models)) {
    throw new Error(getLoadErrorMessage(data, 'Failed to load available AI models.'));
  }

  return {
    ...data,
    models: data.models.filter((model) => model.hasApiKey === true),
  };
}

export function useAiSettingsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: aiModelsQueryKeys.settings(),
    queryFn: ({ signal }) => fetchAiSettings(signal),
    enabled: options?.enabled ?? true,
  });
}

export function useAiModelsQuery() {
  return useQuery({
    queryKey: aiModelsQueryKeys.models(),
    queryFn: ({ signal }) => fetchAiModels(signal),
  });
}

export function useAvailableAiModelsQuery(enabled = true) {
  return useQuery({
    queryKey: aiModelsQueryKeys.available(),
    queryFn: ({ signal }) => fetchAvailableAiModels(signal),
    enabled,
  });
}

export function useUpdateAiGlobalSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AiGlobalSettings) => apiPut('/api/ai/settings', payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: aiModelsQueryKeys.all });
    },
  });
}

export function useCreateAiModelMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AiModelEntry) => apiPost('/api/ai/models', payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: aiModelsQueryKeys.all });
    },
  });
}

export function useUpdateAiModelMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<AiModelEntry> }) => (
      apiPut(`/api/ai/models/${id}`, payload)
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: aiModelsQueryKeys.all });
    },
  });
}

export function useDeleteAiModelMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/ai/models/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: aiModelsQueryKeys.all });
    },
  });
}

export function useTestAiModelMutation() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiPost<{ success: boolean; message?: string; error?: string }>(
        `/api/ai/models/${id}/test`,
        {},
      );
      return data;
    },
  });
}

export function useCreateAiProviderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, payload }: { provider: AiProviderKind; payload: Partial<AiProviderConfig> }) => (
      apiPost(`/api/ai/providers/${provider}`, payload)
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: aiModelsQueryKeys.all });
    },
  });
}

export function useUpdateAiProviderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, payload }: { provider: AiProviderKind; payload: Partial<AiProviderConfig> }) => (
      apiPut(`/api/ai/providers/${provider}`, payload)
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: aiModelsQueryKeys.all });
    },
  });
}

export function useDeleteAiProviderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: AiProviderKind) => apiDelete(`/api/ai/providers/${provider}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: aiModelsQueryKeys.all });
    },
  });
}

type AiRemoteModelsApiResponse = {
  success: boolean;
  models: AiRemoteModelSummary[];
};

export async function fetchAiProviderRemoteModels(
  provider: AiProviderKind,
  signal?: AbortSignal,
): Promise<AiRemoteModelSummary[]> {
  const { data, response } = await apiGet<AiRemoteModelsApiResponse>(
    `/api/ai/providers/${provider}/remote-models`,
    { signal },
  );

  if (!response.ok || !data.success || !Array.isArray(data.models)) {
    throw new Error(getLoadErrorMessage(data, `Failed to load remote models for "${provider}".`));
  }

  return data.models;
}

export function useAiProviderRemoteModelsQuery(provider: AiProviderKind, enabled: boolean) {
  return useQuery({
    queryKey: aiModelsQueryKeys.remoteModels(provider),
    queryFn: ({ signal }) => fetchAiProviderRemoteModels(provider, signal),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useTestAiProviderMutation() {
  return useMutation({
    mutationFn: async (provider: AiProviderKind) => {
      const { data } = await apiPost<{ success: boolean; message?: string; error?: string }>(
        `/api/ai/providers/${provider}/test`,
        {},
      );
      return data;
    },
  });
}
