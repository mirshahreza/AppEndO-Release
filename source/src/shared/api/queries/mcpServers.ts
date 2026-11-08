import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPost, apiPut } from '../client';
import type { AiMcpServerConfig, AiMcpServerPublicConfig } from '../contracts/ai/types';
import { aiModelsQueryKeys } from './aiModels';

export const mcpServersQueryKeys = {
  all: ['mcp-servers'] as const,
  servers: () => [...mcpServersQueryKeys.all, 'servers'] as const,
};

type McpServersApiResponse = {
  success: boolean;
  mcpServers: AiMcpServerPublicConfig[];
};

const getLoadErrorMessage = (data: unknown, fallback: string): string => {
  if (!data || typeof data !== 'object') {
    return fallback;
  }

  const payload = data as { error?: string };
  return typeof payload.error === 'string' && payload.error.trim() ? payload.error : fallback;
};

export async function fetchMcpServers(signal?: AbortSignal): Promise<AiMcpServerPublicConfig[]> {
  const { data, response } = await apiGet<McpServersApiResponse>('/api/ai/mcp-servers', { signal });

  if (!response.ok) {
    throw new Error(getLoadErrorMessage(data, `Failed to load MCP servers (HTTP ${response.status}).`));
  }

  if (!data.success || !Array.isArray(data.mcpServers)) {
    throw new Error(getLoadErrorMessage(data, 'Failed to load MCP servers.'));
  }

  return data.mcpServers;
}

export function useMcpServersQuery(enabled = true) {
  return useQuery({
    queryKey: mcpServersQueryKeys.servers(),
    queryFn: ({ signal }) => fetchMcpServers(signal),
    enabled,
  });
}

export function useCreateMcpServerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AiMcpServerConfig) => apiPost('/api/ai/mcp-servers', payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mcpServersQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: aiModelsQueryKeys.all });
    },
  });
}

export function useUpdateMcpServerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<AiMcpServerConfig> }) => (
      apiPut(`/api/ai/mcp-servers/${id}`, payload)
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mcpServersQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: aiModelsQueryKeys.all });
    },
  });
}

export function useDeleteMcpServerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/ai/mcp-servers/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mcpServersQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: aiModelsQueryKeys.all });
    },
  });
}

export function useTestMcpServerMutation() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiPost<{ success: boolean; message?: string; toolCount?: number; error?: string }>(
        `/api/ai/mcp-servers/${id}/test`,
        {},
      );
      return data;
    },
  });
}
