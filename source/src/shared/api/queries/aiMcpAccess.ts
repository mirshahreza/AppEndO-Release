import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut } from '../client';
import { aiModelsQueryKeys } from './aiModels';
import { mcpServersQueryKeys } from './mcpServers';
import type {
  McpAccessCatalogResponse,
  McpAccessMeResponse,
  ReplaceMcpResourceAccessControlPayload,
  ReplaceMcpResourceAccessControlResponse,
  ReplaceRoleMcpGrantsPayload,
  ReplaceRoleMcpGrantsResponse,
  RoleMcpGrantsResponse,
} from '../contracts/ai/mcpAccess';

export const aiMcpAccessQueryKeys = {
  all: ['ai-mcp-access'] as const,
  me: () => [...aiMcpAccessQueryKeys.all, 'me'] as const,
  catalog: () => [...aiMcpAccessQueryKeys.all, 'catalog'] as const,
  role: (roleName: string) => [...aiMcpAccessQueryKeys.all, 'role', roleName] as const,
};

const getLoadErrorMessage = (data: unknown, fallback: string): string => {
  if (!data || typeof data !== 'object') {
    return fallback;
  }

  const payload = data as { error?: string };
  return typeof payload.error === 'string' && payload.error.trim() ? payload.error : fallback;
};

export async function fetchAiMcpAccessMe(signal?: AbortSignal): Promise<McpAccessMeResponse> {
  const { data, response } = await apiGet<McpAccessMeResponse>('/api/ai/mcp-access/me', { signal });

  if (!response.ok) {
    throw new Error(getLoadErrorMessage(data, `Failed to load MCP access (HTTP ${response.status}).`));
  }

  if (!data.success || !Array.isArray(data.packs) || !Array.isArray(data.mcpServers)) {
    throw new Error(getLoadErrorMessage(data, 'Failed to load MCP access.'));
  }

  return data;
}

export function useAiMcpAccessMeQuery(enabled = true) {
  return useQuery({
    queryKey: aiMcpAccessQueryKeys.me(),
    queryFn: ({ signal }) => fetchAiMcpAccessMe(signal),
    enabled,
    staleTime: 60_000,
  });
}

export async function fetchAiMcpAccessCatalog(signal?: AbortSignal): Promise<McpAccessCatalogResponse> {
  const { data, response } = await apiGet<McpAccessCatalogResponse>('/api/ai/mcp-access/catalog', { signal });

  if (!response.ok) {
    throw new Error(getLoadErrorMessage(data, `Failed to load MCP catalog (HTTP ${response.status}).`));
  }

  if (!data.success || !Array.isArray(data.packs) || !Array.isArray(data.mcpServers)) {
    throw new Error(getLoadErrorMessage(data, 'Failed to load MCP catalog.'));
  }

  return data;
}

export async function fetchRoleMcpGrants(roleName: string, signal?: AbortSignal): Promise<RoleMcpGrantsResponse> {
  const encodedRoleName = encodeURIComponent(roleName);
  const { data, response } = await apiGet<RoleMcpGrantsResponse>(
    `/api/ai/mcp-access/roles/${encodedRoleName}`,
    { signal },
  );

  if (!response.ok) {
    throw new Error(getLoadErrorMessage(data, `Failed to load role MCP grants (HTTP ${response.status}).`));
  }

  if (!data.success || !Array.isArray(data.grants)) {
    throw new Error(getLoadErrorMessage(data, 'Failed to load role MCP grants.'));
  }

  return data;
}

export function useAiMcpAccessCatalogQuery(enabled = true) {
  return useQuery({
    queryKey: aiMcpAccessQueryKeys.catalog(),
    queryFn: ({ signal }) => fetchAiMcpAccessCatalog(signal),
    enabled,
    staleTime: 60_000,
  });
}

export function useRoleMcpGrantsQuery(roleName: string | null, enabled = true) {
  return useQuery({
    queryKey: aiMcpAccessQueryKeys.role(roleName ?? ''),
    queryFn: ({ signal }) => fetchRoleMcpGrants(roleName as string, signal),
    enabled: enabled && Boolean(roleName),
    staleTime: 30_000,
  });
}

export function useReplaceRoleMcpGrantsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      roleName,
      payload,
    }: {
      roleName: string;
      payload: ReplaceRoleMcpGrantsPayload;
    }) => {
      const encodedRoleName = encodeURIComponent(roleName);
      const { data, response } = await apiPut<ReplaceRoleMcpGrantsResponse>(
        `/api/ai/mcp-access/roles/${encodedRoleName}`,
        payload,
      );
      if (!response.ok || !data.success) {
        throw new Error(getLoadErrorMessage(data, 'Failed to update role MCP grants.'));
      }
      return data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: aiMcpAccessQueryKeys.role(variables.roleName) });
      void queryClient.invalidateQueries({ queryKey: aiMcpAccessQueryKeys.me() });
    },
  });
}

export function useReplaceMcpResourceAccessControlMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      resourceId,
      payload,
    }: {
      resourceId: string;
      payload: ReplaceMcpResourceAccessControlPayload;
    }) => {
      const encodedResourceId = encodeURIComponent(resourceId);
      const { data, response } = await apiPut<ReplaceMcpResourceAccessControlResponse>(
        `/api/ai/mcp-access/resources/${encodedResourceId}/access-control`,
        payload,
      );
      if (!response.ok || !data.success) {
        throw new Error(getLoadErrorMessage(data, 'Failed to update MCP resource access control.'));
      }
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: aiMcpAccessQueryKeys.me() });
      void queryClient.invalidateQueries({ queryKey: mcpServersQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: aiModelsQueryKeys.all });
    },
  });
}
