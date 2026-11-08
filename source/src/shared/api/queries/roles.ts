import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { CreateRolePayload, RoleRecord, UpdateRolePayload } from '../contracts/roles/types';
import { apiDelete, apiGet, apiPost, apiPut, type ApiListResponse } from '../client';
import { RECORDS_LIST_QUERY_OPTIONS } from './recordsListQueryOptions';
import { usersQueryKeys } from './users';


export type { CreateRolePayload, RoleRecord, UpdateRolePayload };

export const rolesQueryKeys = {
  all: ['roles'] as const,
  list: () => [...rolesQueryKeys.all, 'list'] as const,
};

const getRolesLoadErrorMessage = (data: unknown, fallback: string): string => {
  if (!data || typeof data !== 'object') {
    return fallback;
  }

  const payload = data as { error?: string };
  return typeof payload.error === 'string' && payload.error.trim() ? payload.error : fallback;
};

export async function fetchRolesList(signal?: AbortSignal): Promise<RoleRecord[]> {
  const { data, response } = await apiGet<ApiListResponse<RoleRecord>>('/api/roles', { signal });

  if (!response.ok) {
    throw new Error(getRolesLoadErrorMessage(data, `Failed to load roles (HTTP ${response.status}).`));
  }

  if (!data.success) {
    throw new Error(getRolesLoadErrorMessage(data, 'Failed to load roles.'));
  }

  return (data.items ?? []) as RoleRecord[];
}

const invalidateRoleQueries = (queryClient: QueryClient) => {
  void queryClient.invalidateQueries({ queryKey: rolesQueryKeys.all });
  void queryClient.invalidateQueries({ queryKey: usersQueryKeys.all });
};

export function useRolesListQuery() {
  return useQuery({
    queryKey: rolesQueryKeys.list(),
    queryFn: ({ signal }) => fetchRolesList(signal),
    ...RECORDS_LIST_QUERY_OPTIONS,
  });
}

/** @alias useRolesListQuery */
export const useRolesQuery = useRolesListQuery;

export function useCreateRoleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateRolePayload) => apiPost('/api/roles', payload),
    onSuccess: ({ data }) => {
      if (data.success) {
        invalidateRoleQueries(queryClient);
      }
    },
  });
}

export function useUpdateRoleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roleId, payload }: { roleId: number; payload: UpdateRolePayload }) =>
      apiPut(`/api/roles/${roleId}`, payload),
    onSuccess: ({ data }) => {
      if (data.success) {
        invalidateRoleQueries(queryClient);
      }
    },
  });
}

export function useDeleteRoleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (roleId: number) => apiDelete(`/api/roles/${roleId}`),
    onSuccess: ({ data }) => {
      if (data.success) {
        invalidateRoleQueries(queryClient);
      }
    },
  });
}
