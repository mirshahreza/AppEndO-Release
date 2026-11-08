import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPost, apiPut } from '../client';
import type { IdentityProviderConfig, IdentityProviderPublicConfig } from '../contracts/auth/identityProviders';

export const identityProvidersQueryKeys = {
  all: ['identity-providers'] as const,
  list: () => [...identityProvidersQueryKeys.all, 'list'] as const,
};

type IdentityProvidersResponse = {
  success: boolean;
  identityProviders: IdentityProviderPublicConfig[];
};

export async function fetchIdentityProviders(signal?: AbortSignal): Promise<IdentityProviderPublicConfig[]> {
  const { data, response } = await apiGet<IdentityProvidersResponse>('/api/auth/identity-providers', { signal });
  if (!response.ok || !data.success) {
    throw new Error('Failed to load identity providers.');
  }
  return data.identityProviders;
}

export function useIdentityProvidersQuery(enabled = true) {
  return useQuery({
    queryKey: identityProvidersQueryKeys.list(),
    queryFn: ({ signal }) => fetchIdentityProviders(signal),
    enabled,
  });
}

export function useCreateIdentityProviderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: IdentityProviderConfig) => apiPost('/api/auth/identity-providers', payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: identityProvidersQueryKeys.all });
    },
  });
}

export function useUpdateIdentityProviderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<IdentityProviderPublicConfig> }) => (
      apiPut(`/api/auth/identity-providers/${id}`, payload)
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: identityProvidersQueryKeys.all });
    },
  });
}

export function useDeleteIdentityProviderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/auth/identity-providers/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: identityProvidersQueryKeys.all });
    },
  });
}

export function useTestIdentityProviderMutation() {
  return useMutation({
    mutationFn: (id: string) => apiPost(`/api/auth/identity-providers/${id}/test`, {}),
  });
}
