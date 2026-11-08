import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiGet, apiPost, resolveApiMutationErrorMessage } from '../client';
import type {
  HwyEtlConsoleStatusPayload,
  HwyEtlRunOptions,
  HwyEtlRunRecord,
  HwyEtlStartRunRequest,
  HwyEtlSyncPlanPayload,
} from '../contracts/hwy/etlConsole';

export const hwyEtlConsoleQueryKeys = {
  all: ['hwy-etl-console'] as const,
  status: () => [...hwyEtlConsoleQueryKeys.all, 'status'] as const,
  syncPlan: (options: HwyEtlRunOptions) => [...hwyEtlConsoleQueryKeys.all, 'sync-plan', options] as const,
};

type StatusResponse = { success: boolean; status: HwyEtlConsoleStatusPayload };
type StartRunResponse = { success: boolean; run?: HwyEtlRunRecord; message?: string };

export function useHwyEtlConsoleStatusQuery(enabled = true) {
  return useQuery({
    queryKey: hwyEtlConsoleQueryKeys.status(),
    queryFn: async () => {
      const { data, response } = await apiGet<StatusResponse>('/api/hwy/etl-console/status');
      if (!response.ok || !data.success) {
        const apiError = resolveApiMutationErrorMessage(data, '');
        const fallback = response.status === 404 || apiError.includes('API route not found')
          ? 'Restart AppEndO (npm run restart) so /api/hwy/etl-console routes load on the server.'
          : 'Could not load ETL status.';
        throw new Error(apiError || fallback);
      }
      return data.status;
    },
    enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.activeRun?.status;
      const queued = (query.state.data?.queueLength ?? 0) > 0;
      if (status === 'running' || status === 'queued' || queued) {
        return 1000;
      }
      return 8000;
    },
  });
}

export function useHwyEtlStartRunMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: HwyEtlStartRunRequest) => {
      const { data, response } = await apiPost<StartRunResponse>('/api/hwy/etl-console/runs', body);
      if (!response.ok || !data.success) {
        throw new Error(resolveApiMutationErrorMessage(data, 'Could not start ETL run.'));
      }
      return data.run;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hwyEtlConsoleQueryKeys.status() });
    },
  });
}

type SyncPlanResponse = { success: boolean; plan?: HwyEtlSyncPlanPayload; message?: string };

export function useHwyEtlSyncPlanQuery(options: HwyEtlRunOptions, enabled: boolean) {
  return useQuery({
    queryKey: hwyEtlConsoleQueryKeys.syncPlan(options),
    queryFn: async () => {
      const { data, response } = await apiPost<SyncPlanResponse>(
        '/api/hwy/etl-console/sync-plan',
        { options },
      );
      if (!response.ok || !data.success || !data.plan) {
        throw new Error(resolveApiMutationErrorMessage(data, 'Could not compute sync plan.'));
      }
      return data.plan;
    },
    enabled,
    staleTime: 4000,
    retry: 1,
  });
}

export function useHwyEtlCancelRunMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, response } = await apiPost<{ success: boolean; message?: string }>(
        '/api/hwy/etl-console/runs/cancel',
        {},
      );
      if (!response.ok || !data.success) {
        throw new Error(resolveApiMutationErrorMessage(data, 'Could not cancel run.'));
      }
      return data.message;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hwyEtlConsoleQueryKeys.status() });
    },
  });
}
