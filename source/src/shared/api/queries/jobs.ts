import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, type ApiMutationResponse } from '../client';
import type {
  EnqueueJobPayload,
  JobListResponse,
  JobRecord,
  JobStreamSnapshot,
} from '../contracts/jobs/types';
import { useVisibilityAwareRefetchInterval } from '../../lib/useDocumentVisibility';

const JOBS_LIST_POLL_MS = 10_000;

export type JobListItem = JobRecord;

export const jobsQueryKeys = {
  all: ['jobs'] as const,
  list: (status?: string) => [...jobsQueryKeys.all, 'list', status ?? 'all'] as const,
  detail: (jobId: number) => [...jobsQueryKeys.all, 'detail', jobId] as const,
};

export async function fetchJobsList(
  options?: { limit?: number; status?: string; signal?: AbortSignal },
): Promise<JobListResponse> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.status) params.set('status', options.status);
  const query = params.toString();
  const path = query ? `/api/jobs?${query}` : '/api/jobs';

  const { data } = await apiGet<JobListResponse>(path, { signal: options?.signal });
  return data;
}

export async function fetchJobById(jobId: number, signal?: AbortSignal): Promise<JobListItem> {
  const { data } = await apiGet<{ success: boolean; item: JobListItem }>(
    `/api/jobs/${jobId}`,
    { signal },
  );
  return data.item;
}

const sleep = (ms: number) => new Promise<void>((resolve) => {
  window.setTimeout(resolve, ms);
});

export async function waitForJobTerminalStatus(
  jobId: number,
  options?: { timeoutMs?: number; pollIntervalMs?: number; signal?: AbortSignal },
): Promise<JobListItem | null> {
  const timeoutMs = options?.timeoutMs ?? 30_000;
  const pollIntervalMs = options?.pollIntervalMs ?? 500;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (options?.signal?.aborted) return null;

    const job = await fetchJobById(jobId, options?.signal);
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return job;
    }

    await sleep(pollIntervalMs);
  }

  return null;
}

export function useJobsListQuery(options?: { limit?: number; status?: string; enabled?: boolean }) {
  const refetchInterval = useVisibilityAwareRefetchInterval(JOBS_LIST_POLL_MS);

  return useQuery({
    queryKey: jobsQueryKeys.list(options?.status),
    queryFn: async ({ signal }) => {
      const data = await fetchJobsList({
        limit: options?.limit ?? 100,
        status: options?.status,
        signal,
      });
      return data;
    },
    enabled: options?.enabled ?? true,
    refetchInterval,
  });
}

export function useEnqueueJobMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: EnqueueJobPayload) => apiPost<ApiMutationResponse & { id: number }>('/api/jobs', payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jobsQueryKeys.all });
    },
  });
}

export function useCancelJobMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: number) => apiPost<ApiMutationResponse & { item: JobRecord }>(`/api/jobs/${jobId}/cancel`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jobsQueryKeys.all });
    },
  });
}

export function useRetryJobMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: number) => apiPost<ApiMutationResponse & { id: number }>(`/api/jobs/${jobId}/retry`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jobsQueryKeys.all });
    },
  });
}

export type JobStreamHandlers = {
  onSnapshot: (snapshot: JobStreamSnapshot) => void;
  onError?: () => void;
};

export const connectJobStream = (handlers: JobStreamHandlers): (() => void) => {
  const source = new EventSource('/api/jobs/stream', { withCredentials: true });

  source.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data) as JobStreamSnapshot;
      if (payload?.type === 'snapshot') {
        handlers.onSnapshot(payload);
      }
    } catch {
      handlers.onError?.();
    }
  };

  source.onerror = () => {
    handlers.onError?.();
  };

  return () => {
    source.close();
  };
};
