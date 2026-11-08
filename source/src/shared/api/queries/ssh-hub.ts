import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  SshHubConnectionPublic,
  SshHubConnectionWritePayload,
} from '../contracts/ssh-hub/types';
import {
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  type ApiListResponse,
  type ApiMutationResponse,
} from '../client';

export type { SshHubConnectionPublic, SshHubConnectionWritePayload };

export const sshHubQueryKeys = {
  all: ['ssh-hub'] as const,
  connections: () => [...sshHubQueryKeys.all, 'connections'] as const,
};

type ConnectionsResponse = ApiListResponse<SshHubConnectionPublic> & {
  items?: SshHubConnectionPublic[];
};

type ConnectionResponse = ApiMutationResponse & {
  item?: SshHubConnectionPublic;
};

function upsertSshHubConnection(
  queryClient: ReturnType<typeof useQueryClient>,
  item: SshHubConnectionPublic,
): void {
  queryClient.setQueryData<SshHubConnectionPublic[]>(sshHubQueryKeys.connections(), (prev) => {
    const list = prev ?? [];
    return [item, ...list.filter((row) => row.id !== item.id && row.key !== item.key)];
  });
}

export function useSshHubConnectionsQuery() {
  return useQuery({
    queryKey: sshHubQueryKeys.connections(),
    queryFn: async () => {
      const { data } = await apiGet<ConnectionsResponse>('/api/ssh-hub/connections');
      return data.items ?? [];
    },
  });
}

export function useCreateSshHubConnectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SshHubConnectionWritePayload) => {
      const { data } = await apiPost<ConnectionResponse>('/api/ssh-hub/connections', payload);
      if (!data.item) {
        throw new Error(data.error || 'Failed to create SSH connection.');
      }
      return data.item;
    },
    onSuccess: async (item) => {
      upsertSshHubConnection(queryClient, item);
      await queryClient.invalidateQueries({ queryKey: sshHubQueryKeys.connections() });
    },
  });
}

export function useUpdateSshHubConnectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: SshHubConnectionWritePayload }) => {
      const { data } = await apiPut<ConnectionResponse>(`/api/ssh-hub/connections/${encodeURIComponent(id)}`, payload);
      if (!data.item) {
        throw new Error(data.error || 'Failed to update SSH connection.');
      }
      return data.item;
    },
    onSuccess: async (item) => {
      upsertSshHubConnection(queryClient, item);
      await queryClient.invalidateQueries({ queryKey: sshHubQueryKeys.connections() });
    },
  });
}

export function useDeleteSshHubConnectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/api/ssh-hub/connections/${encodeURIComponent(id)}`);
    },
    onSuccess: async (_result, id) => {
      queryClient.setQueryData<SshHubConnectionPublic[]>(sshHubQueryKeys.connections(), (prev) => (
        (prev ?? []).filter((row) => row.id !== id)
      ));
      await queryClient.invalidateQueries({ queryKey: sshHubQueryKeys.connections() });
    },
  });
}
