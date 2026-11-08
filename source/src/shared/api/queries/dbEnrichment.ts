import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch, apiPost, formatApiErrorMessage, isApiError } from '../client';
import type {
  DbEnrichmentDocumentation,
  DbEnrichmentMetrics,
  DbEnrichmentQuestion,
  DbEnrichmentQuestionStatus,
  DbEnrichmentRun,
  TriggerDbEnrichmentInput,
} from '../contracts/db-enrichment';

export type DbEnrichmentQuestionStatusFilter = DbEnrichmentQuestionStatus | 'all';

export const dbEnrichmentQueryKeys = {
  all: ['db-enrichment'] as const,
  runs: (dataSourceId: string) => [...dbEnrichmentQueryKeys.all, 'runs', dataSourceId] as const,
  metrics: (dataSourceId: string) => [...dbEnrichmentQueryKeys.all, 'metrics', dataSourceId] as const,
  questions: (dataSourceId: string, status: DbEnrichmentQuestionStatusFilter) => (
    [...dbEnrichmentQueryKeys.all, 'questions', dataSourceId, status] as const
  ),
  documentation: (dataSourceId: string) => [...dbEnrichmentQueryKeys.all, 'documentation', dataSourceId] as const,
};

const unwrap = async <T,>(promise: ReturnType<typeof apiGet<{ success: boolean; error?: string } & T>>): Promise<T> => {
  const { data, response } = await promise;
  if (!response.ok || !data.success) {
    throw new Error(data.error || response.statusText || 'Request failed.');
  }
  return data;
};

export function useDbEnrichmentMetricsQuery(
  dataSourceId: string,
  options?: { enabled?: boolean; refetchInterval?: Parameters<typeof useQuery>[0]['refetchInterval'] },
) {
  return useQuery({
    queryKey: dbEnrichmentQueryKeys.metrics(dataSourceId),
    queryFn: async () => {
      const data = await unwrap<{ metrics: DbEnrichmentMetrics }>(
        apiGet(`/api/db-enrichment/metrics?dataSourceId=${encodeURIComponent(dataSourceId)}`),
      );
      return data.metrics;
    },
    enabled: (options?.enabled ?? true) && Boolean(dataSourceId),
    refetchInterval: options?.refetchInterval,
  });
}

export function useDbEnrichmentRunsQuery(
  dataSourceId: string,
  options?: { enabled?: boolean; refetchInterval?: Parameters<typeof useQuery>[0]['refetchInterval'] },
) {
  return useQuery({
    queryKey: dbEnrichmentQueryKeys.runs(dataSourceId),
    queryFn: async () => {
      const data = await unwrap<{ items: DbEnrichmentRun[] }>(
        apiGet(`/api/db-enrichment/runs?dataSourceId=${encodeURIComponent(dataSourceId)}`),
      );
      return data.items;
    },
    enabled: (options?.enabled ?? true) && Boolean(dataSourceId),
    refetchInterval: options?.refetchInterval,
  });
}

export function useDbEnrichmentQuestionsQuery(
  dataSourceId: string,
  status: DbEnrichmentQuestionStatusFilter,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: dbEnrichmentQueryKeys.questions(dataSourceId, status),
    queryFn: async () => {
      const data = await unwrap<{ items: DbEnrichmentQuestion[] }>(
        apiGet(`/api/db-enrichment/questions?dataSourceId=${encodeURIComponent(dataSourceId)}&status=${status}`),
      );
      return data.items;
    },
    enabled: (options?.enabled ?? true) && Boolean(dataSourceId),
  });
}

export function useDbEnrichmentDocumentationQuery(
  dataSourceId: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: dbEnrichmentQueryKeys.documentation(dataSourceId),
    queryFn: async () => {
      const data = await unwrap<{ documentation: DbEnrichmentDocumentation }>(
        apiGet(`/api/db-enrichment/documentation?dataSourceId=${encodeURIComponent(dataSourceId)}`),
      );
      return data.documentation;
    },
    enabled: (options?.enabled ?? true) && Boolean(dataSourceId),
    staleTime: 30_000,
  });
}

export function useTriggerDbEnrichmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TriggerDbEnrichmentInput) => {
      const { data, response } = await apiPost<{ success: boolean; runId?: number; jobId?: number; error?: string }>(
        '/api/db-enrichment/runs',
        input,
      );
      if (!response.ok || !data.success) {
        throw new Error(data.error || response.statusText || 'Failed to start enrichment.');
      }
      return data;
    },
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: dbEnrichmentQueryKeys.runs(input.dataSourceId) });
      void queryClient.invalidateQueries({ queryKey: dbEnrichmentQueryKeys.metrics(input.dataSourceId) });
    },
  });
}

export function useDraftDbEnrichmentQuestionMutation() {
  return useMutation({
    mutationFn: async ({ id, modelId }: { id: number; modelId?: string }) => {
      const { data, response } = await apiPost<{ success: boolean; draft?: string; error?: string }>(
        `/api/db-enrichment/questions/${id}/draft`,
        modelId ? { modelId } : {},
      );
      if (!response.ok || !data.success || typeof data.draft !== 'string') {
        throw new Error(data.error || response.statusText || 'Failed to generate a draft answer.');
      }
      return data.draft;
    },
  });
}

export function useAnswerDbEnrichmentQuestionMutation(dataSourceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, answer }: { id: number; answer: string }) => {
      const { data, response } = await apiPatch<{ success: boolean; error?: string }>(
        `/api/db-enrichment/questions/${id}`,
        { answer },
      );
      if (!response.ok || !data.success) {
        throw new Error(data.error || response.statusText || 'Failed to save the answer.');
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...dbEnrichmentQueryKeys.all, 'questions', dataSourceId] });
      void queryClient.invalidateQueries({ queryKey: dbEnrichmentQueryKeys.metrics(dataSourceId) });
    },
  });
}

export function useDismissDbEnrichmentQuestionMutation(dataSourceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data, response } = await apiPost<{ success: boolean; error?: string }>(
        `/api/db-enrichment/questions/${id}/dismiss`,
      );
      if (!response.ok || !data.success) {
        throw new Error(data.error || response.statusText || 'Failed to dismiss the question.');
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...dbEnrichmentQueryKeys.all, 'questions', dataSourceId] });
      void queryClient.invalidateQueries({ queryKey: dbEnrichmentQueryKeys.metrics(dataSourceId) });
    },
  });
}

export const formatDbEnrichmentError = (error: unknown): string => (
  isApiError(error) ? formatApiErrorMessage(error) : (error instanceof Error ? error.message : 'Something went wrong.')
);
