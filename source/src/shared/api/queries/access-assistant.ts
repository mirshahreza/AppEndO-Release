import { useMutation, useQuery } from '@tanstack/react-query';
import { apiGet, apiPut } from '../client';
import type {
  AccessAssistantContextResponse,
  AccessAssistantEligibility,
  AccessAssistantSavePayload,
} from '../contracts/access-assistant/types';
import type { FunctionAccessEntityKind } from '../contracts/server-functions/entityAccess';

export const accessAssistantQueryKeys = {
  all: ['access-assistant'] as const,
  eligibility: (pageKey: string) => [...accessAssistantQueryKeys.all, 'eligibility', pageKey] as const,
  context: (
    pageKey: string,
    entityKind: FunctionAccessEntityKind | null,
    entityKey: string | null,
  ) => [...accessAssistantQueryKeys.all, 'context', pageKey, entityKind, entityKey] as const,
};

export async function fetchAccessAssistantEligibility(
  pageKey: string,
  signal?: AbortSignal,
): Promise<{ eligibility: AccessAssistantEligibility }> {
  const params = new URLSearchParams({ pageKey });
  const { data, response } = await apiGet<{ success: boolean; eligibility: AccessAssistantEligibility }>(
    `/api/access-assistant/eligibility?${params.toString()}`,
    { signal },
  );
  if (!response.ok || !data.success) {
    throw new Error('Failed to load access assistant eligibility.');
  }
  return { eligibility: data.eligibility };
}

export async function fetchAccessAssistantContext(
  pageKey: string,
  entityKind: FunctionAccessEntityKind,
  entityKey: string,
  signal?: AbortSignal,
): Promise<AccessAssistantContextResponse> {
  const params = new URLSearchParams({
    pageKey,
    entityKind,
    entityKey,
  });
  const { data, response } = await apiGet<AccessAssistantContextResponse>(
    `/api/access-assistant/context?${params.toString()}`,
    { signal },
  );
  if (!response.ok || !data.success) {
    throw new Error('Failed to load access assistant context.');
  }
  return data;
}

export function useAccessAssistantEligibilityQuery(pageKey: string | null, enabled = true) {
  return useQuery({
    queryKey: pageKey
      ? accessAssistantQueryKeys.eligibility(pageKey)
      : [...accessAssistantQueryKeys.all, 'eligibility', 'idle'],
    queryFn: ({ signal }) => fetchAccessAssistantEligibility(pageKey as string, signal),
    enabled: enabled && Boolean(pageKey?.trim()),
    staleTime: 30_000,
  });
}

export function useAccessAssistantContextQuery(
  pageKey: string | null,
  entityKind: FunctionAccessEntityKind | null,
  entityKey: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: pageKey && entityKind && entityKey
      ? accessAssistantQueryKeys.context(pageKey, entityKind, entityKey)
      : [...accessAssistantQueryKeys.all, 'context', 'idle'],
    queryFn: ({ signal }) => fetchAccessAssistantContext(
      pageKey as string,
      entityKind as FunctionAccessEntityKind,
      entityKey as string,
      signal,
    ),
    enabled: enabled && Boolean(pageKey?.trim() && entityKind && entityKey),
    staleTime: 0,
  });
}

export function useSaveAccessAssistantContextMutation() {
  return useMutation({
    mutationFn: async ({
      pageKey,
      payload,
    }: {
      pageKey: string;
      payload: AccessAssistantSavePayload;
    }) => {
      const params = new URLSearchParams({ pageKey });
      const { data, response } = await apiPut<{ success: boolean; error?: string }>(
        `/api/access-assistant/context?${params.toString()}`,
        payload,
      );
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? 'Failed to save access.');
      }
      return data;
    },
  });
}
