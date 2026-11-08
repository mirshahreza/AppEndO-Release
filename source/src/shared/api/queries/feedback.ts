import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut } from '../client';
import type {
  FeedbackBootPolicy,
  FeedbackListResponse,
  FeedbackMineListQuery,
  PlatformFeedbackConfig,
} from '../contracts/feedback/types';
import { bootQueryKeys } from './boot';

export const feedbackQueryKeys = {
  all: ['feedback'] as const,
  config: () => [...feedbackQueryKeys.all, 'config'] as const,
  mine: (limit?: number) => [...feedbackQueryKeys.all, 'mine', limit ?? 20] as const,
  inbox: (bucket: string, limit?: number) => [...feedbackQueryKeys.all, 'inbox', bucket, limit ?? 50] as const,
  detail: (id: string) => [...feedbackQueryKeys.all, 'detail', id] as const,
};

export async function fetchFeedbackSettingsConfig(signal?: AbortSignal): Promise<PlatformFeedbackConfig> {
  const { data, response } = await apiGet<{ success: true; config: PlatformFeedbackConfig }>(
    '/api/settings/feedback/config',
    { signal },
  );
  if (!response.ok || data?.success !== true || !data.config) {
    throw new Error('Failed to load feedback settings.');
  }
  return data.config;
}

export async function saveFeedbackSettingsConfig(config: PlatformFeedbackConfig): Promise<PlatformFeedbackConfig> {
  const { data, response } = await apiPut<{ success: true; config: PlatformFeedbackConfig }>(
    '/api/settings/feedback/config',
    config,
  );
  if (!response.ok || data?.success !== true || !data.config) {
    throw new Error('Failed to save feedback settings.');
  }
  return data.config;
}

export function useFeedbackSettingsConfigQuery(enabled = true) {
  return useQuery({
    queryKey: feedbackQueryKeys.config(),
    queryFn: ({ signal }) => fetchFeedbackSettingsConfig(signal),
    enabled,
  });
}

export function useSaveFeedbackSettingsConfigMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveFeedbackSettingsConfig,
    onSuccess: (config) => {
      queryClient.setQueryData(feedbackQueryKeys.config(), config);
      queryClient.setQueryData(bootQueryKeys.all, (current: { feedbackPolicy?: FeedbackBootPolicy } | undefined) => {
        if (!current?.feedbackPolicy) return current;
        return {
          ...current,
          feedbackPolicy: {
            ...current.feedbackPolicy,
            enabled: config.policy.enabled,
            allowAuthenticated: config.policy.allowAuthenticated,
            allowAnonymous: config.policy.allowAnonymous,
            showContactFieldsForAnonymous: config.policy.showContactFieldsForAnonymous,
            requireSubject: config.policy.requireSubject,
            allowAttachments: config.policy.allowAttachments,
            widgetPlacement: config.policy.widgetPlacement,
            showOnDashboard: config.policy.showOnDashboard,
            pageKeyDenylist: config.policy.pageKeyDenylist,
          },
        };
      });
    },
  });
}

export async function fetchFeedbackMine(limit = 20, signal?: AbortSignal): Promise<FeedbackListResponse> {
  const { data, response } = await apiGet<FeedbackListResponse>(`/api/feedback/mine?limit=${limit}`, { signal });
  if (!response.ok || data?.success !== true) {
    throw new Error('Failed to load your feedback.');
  }
  return data;
}

export function useFeedbackMineQuery(limit = 20, enabled = true) {
  return useQuery({
    queryKey: feedbackQueryKeys.mine(limit),
    queryFn: ({ signal }) => fetchFeedbackMine(limit, signal),
    enabled,
  });
}
