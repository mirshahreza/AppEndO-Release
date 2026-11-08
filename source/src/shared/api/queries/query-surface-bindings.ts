import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QuerySurfaceBindingDocument } from '../contracts/data-api';
import { apiGet, apiPut, type ApiMutationResponse } from '../client';

export const querySurfaceBindingKeys = {
  all: ['query-surface-binding'] as const,
  binding: (edgeModelId: string) => [...querySurfaceBindingKeys.all, edgeModelId] as const,
};

export async function fetchQuerySurfaceBinding(edgeModelId: string): Promise<QuerySurfaceBindingDocument> {
  const { data } = await apiGet<ApiMutationResponse>(
    `/api/data-api/models/${encodeURIComponent(edgeModelId)}/query-surface-binding`,
  );
  return data.item as QuerySurfaceBindingDocument;
}

export const useQuerySurfaceBindingQuery = (edgeModelId: string, enabled = true) => useQuery({
  queryKey: querySurfaceBindingKeys.binding(edgeModelId),
  queryFn: () => fetchQuerySurfaceBinding(edgeModelId),
  enabled: enabled && Boolean(edgeModelId?.trim()),
});

export const useSaveQuerySurfaceBindingMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: QuerySurfaceBindingDocument) => {
      const { data } = await apiPut<ApiMutationResponse>(
        `/api/data-api/models/${encodeURIComponent(payload.edgeModelId)}/query-surface-binding`,
        payload,
      );
      return data.item as QuerySurfaceBindingDocument;
    },
    onSuccess: (binding) => {
      queryClient.invalidateQueries({ queryKey: querySurfaceBindingKeys.binding(binding.edgeModelId) });
      queryClient.invalidateQueries({ queryKey: ['data-api', 'query-surfaces', binding.edgeModelId] });
    },
  });
};
