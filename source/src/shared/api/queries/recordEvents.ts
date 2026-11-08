import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPost, type ApiMutationResponse } from '../client';
import type { RecordEventPublicRow } from '../contracts/record-events';
import { RECORDS_LIST_QUERY_OPTIONS } from './recordsListQueryOptions';

export type RecordEventListResponse = {
  success: boolean;
  items: RecordEventPublicRow[];
  totalCount: number;
  archiveUnavailable?: boolean;
};

export type RecordEventsListParams = {
  subjectKind?: string;
  subjectKinds?: string;
  subjectId?: string;
  outcome?: string;
  eventKind?: string;
  field?: string;
  from?: string;
  to?: string;
  includeAuth?: string;
  includeArchived?: string;
  projection?: string;
  where?: string;
  limit: number;
  offset?: number;
};

export const recordEventsQueryKeys = {
  all: ['record-events'] as const,
  list: (params: RecordEventsListParams) => [...recordEventsQueryKeys.all, 'list', params] as const,
};

export const fetchRecordEvents = (
  query: Record<string, string | number | undefined>,
  signal?: AbortSignal,
) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '') continue;
    params.set(key, String(value));
  }
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return apiGet<RecordEventListResponse>(`/api/record-events${suffix}`, { signal });
};

export async function fetchRecordEventsList(
  params: RecordEventsListParams,
  signal?: AbortSignal,
): Promise<{ items: RecordEventPublicRow[]; totalCount: number; archiveUnavailable?: boolean }> {
  const { data, response } = await fetchRecordEvents(params, signal);
  if (!response.ok) {
    const message = typeof (data as { error?: string } | undefined)?.error === 'string'
      ? (data as { error?: string }).error
      : `Unable to load record events (HTTP ${response.status}).`;
    throw new Error(message);
  }
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    totalCount: Number(data?.totalCount) || 0,
    archiveUnavailable: Boolean(data?.archiveUnavailable),
  };
}

export function useRecordEventsListQuery(
  params: RecordEventsListParams,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: recordEventsQueryKeys.list(params),
    queryFn: ({ signal }) => fetchRecordEventsList(params, signal),
    ...RECORDS_LIST_QUERY_OPTIONS,
    enabled: options.enabled,
  });
}

export const fetchRecordEventDevices = (userId: number) => (
  apiGet<{ success: boolean; items: Array<{
    installId: string;
    lastSeenAt: string;
    channel: string | null;
    ip: string | null;
    appVersion: string | null;
  }> }>(`/api/record-events/devices?userId=${userId}`)
);

export const fetchHttpLogLink = (requestId: string) => (
  apiGet<{ success: boolean; exists: boolean; message: string | null }>(
    `/api/record-events/http-log?requestId=${encodeURIComponent(requestId)}`,
  )
);

export async function clearRecordEvents(): Promise<{ deleted: number; skipped: number }> {
  const { data, response } = await apiDelete<ApiMutationResponse & {
    deleted?: number;
    skipped?: number;
  }>('/api/record-events');
  if (!response.ok || data?.success === false) {
    const message = typeof data?.error === 'string' ? data.error : 'Failed to clear record events.';
    throw new Error(message);
  }
  return {
    deleted: Number(data?.deleted) || 0,
    skipped: Number(data?.skipped) || 0,
  };
}

export function useClearRecordEventsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clearRecordEvents,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: recordEventsQueryKeys.all });
    },
  });
}

export const restoreRecordEventValue = (
  path: string,
  body: unknown,
) => apiPost(path, body);
