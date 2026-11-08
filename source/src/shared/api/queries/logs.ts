import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  buildLogDetailFallback,
  mapLogViewerSettings,
  normalizeLogDetailItem,
  normalizeLogSummaryItem,
} from '../contracts/logs/mappers';
import type { LogDetailItem, LogSummaryItem, LogsListParams } from '../contracts/logs/types';
import { apiDelete, apiGet, apiPost, type ApiListResponse, type ApiMutationResponse } from '../client';
import { RECORDS_LIST_QUERY_OPTIONS } from './recordsListQueryOptions';

type LogsListResponse = ApiListResponse & {
  items?: unknown[];
  totalCount?: number;
  archiveUnavailable?: boolean;
};

type LogDetailResponse = ApiMutationResponse & {
  item?: unknown;
};

export const logsQueryKeys = {
  all: ['logs'] as const,
  list: (params: LogsListParams) => [...logsQueryKeys.all, 'list', params] as const,
  viewerSettings: () => [...logsQueryKeys.all, 'viewer-settings'] as const,
};

export async function fetchLogViewerSettings(): Promise<ReturnType<typeof mapLogViewerSettings>> {
  try {
    const { data, response } = await apiGet<Record<string, unknown>>('/api/settings');
    if (!response.ok) {
      return {};
    }
    return mapLogViewerSettings(data);
  } catch {
    return {};
  }
}

function appendLogsListLevel(searchParams: URLSearchParams, level: LogsListParams['level']) {
  if (!level) return;
  if (Array.isArray(level)) {
    for (const item of level) {
      const trimmed = item.trim();
      if (trimmed) searchParams.append('level', trimmed);
    }
    return;
  }
  const trimmed = level.trim();
  if (trimmed) searchParams.set('level', trimmed);
}

function appendLogsListParams(searchParams: URLSearchParams, params: LogsListParams) {
  searchParams.set('limit', String(params.limit));
  if (params.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params.sortDir) searchParams.set('sortDir', params.sortDir);
  appendLogsListLevel(searchParams, params.level);
  if (params.actor?.trim()) searchParams.set('actor', params.actor.trim());
  if (params.context?.trim()) searchParams.set('context', params.context.trim());
  if (params.folder?.trim()) searchParams.set('folder', params.folder.trim());
  if (params.functionName?.trim()) searchParams.set('functionName', params.functionName.trim());
  if (params.key?.trim()) searchParams.set('key', params.key.trim());
  if (params.timestampFrom?.trim()) searchParams.set('timestampFrom', params.timestampFrom.trim());
  if (params.timestampTo?.trim()) searchParams.set('timestampTo', params.timestampTo.trim());
  if (params.duration?.trim()) searchParams.set('duration', params.duration.trim());
  if (params.callSuccess) searchParams.set('callSuccess', params.callSuccess);
  if (params.requestId?.trim()) searchParams.set('requestId', params.requestId.trim());
  if (params.includeArchived) searchParams.set('includeArchived', '1');
  if (params.offset != null && params.offset > 0) searchParams.set('offset', String(params.offset));
  if (params.where?.trim()) searchParams.set('where', params.where.trim());
}

export function buildLogsListSearchParams(params: LogsListParams): URLSearchParams {
  const searchParams = new URLSearchParams();
  appendLogsListParams(searchParams, params);
  return searchParams;
}

export async function fetchLogsList(
  params: LogsListParams,
  signal?: AbortSignal,
): Promise<{ items: LogSummaryItem[]; totalCount: number; archiveUnavailable?: boolean }> {
  const searchParams = buildLogsListSearchParams(params);

  const { data, response } = await apiGet<LogsListResponse>(`/api/logs?${searchParams.toString()}`, { signal });

  if (!response.ok) {
    const message = typeof data?.error === 'string'
      ? data.error
      : `Unable to load logs (HTTP ${response.status}).`;
    throw new Error(message);
  }

  if (data && data.success === false) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Unable to load logs.');
  }

  return {
    items: Array.isArray(data?.items)
      ? data.items.map((item) => normalizeLogSummaryItem(item))
      : [],
    totalCount: Number(data?.totalCount) || 0,
    archiveUnavailable: Boolean(data?.archiveUnavailable),
  };
}

export async function fetchLogDetail(id: number): Promise<LogDetailItem> {
  const { data, response } = await apiGet<LogDetailResponse>(`/api/logs/${id}`);

  try {
    const payload = data as LogDetailResponse & { error?: string };
    if (payload.success && payload.item) {
      return normalizeLogDetailItem(payload.item);
    }
    return buildLogDetailFallback(id, { error: payload.error, meta: data }, 'api');
  } catch (error) {
    return buildLogDetailFallback(id, { meta: error }, 'network');
  }
}

export async function clearLogs(): Promise<void> {
  await apiDelete('/api/logs');
}

export async function saveLoggingMethodConfigs(
  methodConfigs: Record<string, { enabled?: boolean }>,
): Promise<void> {
  const { data, response } = await apiPost<ApiMutationResponse>('/api/logs/config', { methodConfigs });
  if (!response.ok || data?.success === false) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to save logging method settings.');
  }
}

export function useLogViewerSettingsQuery() {
  return useQuery({
    queryKey: logsQueryKeys.viewerSettings(),
    queryFn: fetchLogViewerSettings,
    staleTime: 60_000,
  });
}

export function useLogsListQuery(params: LogsListParams) {
  return useQuery({
    queryKey: logsQueryKeys.list(params),
    queryFn: ({ signal }) => fetchLogsList(params, signal),
    ...RECORDS_LIST_QUERY_OPTIONS,
  });
}

export function useClearLogsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clearLogs,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: logsQueryKeys.all });
    },
  });
}
