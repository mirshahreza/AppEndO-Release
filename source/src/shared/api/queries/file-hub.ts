import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  FileHubConnectionPublic,
  FileHubConnectionWritePayload,
  FileHubRemoteEntry,
} from '../contracts/file-hub/types';
import {
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  apiRequest,
  type ApiListResponse,
  type ApiMutationResponse,
} from '../client';

export type { FileHubConnectionPublic, FileHubConnectionWritePayload, FileHubRemoteEntry };

export const fileHubQueryKeys = {
  all: ['file-hub'] as const,
  connections: () => [...fileHubQueryKeys.all, 'connections'] as const,
  files: (connectionId: string, remotePath: string) => [...fileHubQueryKeys.all, 'files', connectionId, remotePath] as const,
};

type ConnectionsResponse = ApiListResponse<FileHubConnectionPublic> & {
  items?: FileHubConnectionPublic[];
};

type ConnectionResponse = ApiMutationResponse & {
  item?: FileHubConnectionPublic;
};

type FilesResponse = ApiMutationResponse & {
  path?: string;
  items?: FileHubRemoteEntry[];
};

function requireConnectionItem(data: ConnectionResponse, fallback: string): FileHubConnectionPublic {
  if (data.item) {
    return data.item;
  }
  throw new Error(data.error || fallback);
}

export function useFileHubConnectionsQuery() {
  return useQuery({
    queryKey: fileHubQueryKeys.connections(),
    queryFn: async () => {
      const { data, response } = await apiGet<ConnectionsResponse>('/api/file-hub/connections');
      if (!response.ok || data.success === false) {
        throw new Error(data.error || 'Failed to list File Hub connections.');
      }
      return data.items ?? [];
    },
  });
}

export function useCreateFileHubConnectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: FileHubConnectionWritePayload) => {
      const { data, response } = await apiPost<ConnectionResponse>('/api/file-hub/connections', payload);
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create File Hub connection.');
      }
      return requireConnectionItem(data, 'Failed to create File Hub connection.');
    },
    onSuccess: async (item) => {
      queryClient.setQueryData<FileHubConnectionPublic[]>(fileHubQueryKeys.connections(), (current) => {
        const list = current ?? [];
        if (list.some((row) => row.id === item.id || row.key === item.key)) {
          return list.map((row) => (row.id === item.id || row.key === item.key ? item : row));
        }
        return [item, ...list];
      });
      await queryClient.invalidateQueries({ queryKey: fileHubQueryKeys.connections() });
    },
  });
}

export function useUpdateFileHubConnectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: FileHubConnectionWritePayload }) => {
      const { data, response } = await apiPut<ConnectionResponse>(`/api/file-hub/connections/${encodeURIComponent(id)}`, payload);
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update File Hub connection.');
      }
      return requireConnectionItem(data, 'Failed to update File Hub connection.');
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: fileHubQueryKeys.connections() });
    },
  });
}

export function useDeleteFileHubConnectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/api/file-hub/connections/${encodeURIComponent(id)}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: fileHubQueryKeys.connections() });
    },
  });
}

export async function listFileHubFiles(connectionId: string, remotePath: string): Promise<{ path: string; items: FileHubRemoteEntry[] }> {
  const { data } = await apiPost<FilesResponse>('/api/file-hub/files/list', { connectionId, remotePath });
  if (!data.success) {
    throw new Error(data.error || 'Failed to list remote files.');
  }
  return {
    path: data.path || remotePath || '/',
    items: data.items ?? [],
  };
}

export async function mkdirFileHubPath(connectionId: string, remotePath: string): Promise<void> {
  const { data } = await apiPost<ApiMutationResponse>('/api/file-hub/files/mkdir', { connectionId, remotePath });
  if (!data.success) {
    throw new Error(data.error || 'Failed to create remote folder.');
  }
}

export async function renameFileHubPath(connectionId: string, oldPath: string, newPath: string): Promise<void> {
  const { data } = await apiPost<ApiMutationResponse>('/api/file-hub/files/rename', { connectionId, oldPath, newPath });
  if (!data.success) {
    throw new Error(data.error || 'Failed to rename remote path.');
  }
}

export async function deleteFileHubPath(
  connectionId: string,
  remotePath: string,
  type: 'file' | 'directory',
): Promise<void> {
  const { data } = await apiPost<ApiMutationResponse>('/api/file-hub/files/delete', { connectionId, remotePath, type });
  if (!data.success) {
    throw new Error(data.error || 'Failed to delete remote path.');
  }
}

export async function uploadFileHubFiles(connectionId: string, remotePath: string, files: File[]): Promise<void> {
  const body = new FormData();
  for (const file of files) {
    body.append('files', file);
  }
  const query = new URLSearchParams({
    connectionId,
    remotePath,
  });
  const { data } = await apiRequest<ApiMutationResponse>(`/api/file-hub/files/upload?${query.toString()}`, {
    method: 'POST',
    body,
  });
  if (!data.success) {
    throw new Error(data.error || 'Failed to upload files.');
  }
}

export function buildFileHubDownloadUrl(connectionId: string, remotePath: string): string {
  const query = new URLSearchParams({ connectionId, remotePath });
  return `/api/file-hub/files/download?${query.toString()}`;
}

export function triggerFileHubDownload(connectionId: string, remotePath: string): void {
  const anchor = document.createElement('a');
  anchor.href = buildFileHubDownloadUrl(connectionId, remotePath);
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
