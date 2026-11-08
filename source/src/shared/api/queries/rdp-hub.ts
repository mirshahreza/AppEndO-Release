import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  RdpHubConnectionPublic,
  RdpHubConnectionWritePayload,
  RdpHubSessionTicket,
  RdpHubSessionTicketPayload,
} from '../contracts/rdp-hub/types';
import {
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  type ApiListResponse,
  type ApiMutationResponse,
} from '../client';

export type { RdpHubConnectionPublic, RdpHubConnectionWritePayload, RdpHubSessionTicket };

export const rdpHubQueryKeys = {
  all: ['rdp-hub'] as const,
  connections: () => [...rdpHubQueryKeys.all, 'connections'] as const,
  status: () => [...rdpHubQueryKeys.all, 'status'] as const,
};

type ConnectionsResponse = ApiListResponse<RdpHubConnectionPublic> & {
  items?: RdpHubConnectionPublic[];
};

type ConnectionResponse = ApiMutationResponse & {
  item?: RdpHubConnectionPublic;
};

type TicketResponse = ApiMutationResponse & RdpHubSessionTicket;

type StatusResponse = ApiMutationResponse & {
  guacd?: {
    host: string;
    port: number;
    reachable: boolean;
  };
};

export function useRdpHubConnectionsQuery() {
  return useQuery({
    queryKey: rdpHubQueryKeys.connections(),
    queryFn: async () => {
      const { data } = await apiGet<ConnectionsResponse>('/api/rdp-hub/connections');
      return data.items ?? [];
    },
  });
}

export function useRdpHubStatusQuery(enabled = true) {
  return useQuery({
    queryKey: rdpHubQueryKeys.status(),
    queryFn: async () => {
      const { data } = await apiGet<StatusResponse>('/api/rdp-hub/status');
      return data.guacd ?? { host: '127.0.0.1', port: 4822, reachable: false };
    },
    enabled,
    staleTime: 15_000,
  });
}

export function useCreateRdpHubConnectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RdpHubConnectionWritePayload) => {
      const { data } = await apiPost<ConnectionResponse>('/api/rdp-hub/connections', payload);
      if (!data.item) {
        throw new Error(data.error || 'Failed to create RDP connection.');
      }
      return data.item;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: rdpHubQueryKeys.connections() });
    },
  });
}

export function useUpdateRdpHubConnectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: RdpHubConnectionWritePayload }) => {
      const { data } = await apiPut<ConnectionResponse>(`/api/rdp-hub/connections/${encodeURIComponent(id)}`, payload);
      if (!data.item) {
        throw new Error(data.error || 'Failed to update RDP connection.');
      }
      return data.item;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: rdpHubQueryKeys.connections() });
    },
  });
}

export function useDeleteRdpHubConnectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/api/rdp-hub/connections/${encodeURIComponent(id)}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: rdpHubQueryKeys.connections() });
    },
  });
}

export async function createRdpHubSessionTicket(
  id: string,
  payload: RdpHubSessionTicketPayload,
): Promise<RdpHubSessionTicket> {
  const { data } = await apiPost<TicketResponse>(
    `/api/rdp-hub/connections/${encodeURIComponent(id)}/ticket`,
    payload,
  );
  if (!data.token) {
    throw new Error(data.error || 'Failed to create RDP session ticket.');
  }
  return { token: data.token, expiresAt: data.expiresAt };
}
