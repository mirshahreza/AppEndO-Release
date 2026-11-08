import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, type ApiListResponse } from '../client';
import type {
  DeveloperLibraryMutationResponse,
  DeveloperLibraryRecord,
  DeveloperLibrarySearchHit,
  DeveloperLibrarySearchResponse,
} from '../contracts/libraries/types';
import { RECORDS_LIST_QUERY_OPTIONS } from './recordsListQueryOptions';

export const librariesQueryKeys = {
  all: ['libraries'] as const,
  list: () => [...librariesQueryKeys.all, 'list'] as const,
  search: (query: string) => [...librariesQueryKeys.all, 'search', query] as const,
};

const readError = (data: unknown, fallback: string): string => {
  if (!data || typeof data !== 'object') return fallback;
  const payload = data as { error?: string };
  return typeof payload.error === 'string' && payload.error.trim() ? payload.error : fallback;
};

export async function fetchLibrariesList(signal?: AbortSignal): Promise<DeveloperLibraryRecord[]> {
  const { data, response } = await apiGet<ApiListResponse<DeveloperLibraryRecord>>('/api/libraries', { signal });
  if (!response.ok || !data.success) {
    throw new Error(readError(data, `Failed to load libraries (HTTP ${response.status}).`));
  }
  return data.items ?? [];
}

export async function searchLibraries(query: string, signal?: AbortSignal): Promise<DeveloperLibrarySearchHit[]> {
  const { data, response } = await apiGet<DeveloperLibrarySearchResponse>(
    `/api/libraries/search?q=${encodeURIComponent(query)}`,
    { signal },
  );
  if (!response.ok || !data.success) {
    throw new Error(readError(data, 'Failed to search npm.'));
  }
  return data.items ?? [];
}

export function useLibrariesListQuery() {
  return useQuery({
    queryKey: librariesQueryKeys.list(),
    queryFn: ({ signal }) => fetchLibrariesList(signal),
    ...RECORDS_LIST_QUERY_OPTIONS,
  });
}

export function useLibrarySearchQuery(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: librariesQueryKeys.search(trimmed),
    queryFn: ({ signal }) => searchLibraries(trimmed, signal),
    enabled: trimmed.length >= 2,
  });
}

export function useInstallLibraryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; versionRange?: string }) => {
      const { data, response } = await apiPost<DeveloperLibraryMutationResponse>('/api/libraries/install', payload);
      if (!response.ok || !data.success) {
        throw new Error(readError(data, 'Failed to install library.'));
      }
      return data.library;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: librariesQueryKeys.all });
    },
  });
}

export function useUpgradeLibraryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, response } = await apiPost<DeveloperLibraryMutationResponse>(
        '/api/libraries/upgrade',
        { name },
      );
      if (!response.ok || !data.success) {
        throw new Error(readError(data, 'Failed to upgrade library.'));
      }
      return data.library;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: librariesQueryKeys.all });
    },
  });
}

export function useUninstallLibraryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, response } = await apiPost<DeveloperLibraryMutationResponse>(
        '/api/libraries/uninstall',
        { name },
      );
      if (!response.ok || !data.success) {
        throw new Error(readError(data, 'Failed to uninstall library.'));
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: librariesQueryKeys.all });
    },
  });
}
