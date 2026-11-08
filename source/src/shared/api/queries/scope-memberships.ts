import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  apiDelete,
  apiGet,
  apiPost,
  type ApiListResponse,
  type ApiMutationResponse,
} from '../client';

export type ScopeMembershipRecord = {
  id: number;
  userId: number;
  dimensionKey: string;
  nodeId: string;
  username: string;
  firstname: string | null;
  lastname: string | null;
  email: string | null;
  displayName: string;
  avatarUrl?: string | null;
};

export type ScopeMembershipListParams = {
  dimensionKey: string;
  nodeId?: string;
  userId?: number;
};

export type CreateScopeMembershipPayload = {
  dimensionKey: string;
  nodeId: string;
  userId: number;
};

export const scopeMembershipQueryKeys = {
  all: ['scope-memberships'] as const,
  list: (params: ScopeMembershipListParams) => [...scopeMembershipQueryKeys.all, 'list', params] as const,
  events: (params: ScopeMembershipEventListParams) => (
    [...scopeMembershipQueryKeys.all, 'events', params] as const
  ),
};

export type ScopeMembershipEventRecord = {
  id: number;
  dimensionKey: string;
  nodeId: string;
  userId: number;
  eventType: string;
  actorUserId: number | null;
  createdAt: string | null;
  displayName: string;
  actorDisplayName: string | null;
};

export type ScopeMembershipEventListParams = {
  dimensionKey: string;
  nodeId: string;
  limit?: number;
};

export async function fetchScopeMembershipEvents(
  params: ScopeMembershipEventListParams,
): Promise<ScopeMembershipEventRecord[]> {
  const search = new URLSearchParams();
  search.set('dimensionKey', params.dimensionKey);
  search.set('nodeId', params.nodeId);
  if (params.limit != null) search.set('limit', String(params.limit));

  const { data, response } = await apiGet<ApiListResponse>(
    `/api/scope-memberships/events?${search.toString()}`,
  );
  if (!response.ok || !data.success) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load membership history.');
  }
  return (data.items || []) as ScopeMembershipEventRecord[];
}

export async function fetchScopeMemberships(
  params: ScopeMembershipListParams,
): Promise<ScopeMembershipRecord[]> {
  const search = new URLSearchParams();
  search.set('dimensionKey', params.dimensionKey);
  if (params.nodeId) search.set('nodeId', params.nodeId);
  if (params.userId != null) search.set('userId', String(params.userId));

  const { data, response } = await apiGet<ApiListResponse>(
    `/api/scope-memberships?${search.toString()}`,
  );
  if (!response.ok || !data.success) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load memberships.');
  }
  return (data.items || []) as ScopeMembershipRecord[];
}

export async function createScopeMembership(
  body: CreateScopeMembershipPayload,
): Promise<ScopeMembershipRecord> {
  const { data, response } = await apiPost<ApiMutationResponse & { item?: ScopeMembershipRecord }>(
    '/api/scope-memberships',
    body,
  );
  if (!response.ok || !data.success || !data.item) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to add member.');
  }
  return data.item;
}

export async function deleteScopeMembership(id: number): Promise<void> {
  const { data, response } = await apiDelete<ApiMutationResponse>(`/api/scope-memberships/${id}`);
  if (!response.ok || !data.success) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to remove member.');
  }
}

export type ScopeRoleMembershipRecord = {
  id: number;
  roleName: string;
  dimensionKey: string;
  nodeId: string;
};

export type ScopeRoleMembershipEventRecord = {
  id: number;
  dimensionKey: string;
  nodeId: string;
  roleName: string;
  eventType: string;
  actorUserId: number | null;
  createdAt: string | null;
  actorDisplayName: string | null;
};

export type CreateScopeRoleMembershipPayload = {
  dimensionKey: string;
  nodeId: string;
  roleName: string;
};

export async function fetchScopeRoleMemberships(
  params: { dimensionKey: string; nodeId: string },
): Promise<ScopeRoleMembershipRecord[]> {
  const search = new URLSearchParams();
  search.set('dimensionKey', params.dimensionKey);
  search.set('nodeId', params.nodeId);
  const { data, response } = await apiGet<ApiListResponse>(
    `/api/scope-memberships/roles?${search.toString()}`,
  );
  if (!response.ok || !data.success) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load role memberships.');
  }
  return (data.items || []) as ScopeRoleMembershipRecord[];
}

export async function fetchScopeRoleMembershipEvents(
  params: { dimensionKey: string; nodeId: string; limit?: number },
): Promise<ScopeRoleMembershipEventRecord[]> {
  const search = new URLSearchParams();
  search.set('dimensionKey', params.dimensionKey);
  search.set('nodeId', params.nodeId);
  if (params.limit != null) search.set('limit', String(params.limit));
  const { data, response } = await apiGet<ApiListResponse>(
    `/api/scope-memberships/roles/events?${search.toString()}`,
  );
  if (!response.ok || !data.success) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load role membership history.');
  }
  return (data.items || []) as ScopeRoleMembershipEventRecord[];
}

export async function createScopeRoleMembership(
  body: CreateScopeRoleMembershipPayload,
): Promise<ScopeRoleMembershipRecord> {
  const { data, response } = await apiPost<ApiMutationResponse & { item?: ScopeRoleMembershipRecord }>(
    '/api/scope-memberships/roles',
    body,
  );
  if (!response.ok || !data.success || !data.item) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to add role.');
  }
  return data.item;
}

export async function deleteScopeRoleMembership(id: number): Promise<void> {
  const { data, response } = await apiDelete<ApiMutationResponse>(`/api/scope-memberships/roles/${id}`);
  if (!response.ok || !data.success) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to remove role.');
  }
}

export function useScopeRoleMembershipsQuery(
  params: { dimensionKey: string; nodeId?: string },
  enabled = true,
) {
  return useQuery({
    queryKey: [...scopeMembershipQueryKeys.all, 'roles', params] as const,
    queryFn: () => fetchScopeRoleMemberships({
      dimensionKey: params.dimensionKey,
      nodeId: params.nodeId || '',
    }),
    enabled: enabled && Boolean(params.dimensionKey && params.nodeId),
  });
}

export function useScopeRoleMembershipEventsQuery(
  params: { dimensionKey: string; nodeId: string; limit?: number },
  enabled = true,
) {
  return useQuery({
    queryKey: [...scopeMembershipQueryKeys.all, 'role-events', params] as const,
    queryFn: () => fetchScopeRoleMembershipEvents(params),
    enabled: enabled && Boolean(params.dimensionKey && params.nodeId),
  });
}

export function useCreateScopeRoleMembershipMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createScopeRoleMembership,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: scopeMembershipQueryKeys.all });
    },
  });
}

export function useDeleteScopeRoleMembershipMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteScopeRoleMembership,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: scopeMembershipQueryKeys.all });
    },
  });
}

export function useScopeMembershipsQuery(params: ScopeMembershipListParams, enabled = true) {
  return useQuery({
    queryKey: scopeMembershipQueryKeys.list(params),
    queryFn: () => fetchScopeMemberships(params),
    enabled: enabled && Boolean(params.dimensionKey),
  });
}

export function useScopeMembershipEventsQuery(
  params: ScopeMembershipEventListParams,
  enabled = true,
) {
  return useQuery({
    queryKey: scopeMembershipQueryKeys.events(params),
    queryFn: () => fetchScopeMembershipEvents(params),
    enabled: enabled && Boolean(params.dimensionKey && params.nodeId),
  });
}

export function useCreateScopeMembershipMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createScopeMembership,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: scopeMembershipQueryKeys.all });
    },
  });
}

export function useDeleteScopeMembershipMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteScopeMembership,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: scopeMembershipQueryKeys.all });
    },
  });
}
