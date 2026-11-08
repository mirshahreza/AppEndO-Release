import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPost, apiPut } from '../client';
import type {
  CronPreviewResponse,
  ScheduledTaskEntry,
  SchedulerSettings,
  SchedulerSnapshot,
} from '../contracts/scheduler/types';

export const schedulerQueryKeys = {
  all: ['scheduler'] as const,
  snapshot: () => [...schedulerQueryKeys.all, 'snapshot'] as const,
  cronPreview: (cron: string, timezone: string) => (
    [...schedulerQueryKeys.all, 'cron-preview', cron, timezone] as const
  ),
};

type SchedulerSnapshotResponse = {
  success: boolean;
  scheduler: SchedulerSnapshot;
};

type CronPreviewApiResponse = CronPreviewResponse & { success: boolean };

export async function fetchSchedulerSnapshot(signal?: AbortSignal): Promise<SchedulerSnapshot> {
  const { data } = await apiGet<SchedulerSnapshotResponse>('/api/scheduler', { signal });
  return data.scheduler;
}

export async function fetchCronPreview(
  cron: string,
  timezone: string,
  signal?: AbortSignal,
): Promise<CronPreviewResponse> {
  const params = new URLSearchParams({ cron, timezone, count: '5' });
  const { data } = await apiGet<CronPreviewApiResponse>(`/api/scheduler/cron/preview?${params}`, { signal });
  return {
    cron: data.cron,
    timezone: data.timezone,
    nextRuns: data.nextRuns,
  };
}

export function useSchedulerSnapshotQuery() {
  return useQuery({
    queryKey: schedulerQueryKeys.snapshot(),
    queryFn: ({ signal }) => fetchSchedulerSnapshot(signal),
  });
}

export function useCronPreviewQuery(cron: string, timezone: string, enabled: boolean) {
  return useQuery({
    queryKey: schedulerQueryKeys.cronPreview(cron, timezone),
    queryFn: ({ signal }) => fetchCronPreview(cron, timezone, signal),
    enabled: enabled && Boolean(cron.trim()),
  });
}

export function useReplaceSchedulerSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SchedulerSettings) => apiPut('/api/scheduler', payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: schedulerQueryKeys.all });
    },
  });
}

export function useCreateScheduledTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ScheduledTaskEntry) => apiPost('/api/scheduler/tasks', payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: schedulerQueryKeys.all });
    },
  });
}

export function useUpdateScheduledTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ScheduledTaskEntry> }) => (
      apiPut(`/api/scheduler/tasks/${id}`, payload)
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: schedulerQueryKeys.all });
    },
  });
}

export function useDeleteScheduledTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/scheduler/tasks/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: schedulerQueryKeys.all });
    },
  });
}

export function useRunScheduledTaskNowMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiPost<{ success: boolean; jobId: number }>(
        `/api/scheduler/tasks/${id}/run-now`,
        {},
      );
      return data.jobId;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: schedulerQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}
