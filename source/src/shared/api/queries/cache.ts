import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  CacheEntryRecord,
  CacheEntryValueData,
  CacheSettings,
  CacheSettingsPublic,
  CacheSettingsTestResult,
  CacheStatusPayload,
} from '../contracts/cache/types';
import {
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  type ApiListResponse,
  type ApiMutationResponse,
} from '../client';
import type { CacheEntriesListQuery } from '../contracts/cache/listQuery';
import { appendCacheEntriesListParams } from '../contracts/cache/listQuery';

export type {
  CacheEntryRecord,
  CacheEntryValueData,
  CacheSettings,
  CacheSettingsPublic,
  CacheSettingsTestResult,
  CacheStatusPayload,
};

export const cacheQueryKeys = {
  all: ['cache'] as const,
  entries: (params: CacheEntriesListQuery = {}) => [...cacheQueryKeys.all, 'entries', params] as const,
  status: () => [...cacheQueryKeys.all, 'status'] as const,
  settings: () => [...cacheQueryKeys.all, 'settings'] as const,
  entry: (key: string) => [...cacheQueryKeys.all, 'entry', key] as const,
};

const invalidateCacheQueries = (queryClient: QueryClient) => {
  void queryClient.invalidateQueries({ queryKey: cacheQueryKeys.all });
};

const normalizeCacheEntry = (item: Record<string, unknown>): CacheEntryRecord => ({
  cacheKey: String(item.cacheKey ?? item.cache_key ?? item.cachekey ?? ''),
  cacheType: String(item.cacheType ?? item.cache_type ?? item.cachetype ?? 'Unknown'),
  sizeBytes: Number(item.sizeBytes ?? item.size_bytes ?? item.sizebytes ?? 0),
  hitCount: Number(item.hitCount ?? item.hit_count ?? item.hitcount ?? 0),
  createdAt: String(item.createdAt ?? item.created_at ?? item.createdat ?? new Date().toISOString()),
});

const getCacheLoadErrorMessage = (data: unknown, fallback: string): string => {
  if (!data || typeof data !== 'object') {
    return fallback;
  }

  const payload = data as { error?: string };
  return typeof payload.error === 'string' && payload.error.trim() ? payload.error : fallback;
};

const getCacheHttpErrorMessage = (status: number, data: unknown, resource: string): string => {
  if (status === 401) {
    return 'Authentication required. Please login again.';
  }
  if (status === 403) {
    return `You do not have permission to view ${resource}.`;
  }
  return getCacheLoadErrorMessage(data, `Failed to load ${resource} (HTTP ${status}).`);
};

export async function fetchCacheEntries(query: CacheEntriesListQuery = {}): Promise<CacheEntryRecord[]> {
  const searchParams = new URLSearchParams();
  appendCacheEntriesListParams(searchParams, query);
  const queryString = searchParams.toString();
  const url = queryString ? `/api/cache?${queryString}` : '/api/cache';

  const { data, response } = await apiGet<ApiListResponse<Record<string, unknown>>>(url);

  if (!response.ok) {
    throw new Error(getCacheHttpErrorMessage(response.status, data, 'cache entries'));
  }

  if (!data.success) {
    throw new Error(getCacheLoadErrorMessage(data, 'Failed to load cache entries.'));
  }

  return Array.isArray(data.items) ? data.items.map(normalizeCacheEntry) : [];
}

export async function fetchCacheStatus(): Promise<CacheStatusPayload> {
  const { data, response } = await apiGet<ApiMutationResponse & { status?: CacheStatusPayload }>('/api/cache/status');

  if (!response.ok) {
    throw new Error(getCacheHttpErrorMessage(response.status, data, 'cache status'));
  }

  if (!data.success || !data.status) {
    throw new Error(getCacheLoadErrorMessage(data, 'Failed to load cache status.'));
  }

  return data.status;
}

export async function fetchCacheEntryValue(key: string): Promise<CacheEntryValueData> {
  const { data, response } = await apiGet<ApiMutationResponse & { value?: unknown }>(
    `/api/cache/${encodeURIComponent(key)}`,
  );

  if (!response.ok) {
    if (response.status === 403) {
      return { value: null, error: 'You do not have permission to view this value.' };
    }
    return { value: null, error: getCacheLoadErrorMessage(data, 'Failed to load value.') };
  }

  if (!data.success) {
    return {
      value: null,
      error: getCacheLoadErrorMessage(data, 'Failed to load value.'),
    };
  }

  const formattedValue = typeof data.value === 'object'
    ? JSON.stringify(data.value, null, 2)
    : String(data.value);

  return { value: formattedValue, error: null };
}

export async function fetchCacheSettings(): Promise<CacheSettingsPublic> {
  const { data, response } = await apiGet<ApiMutationResponse & { settings?: CacheSettingsPublic }>('/api/cache/settings');

  if (!response.ok) {
    throw new Error(getCacheHttpErrorMessage(response.status, data, 'cache settings'));
  }

  if (!data.success || !data.settings) {
    throw new Error(getCacheLoadErrorMessage(data, 'Failed to load cache settings.'));
  }

  return data.settings;
}

export async function updateCacheSettings(payload: Partial<CacheSettings>): Promise<CacheSettingsPublic> {
  const { data, response } = await apiPut<ApiMutationResponse & { settings?: CacheSettingsPublic }>(
    '/api/cache/settings',
    payload,
  );

  if (!response.ok) {
    throw new Error(getCacheHttpErrorMessage(response.status, data, 'cache settings'));
  }

  if (!data.success || !data.settings) {
    throw new Error(getCacheLoadErrorMessage(data, 'Failed to save cache settings.'));
  }

  return data.settings;
}

export async function testCacheSettings(payload: Partial<CacheSettings>): Promise<CacheSettingsTestResult> {
  const { data, response } = await apiPost<ApiMutationResponse & { result?: CacheSettingsTestResult }>(
    '/api/cache/settings/test',
    payload,
  );

  if (!response.ok) {
    throw new Error(getCacheHttpErrorMessage(response.status, data, 'cache settings test'));
  }

  if (!data.success || !data.result) {
    throw new Error(getCacheLoadErrorMessage(data, 'Failed to test cache settings.'));
  }

  return data.result;
}

export function useCacheSettingsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: cacheQueryKeys.settings(),
    queryFn: fetchCacheSettings,
    enabled: options?.enabled ?? true,
  });
}

export function useUpdateCacheSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateCacheSettings,
    onSuccess: () => {
      invalidateCacheQueries(queryClient);
    },
  });
}

export function useTestCacheSettingsMutation() {
  return useMutation({
    mutationFn: testCacheSettings,
  });
}

export function useCacheEntriesQuery(params: CacheEntriesListQuery = {}) {
  return useQuery({
    queryKey: cacheQueryKeys.entries(params),
    queryFn: () => fetchCacheEntries(params),
  });
}

export function useCacheStatusQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: cacheQueryKeys.status(),
    queryFn: fetchCacheStatus,
    enabled: options?.enabled ?? true,
  });
}

export function useFlushCacheMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiDelete<ApiMutationResponse>('/api/cache'),
    onSuccess: ({ data }) => {
      if (data.success) {
        queryClient.setQueryData<CacheEntryRecord[]>(cacheQueryKeys.entries({}), []);
        invalidateCacheQueries(queryClient);
      }
    },
  });
}

export function useEvictKeyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (key: string) => apiDelete<ApiMutationResponse>(`/api/cache/${encodeURIComponent(key)}`),
    onSuccess: ({ data }, key) => {
      if (data.success) {
        invalidateCacheQueries(queryClient);
      }
    },
  });
}
