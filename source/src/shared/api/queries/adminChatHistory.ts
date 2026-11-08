import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet } from '../client';
import type {
  AiChatSessionAdminDetail,
  AiChatSessionAdminDetailResponse,
  AiChatSessionAdminListResponse,
  AiChatSessionAdminSummary,
} from '../contracts/ai/chatHistoryTypes';
import {
  appendChatSessionListParams,
  type ChatSessionListQuery,
} from '../contracts/ai/chatHistoryListQuery';
import { RECORDS_LIST_QUERY_OPTIONS } from './recordsListQueryOptions';

export const adminChatHistoryQueryKeys = {
  all: ['admin-chat-history'] as const,
  list: (query: ChatSessionListQuery) => [
    ...adminChatHistoryQueryKeys.all,
    'list',
    query.search?.trim() || '',
    query.page ?? 1,
    query.pageSize ?? 50,
    query.sortBy ?? 'updated_at',
    query.sortDir ?? 'desc',
  ] as const,
  detail: (id: number) => [...adminChatHistoryQueryKeys.all, 'detail', id] as const,
};

const getLoadErrorMessage = (data: unknown, fallback: string): string => {
  if (!data || typeof data !== 'object') {
    return fallback;
  }

  const payload = data as { error?: string };
  return typeof payload.error === 'string' && payload.error.trim() ? payload.error : fallback;
};

export type AdminChatSessionListResult = {
  items: AiChatSessionAdminSummary[];
  totalCount: number;
  page: number;
  pageSize: number;
};

export async function fetchAdminChatSessions(
  query: ChatSessionListQuery = {},
  signal?: AbortSignal,
): Promise<AdminChatSessionListResult> {
  const searchParams = new URLSearchParams();
  appendChatSessionListParams(searchParams, query);
  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const { data, response } = await apiGet<AiChatSessionAdminListResponse>(
    `/api/ai/admin/chat-sessions${suffix}`,
    { signal },
  );

  if (!response.ok) {
    throw new Error(getLoadErrorMessage(data, `Failed to load chat history (HTTP ${response.status}).`));
  }

  if (!data.success || !Array.isArray(data.items)) {
    throw new Error(getLoadErrorMessage(data, 'Failed to load chat history.'));
  }

  return {
    items: data.items,
    totalCount: Number(data.totalCount ?? data.items.length),
    page: Number(data.page ?? query.page ?? 1),
    pageSize: Number(data.pageSize ?? query.pageSize ?? 50),
  };
}

export async function fetchAdminChatSession(id: number, signal?: AbortSignal): Promise<AiChatSessionAdminDetail> {
  const { data, response } = await apiGet<AiChatSessionAdminDetailResponse>(`/api/ai/admin/chat-sessions/${id}`, { signal });

  if (!response.ok) {
    throw new Error(getLoadErrorMessage(data, `Failed to load chat session (HTTP ${response.status}).`));
  }

  if (!data.success || !data.session) {
    throw new Error(getLoadErrorMessage(data, 'Failed to load chat session.'));
  }

  return data.session;
}

export function useAdminChatSessionsQuery(query: ChatSessionListQuery, enabled = true) {
  return useQuery({
    queryKey: adminChatHistoryQueryKeys.list(query),
    queryFn: ({ signal }) => fetchAdminChatSessions(query, signal),
    enabled,
    ...RECORDS_LIST_QUERY_OPTIONS,
  });
}

export function useAdminChatSessionQuery(sessionId: number | null, enabled = true) {
  const normalizedId = Number(sessionId);
  const hasId = Number.isInteger(normalizedId) && normalizedId > 0;

  return useQuery({
    queryKey: adminChatHistoryQueryKeys.detail(hasId ? normalizedId : 0),
    queryFn: ({ signal }) => fetchAdminChatSession(normalizedId, signal),
    enabled: enabled && hasId,
  });
}

export function useDeleteAdminChatSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/ai/admin/chat-sessions/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminChatHistoryQueryKeys.all });
    },
  });
}
