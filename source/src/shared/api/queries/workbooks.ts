import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPatch, apiPost } from '../client';
import type { FunctionAccessControl } from '../contracts/server-functions/accessControl';
import type { WorkbookAccessPermission } from '../contracts/workbooks/access';
import type { WorkbookListItem, WorkbookRecord, WorkbookSheet } from '../contracts/workbooks/types';

export type { WorkbookListItem, WorkbookRecord };

const workbooksKey = ['workbooks'] as const;
const listKey = [...workbooksKey, 'list'] as const;
const sharedListKey = [...workbooksKey, 'shared'] as const;
const itemKey = (id: string) => [...workbooksKey, 'item', id] as const;
const openKey = (id: string) => [...workbooksKey, 'open', id] as const;

type ListResponse = { success: boolean; items?: WorkbookListItem[]; error?: string };
type ItemResponse = { success: boolean; item?: WorkbookRecord; error?: string };
export type ResolveUsernameResponse = {
  success: boolean;
  exists: boolean;
  userId?: number;
  username?: string;
  displayName?: string;
  accessKey?: string;
  avatar?: string | null;
  error?: string;
};

export const useWorkbooksListQuery = () => useQuery({
  queryKey: listKey,
  queryFn: async () => {
    const { data } = await apiGet<ListResponse>('/api/workbooks');
    return data.items ?? [];
  },
});

export const useSharedWorkbooksListQuery = (enabled: boolean) => useQuery({
  queryKey: sharedListKey,
  enabled,
  queryFn: async () => {
    const { data } = await apiGet<ListResponse>('/api/workbooks/shared');
    return data.items ?? [];
  },
});

export const useWorkbookQuery = (id: string | null) => useQuery({
  queryKey: itemKey(id ?? ''),
  enabled: Boolean(id),
  queryFn: async () => {
    const { data } = await apiGet<ItemResponse>(`/api/workbooks/${encodeURIComponent(id ?? '')}`);
    if (!data.item) {
      throw new Error(data.error || 'Workbook not found.');
    }
    return data.item;
  },
});

export const useOpenWorkbookQuery = (id: string | null) => useQuery({
  queryKey: openKey(id ?? ''),
  enabled: Boolean(id),
  retry: false,
  queryFn: async () => {
    const { data, response } = await apiGet<ItemResponse>(`/api/workbooks/${encodeURIComponent(id ?? '')}/open`);
    if (response.status === 401) {
      const error = new Error(data.error || 'Authentication required.');
      (error as Error & { status: number }).status = 401;
      throw error;
    }
    if (!data.item) {
      const error = new Error(data.error || 'Workbook not found.');
      (error as Error & { status: number }).status = response.status;
      throw error;
    }
    return data.item;
  },
});

export const useCreateWorkbookMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string }) => {
      const { data } = await apiPost<ItemResponse>('/api/workbooks', input);
      if (!data.item) {
        throw new Error(data.error || 'Failed to create workbook.');
      }
      return data.item;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workbooksKey });
    },
  });
};

export const useUpdateWorkbookMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      sheets?: WorkbookSheet[];
    }) => {
      const { data } = await apiPatch<ItemResponse>(`/api/workbooks/${encodeURIComponent(input.id)}`, input);
      if (!data.item) {
        throw new Error(data.error || 'Failed to save workbook.');
      }
      return data.item;
    },
    onSuccess: (item) => {
      queryClient.setQueryData(itemKey(item.id), item);
      void queryClient.invalidateQueries({ queryKey: listKey });
      void queryClient.invalidateQueries({ queryKey: sharedListKey });
    },
  });
};

export const useUpdateOpenWorkbookMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      sheets?: WorkbookSheet[];
    }) => {
      const { data } = await apiPatch<ItemResponse>(`/api/workbooks/${encodeURIComponent(input.id)}/open`, input);
      if (!data.item) {
        throw new Error(data.error || 'Failed to save workbook.');
      }
      return data.item;
    },
    onSuccess: (item) => {
      queryClient.setQueryData(openKey(item.id), item);
    },
  });
};

export const useUpdateWorkbookAccessMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      accessControl: FunctionAccessControl;
      permission: WorkbookAccessPermission;
    }) => {
      const { data } = await apiPatch<ItemResponse>(`/api/workbooks/${encodeURIComponent(input.id)}`, {
        accessControl: input.accessControl,
        permission: input.permission,
      });
      if (!data.item) {
        throw new Error(data.error || 'Failed to update workbook sharing.');
      }
      return data.item;
    },
    onSuccess: (item) => {
      queryClient.setQueryData(itemKey(item.id), item);
      void queryClient.invalidateQueries({ queryKey: listKey });
    },
  });
};

export const useResolveWorkbookUsernameMutation = () => useMutation({
  mutationFn: async (username: string) => {
    const { data } = await apiGet<ResolveUsernameResponse>(
      `/api/workbooks/resolve-username?username=${encodeURIComponent(username)}`,
    );
    return data;
  },
});

export const useDeleteWorkbookMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiDelete<{ success: boolean; error?: string }>(`/api/workbooks/${encodeURIComponent(id)}`);
      if (data.success === false) {
        throw new Error(data.error || 'Failed to delete workbook.');
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workbooksKey });
    },
  });
};
