import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPost, apiPut } from '../client';
import type {
  AiChatSessionCreatePayload,
  AiChatSessionDetail,
  AiChatSessionDetailResponse,
  AiChatSessionListResponse,
  AiChatSessionSummary,
  AiChatSessionUpdatePayload,
} from '../contracts/ai/chatHistoryTypes';

export const aiChatHistoryQueryKeys = {
  all: ['ai-chat-history'] as const,
  list: (userId?: number | null) => [...aiChatHistoryQueryKeys.all, 'list', userId ?? 'none'] as const,
  detail: (userId: number | null | undefined, id: number) => [...aiChatHistoryQueryKeys.all, 'detail', userId ?? 'none', id] as const,
};

export const resetAiChatHistoryQueriesOnAuthChange = (queryClient: QueryClient): void => {
  void queryClient.removeQueries({ queryKey: aiChatHistoryQueryKeys.all });
};

const getLoadErrorMessage = (data: unknown, fallback: string): string => {
  if (!data || typeof data !== 'object') {
    return fallback;
  }

  const payload = data as { error?: string };
  return typeof payload.error === 'string' && payload.error.trim() ? payload.error : fallback;
};

export async function fetchAiChatSessions(signal?: AbortSignal): Promise<AiChatSessionSummary[]> {
  const { data, response } = await apiGet<AiChatSessionListResponse>('/api/ai/chats', { signal });

  if (!response.ok) {
    throw new Error(getLoadErrorMessage(data, `Failed to load chat history (HTTP ${response.status}).`));
  }

  if (!data.success || !Array.isArray(data.items)) {
    throw new Error(getLoadErrorMessage(data, 'Failed to load chat history.'));
  }

  return data.items;
}

export async function fetchAiChatSession(id: number, signal?: AbortSignal): Promise<AiChatSessionDetail> {
  const { data, response } = await apiGet<AiChatSessionDetailResponse>(`/api/ai/chats/${id}`, { signal });

  if (!response.ok) {
    throw new Error(getLoadErrorMessage(data, `Failed to load chat session (HTTP ${response.status}).`));
  }

  if (!data.success || !data.session) {
    throw new Error(getLoadErrorMessage(data, 'Failed to load chat session.'));
  }

  return data.session;
}

export function useAiChatSessionsQuery(enabled = true, userId?: number | null) {
  const normalizedUserId = Number(userId);
  const hasUserId = Number.isInteger(normalizedUserId) && normalizedUserId > 0;

  return useQuery({
    queryKey: aiChatHistoryQueryKeys.list(hasUserId ? normalizedUserId : null),
    queryFn: ({ signal }) => fetchAiChatSessions(signal),
    enabled: enabled && hasUserId,
  });
}

export function useCreateAiChatSessionMutation(userId?: number | null) {
  const queryClient = useQueryClient();
  const normalizedUserId = Number(userId);
  const hasUserId = Number.isInteger(normalizedUserId) && normalizedUserId > 0;

  return useMutation({
    mutationFn: async (payload: AiChatSessionCreatePayload) => {
      const { data, response } = await apiPost<{ success: boolean; session: AiChatSessionDetail }>(
        '/api/ai/chats',
        payload,
      );

      if (!response.ok || !data.success || !data.session) {
        throw new Error(getLoadErrorMessage(data, 'Failed to create chat session.'));
      }

      return data.session;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: aiChatHistoryQueryKeys.list(hasUserId ? normalizedUserId : null),
      });
    },
  });
}

export function useUpdateAiChatSessionMutation(userId?: number | null) {
  const queryClient = useQueryClient();
  const normalizedUserId = Number(userId);
  const hasUserId = Number.isInteger(normalizedUserId) && normalizedUserId > 0;

  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: AiChatSessionUpdatePayload }) => {
      const { data, response } = await apiPut<{ success: boolean; session: AiChatSessionDetail }>(
        `/api/ai/chats/${id}`,
        payload,
      );

      if (!response.ok || !data.success || !data.session) {
        throw new Error(getLoadErrorMessage(data, 'Failed to update chat session.'));
      }

      return data.session;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: aiChatHistoryQueryKeys.list(hasUserId ? normalizedUserId : null),
      });
    },
  });
}

export function useDeleteAiChatSessionMutation(userId?: number | null) {
  const queryClient = useQueryClient();
  const normalizedUserId = Number(userId);
  const hasUserId = Number.isInteger(normalizedUserId) && normalizedUserId > 0;

  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/ai/chats/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: aiChatHistoryQueryKeys.list(hasUserId ? normalizedUserId : null),
      });
      void queryClient.invalidateQueries({ queryKey: ['admin-chat-history'] });
    },
  });
}
