import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  isSqlConsoleGeneralCollection,
  SQL_CONSOLE_GENERAL_COLLECTION_NAME,
} from '../contracts/sql-console';
import { apiDelete, apiGet, apiPatch, apiPost } from '../client';

export type SqlConsoleCollection = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  createdByUserId: number;
};

export type SqlConsoleFolder = {
  id: string;
  collectionId: string;
  parentFolderId: string | null;
  name: string;
  sortOrder: number;
};

export type SqlConsoleScript = {
  id: string;
  collectionId: string | null;
  folderId: string | null;
  name: string;
  sql: string;
  dataSourceId: string;
  sortOrder: number;
};

const collectionsKey = ['sql-console', 'collections'] as const;
const foldersKey = (collectionId: string) => ['sql-console', 'folders', collectionId] as const;
const scriptsKey = (collectionId: string) => ['sql-console', 'scripts', collectionId] as const;
const uncategorizedScriptsKey = ['sql-console', 'scripts', 'uncategorized'] as const;

function invalidateScriptsForCollection(queryClient: QueryClient, collectionId: string | null | undefined): void {
  if (collectionId) {
    void queryClient.invalidateQueries({ queryKey: scriptsKey(collectionId) });
    return;
  }
  void queryClient.invalidateQueries({ queryKey: uncategorizedScriptsKey });
}

async function resolveSqlConsoleSaveCollectionId(collectionId?: string | null): Promise<string> {
  const requested = collectionId?.trim() ?? '';
  if (requested) {
    return requested;
  }
  const { data } = await apiGet<{ success: boolean; items: SqlConsoleCollection[] }>('/api/sql-console/collections');
  const existing = (data.items ?? []).find(isSqlConsoleGeneralCollection);
  if (existing) {
    return existing.id;
  }
  const created = await apiPost<{ success: boolean; item: SqlConsoleCollection }>(
    '/api/sql-console/collections',
    { name: SQL_CONSOLE_GENERAL_COLLECTION_NAME },
  );
  return created.data.item.id;
}

export const useSqlConsoleCollectionsQuery = () => useQuery({
  queryKey: collectionsKey,
  queryFn: async () => {
    const { data } = await apiGet<{ success: boolean; items: SqlConsoleCollection[] }>('/api/sql-console/collections');
    return data.items ?? [];
  },
});

export const useCreateSqlConsoleCollectionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string }) => {
      const { data } = await apiPost<{ success: boolean; item: SqlConsoleCollection }>('/api/sql-console/collections', input);
      return data.item;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: collectionsKey });
    },
  });
};

export const useDeleteSqlConsoleCollectionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/api/sql-console/collections/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: collectionsKey });
    },
  });
};

export const useSqlConsoleFoldersQuery = (collectionId: string | null) => useQuery({
  queryKey: foldersKey(collectionId ?? ''),
  enabled: Boolean(collectionId),
  queryFn: async () => {
    const { data } = await apiGet<{ success: boolean; items: SqlConsoleFolder[] }>(
      `/api/sql-console/collections/${collectionId}/folders`,
    );
    return data.items ?? [];
  },
});

export const useCreateSqlConsoleFolderMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { collectionId: string; parentFolderId?: string | null; name: string }) => {
      const { data } = await apiPost<{ success: boolean; item: SqlConsoleFolder }>(
        `/api/sql-console/collections/${input.collectionId}/folders`,
        { parentFolderId: input.parentFolderId, name: input.name },
      );
      return data.item;
    },
    onSuccess: (_item, variables) => {
      void queryClient.invalidateQueries({ queryKey: foldersKey(variables.collectionId) });
    },
  });
};

export const useDeleteSqlConsoleFolderMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; collectionId: string }) => {
      await apiDelete(`/api/sql-console/folders/${input.id}`);
    },
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: foldersKey(variables.collectionId) });
      void queryClient.invalidateQueries({ queryKey: scriptsKey(variables.collectionId) });
    },
  });
};

export const useSqlConsoleScriptsQuery = (collectionId: string | null) => useQuery({
  queryKey: scriptsKey(collectionId ?? ''),
  enabled: Boolean(collectionId),
  queryFn: async () => {
    const { data } = await apiGet<{ success: boolean; items: SqlConsoleScript[] }>(
      `/api/sql-console/collections/${collectionId}/scripts`,
    );
    return data.items ?? [];
  },
});

export const useSqlConsoleUncategorizedScriptsQuery = () => useQuery({
  queryKey: uncategorizedScriptsKey,
  queryFn: async () => {
    const { data } = await apiGet<{ success: boolean; items: SqlConsoleScript[] }>('/api/sql-console/scripts');
    return data.items ?? [];
  },
  retry: false,
});

export const useCreateSqlConsoleScriptMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      collectionId?: string | null;
      folderId?: string | null;
      name: string;
      sql: string;
      dataSourceId: string;
    }) => {
      const collectionId = await resolveSqlConsoleSaveCollectionId(input.collectionId);
      const { data } = await apiPost<{ success: boolean; item: SqlConsoleScript }>(
        `/api/sql-console/collections/${collectionId}/scripts`,
        { ...input, collectionId },
      );
      return data.item;
    },
    onSuccess: (item) => {
      void queryClient.invalidateQueries({ queryKey: collectionsKey });
      invalidateScriptsForCollection(queryClient, item.collectionId);
    },
  });
};

export const useUpdateSqlConsoleScriptMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      collectionId?: string | null;
      folderId?: string | null;
      name?: string;
      sql?: string;
      dataSourceId?: string;
    }) => {
      const { id, collectionId: _collectionId, ...patch } = input;
      const { data } = await apiPatch<{ success: boolean; item: SqlConsoleScript }>(
        `/api/sql-console/scripts/${id}`,
        patch,
      );
      return data.item;
    },
    onSuccess: (_item, variables) => {
      invalidateScriptsForCollection(queryClient, variables.collectionId);
    },
  });
};

export const useDeleteSqlConsoleScriptMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; collectionId?: string | null }) => {
      await apiDelete(`/api/sql-console/scripts/${input.id}`);
    },
    onSuccess: (_result, variables) => {
      invalidateScriptsForCollection(queryClient, variables.collectionId);
    },
  });
};
