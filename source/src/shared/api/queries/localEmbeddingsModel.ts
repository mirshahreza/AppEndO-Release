import { useQuery } from '@tanstack/react-query';
import { formatQueryError } from '../client';
import type { LocalEmbeddingsModelStatus } from '../contracts/ai/localEmbeddingsModel';
import { aiModelsQueryKeys, fetchAiSettings } from './aiModels';
import { apiGet } from '../client';

export const localEmbeddingsModelQueryKeys = {
  all: ['local-embeddings-model'] as const,
  status: () => [...localEmbeddingsModelQueryKeys.all, 'status'] as const,
};

type LocalEmbeddingsModelStatusResponse = {
  success: boolean;
  status: LocalEmbeddingsModelStatus;
  error?: string;
};

const getLoadErrorMessage = (data: unknown, fallback: string): string => {
  if (!data || typeof data !== 'object') {
    return fallback;
  }

  const payload = data as { error?: string };
  return typeof payload.error === 'string' && payload.error.trim() ? payload.error : fallback;
};

async function fetchLocalEmbeddingsModelStatus(signal?: AbortSignal): Promise<LocalEmbeddingsModelStatus> {
  const { data, response } = await apiGet<LocalEmbeddingsModelStatusResponse>(
    '/api/ai/local-embeddings/status',
    { signal },
  );

  if (!response.ok) {
    throw new Error(getLoadErrorMessage(data, `Failed to load local embeddings status (HTTP ${response.status}).`));
  }

  if (!data.success || !data.status) {
    throw new Error(getLoadErrorMessage(data, 'Failed to load local embeddings status.'));
  }

  return data.status;
}

async function fetchLocalEmbeddingsModelStatusFromSettings(signal?: AbortSignal): Promise<LocalEmbeddingsModelStatus> {
  const settings = await fetchAiSettings(signal);
  if (settings.localEmbeddings) {
    return settings.localEmbeddings;
  }
  return fetchLocalEmbeddingsModelStatus(signal);
}

export const useLocalEmbeddingsModelStatusQuery = (enabled = true) => useQuery({
  queryKey: localEmbeddingsModelQueryKeys.status(),
  queryFn: ({ signal }) => fetchLocalEmbeddingsModelStatusFromSettings(signal),
  enabled,
  retry: 1,
  refetchInterval: (query) => (
    query.state.data?.state === 'downloading' ? 1500 : false
  ),
});

export const formatLocalEmbeddingsModelStatusError = (error: unknown): string => (
  formatQueryError(error, 'Failed to load local embeddings status.')
);
