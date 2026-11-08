import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../client';
import type { DashboardSummaryResponse } from '../contracts/dashboard/types';

export type HealthStatus = 'ok' | 'unknown';
export type ReadyStatus = 'ready' | 'not_ready' | 'unknown';

export const dashboardQueryKeys = {
  all: ['dashboard'] as const,
  health: () => [...dashboardQueryKeys.all, 'health'] as const,
  ready: () => [...dashboardQueryKeys.all, 'ready'] as const,
  summary: () => [...dashboardQueryKeys.all, 'summary'] as const,
};

const DASHBOARD_POLL_MS = 45_000;

export async function fetchHealthStatus(signal?: AbortSignal): Promise<HealthStatus> {
  try {
    const { data, response } = await apiGet<{ status?: string }>('/api/health', { signal });
    if (!response.ok) return 'unknown';
    return data.status === 'ok' ? 'ok' : 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function fetchReadyStatus(signal?: AbortSignal): Promise<ReadyStatus> {
  try {
    const { data, response } = await apiGet<{ status?: string }>('/api/ready', { signal });
    if (response.status === 503 || data.status === 'not_ready') return 'not_ready';
    if (response.ok && data.status === 'ready') return 'ready';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function fetchDashboardSummary(signal?: AbortSignal) {
  const { data, response } = await apiGet<DashboardSummaryResponse>('/api/dashboard/summary', { signal });
  if (!response.ok || !data.success) {
    throw new Error('Failed to load dashboard summary.');
  }
  return data.summary;
}

export function useHealthStatusQuery(enabled = true) {
  return useQuery({
    queryKey: dashboardQueryKeys.health(),
    queryFn: ({ signal }) => fetchHealthStatus(signal),
    enabled,
    refetchInterval: DASHBOARD_POLL_MS,
    staleTime: 30_000,
  });
}

export function useReadyStatusQuery(enabled = true) {
  return useQuery({
    queryKey: dashboardQueryKeys.ready(),
    queryFn: ({ signal }) => fetchReadyStatus(signal),
    enabled,
    refetchInterval: DASHBOARD_POLL_MS,
    staleTime: 30_000,
  });
}

export function useDashboardSummaryQuery(enabled = true) {
  return useQuery({
    queryKey: dashboardQueryKeys.summary(),
    queryFn: ({ signal }) => fetchDashboardSummary(signal),
    enabled,
    refetchInterval: DASHBOARD_POLL_MS,
    staleTime: 30_000,
  });
}
