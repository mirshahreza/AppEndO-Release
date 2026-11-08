import { useQuery } from '@tanstack/react-query';
import { formatQueryError } from '../client';
import type { WorkspaceEmbeddingsIndexStatus } from '../contracts/ai/workspaceEmbeddingsIndexStatus';
import { aiModelsQueryKeys, fetchAiSettings } from './aiModels';
import { apiGet } from '../client';

export const workspaceEmbeddingsIndexQueryKeys = {
  all: ['workspace-embeddings-index'] as const,
  status: () => [...workspaceEmbeddingsIndexQueryKeys.all, 'status'] as const,
};

type WorkspaceEmbeddingsIndexStatusResponse = {
  success: boolean;
  status: WorkspaceEmbeddingsIndexStatus;
  error?: string;
};

const getLoadErrorMessage = (data: unknown, fallback: string): string => {
  if (!data || typeof data !== 'object') {
    return fallback;
  }

  const payload = data as { error?: string };
  return typeof payload.error === 'string' && payload.error.trim() ? payload.error : fallback;
};

async function fetchWorkspaceEmbeddingsIndexStatus(signal?: AbortSignal): Promise<WorkspaceEmbeddingsIndexStatus> {
  const { data, response } = await apiGet<WorkspaceEmbeddingsIndexStatusResponse>(
    '/api/ai/workspace-embeddings/status',
    { signal },
  );

  if (!response.ok) {
    throw new Error(getLoadErrorMessage(data, `Failed to load code index status (HTTP ${response.status}).`));
  }

  if (!data.success || !data.status) {
    throw new Error(getLoadErrorMessage(data, 'Failed to load code index status.'));
  }

  return data.status;
}

async function fetchWorkspaceEmbeddingsIndexStatusFromSettings(
  signal?: AbortSignal,
): Promise<WorkspaceEmbeddingsIndexStatus> {
  const settings = await fetchAiSettings(signal);
  if (settings.workspaceEmbeddingsIndex) {
    return settings.workspaceEmbeddingsIndex;
  }
  return fetchWorkspaceEmbeddingsIndexStatus(signal);
}

export const useWorkspaceEmbeddingsIndexStatusQuery = (enabled = true) => useQuery({
  queryKey: workspaceEmbeddingsIndexQueryKeys.status(),
  queryFn: ({ signal }) => fetchWorkspaceEmbeddingsIndexStatusFromSettings(signal),
  enabled,
  retry: 1,
  refetchInterval: (query) => {
    const state = query.state.data?.state;
    return state === 'indexing' || state === 'pending' ? 2000 : false;
  },
});

export const formatWorkspaceEmbeddingsIndexStatusError = (error: unknown): string => (
  formatQueryError(error, 'Failed to load code index status.')
);
