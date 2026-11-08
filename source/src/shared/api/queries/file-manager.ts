import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  FileManagerConfig,
  FileManagerContent,
  FileManagerEntry,
  FileManagerExtractResult,
  FileManagerScope,
  FileManagerEmptyFolderResult,
  FileManagerUploadResult,
  FileManagerZipContent,
  FileManagerZipEntriesResult,
  FileManagerZipEntry,
  FileManagerZipUploadResult,
} from '../contracts/file-manager/types';
import {
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  apiRequest,
  type ApiMutationResponse,
} from '../client';

type ApiDataResponse<T> = ApiMutationResponse & {
  data?: T;
};

export type {
  FileManagerConfig,
  FileManagerContent,
  FileManagerEntry,
  FileManagerExtractResult,
  FileManagerScope,
  FileManagerUploadResult,
  FileManagerZipContent,
  FileManagerZipEntriesResult,
  FileManagerZipEntry,
  FileManagerZipUploadResult,
};

export const fileManagerQueryKeys = {
  all: ['file-manager'] as const,
  config: () => [...fileManagerQueryKeys.all, 'config'] as const,
  entries: (path: string, scope: FileManagerScope) => [...fileManagerQueryKeys.all, 'entries', scope, path] as const,
  content: (path: string, scope: FileManagerScope) => [...fileManagerQueryKeys.all, 'content', scope, path] as const,
  zipEntries: (archivePath: string, scope: FileManagerScope) => (
    [...fileManagerQueryKeys.all, 'zip-entries', scope, archivePath] as const
  ),
  zipContent: (archivePath: string, entryPath: string, scope: FileManagerScope) => (
    [...fileManagerQueryKeys.all, 'zip-content', scope, archivePath, entryPath] as const
  ),
};

const getErrorMessage = (data: unknown, fallback: string): string => {
  if (!data || typeof data !== 'object') {
    return fallback;
  }

  const payload = data as { error?: string };
  return typeof payload.error === 'string' && payload.error.trim() ? payload.error : fallback;
};

const invalidateFileManagerQueries = (queryClient: QueryClient) => {
  void queryClient.invalidateQueries({ queryKey: fileManagerQueryKeys.all });
};

export async function fetchFileManagerConfig(): Promise<FileManagerConfig> {
  const { data, response } = await apiGet<ApiDataResponse<FileManagerConfig>>('/api/file-manager/config');
  if (!response.ok || !data.success || !data.data) {
    throw new Error(getErrorMessage(data, 'Failed to load file manager config.'));
  }
  return data.data;
}

export async function fetchFileManagerEntries(path: string, scope: FileManagerScope): Promise<FileManagerEntry[]> {
  const searchParams = new URLSearchParams();
  if (path.trim()) {
    searchParams.set('path', path);
  }
  searchParams.set('scope', scope);
  const queryString = searchParams.toString();
  const url = queryString ? `/api/file-manager/entries?${queryString}` : '/api/file-manager/entries';

  const { data, response } = await apiGet<ApiDataResponse<FileManagerEntry[]>>(url);
  if (!response.ok || !data.success || !Array.isArray(data.data)) {
    throw new Error(getErrorMessage(data, 'Failed to load directory entries.'));
  }
  return data.data;
}

export async function fetchFileManagerContent(path: string, scope: FileManagerScope): Promise<FileManagerContent> {
  const searchParams = new URLSearchParams({ path, scope });
  const { data, response } = await apiGet<ApiDataResponse<FileManagerContent>>(
    `/api/file-manager/content?${searchParams.toString()}`,
  );
  if (!response.ok || !data.success || !data.data) {
    throw new Error(getErrorMessage(data, 'Failed to load file content.'));
  }
  return data.data;
}

export function buildFileManagerRawUrl(path: string, scope: FileManagerScope): string {
  const searchParams = new URLSearchParams({ path, scope });
  return `/api/file-manager/raw?${searchParams.toString()}`;
}

export function useFileManagerConfigQuery() {
  return useQuery({
    queryKey: fileManagerQueryKeys.config(),
    queryFn: fetchFileManagerConfig,
  });
}

export function useFileManagerEntriesQuery(path: string, scope: FileManagerScope, enabled = true) {
  return useQuery({
    queryKey: fileManagerQueryKeys.entries(path, scope),
    queryFn: () => fetchFileManagerEntries(path, scope),
    enabled,
  });
}

export function useFileManagerContentQuery(path: string | null, scope: FileManagerScope) {
  return useQuery({
    queryKey: fileManagerQueryKeys.content(path ?? '', scope),
    queryFn: () => fetchFileManagerContent(path ?? '', scope),
    enabled: Boolean(path?.trim()),
  });
}

export function useWriteFileManagerContentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { path: string; content: string; scope: FileManagerScope }) => {
      const { data, response } = await apiPut<ApiDataResponse<{ path: string }>>(
        '/api/file-manager/content',
        input,
      );
      if (!response.ok || !data.success) {
        throw new Error(getErrorMessage(data, 'Failed to save file.'));
      }
      return data.data;
    },
    onSuccess: () => invalidateFileManagerQueries(queryClient),
  });
}

export function useReplaceFileManagerImageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { path: string; file: File; scope: FileManagerScope }) => {
      const formData = new FormData();
      formData.set('path', input.path);
      formData.set('scope', input.scope);
      formData.append('file', input.file, input.file.name);

      const { data, response } = await apiRequest<ApiDataResponse<FileManagerEntry>>(
        '/api/file-manager/image',
        {
          method: 'POST',
          body: formData,
        },
      );

      if (!response.ok || !data.success || !data.data) {
        throw new Error(getErrorMessage(data, 'Failed to save image.'));
      }

      return data.data;
    },
    onSuccess: () => invalidateFileManagerQueries(queryClient),
  });
}

export function useCreateFileManagerFolderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { parentPath: string; name: string; scope: FileManagerScope }) => {
      const { data, response } = await apiPost<ApiDataResponse<FileManagerEntry>>(
        '/api/file-manager/folder',
        input,
      );
      if (!response.ok || !data.success || !data.data) {
        throw new Error(getErrorMessage(data, 'Failed to create folder.'));
      }
      return data.data;
    },
    onSuccess: () => invalidateFileManagerQueries(queryClient),
  });
}

export function useCreateFileManagerFileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { parentPath: string; name: string; scope: FileManagerScope }) => {
      const { data, response } = await apiPost<ApiDataResponse<FileManagerEntry>>(
        '/api/file-manager/file',
        input,
      );
      if (!response.ok || !data.success || !data.data) {
        throw new Error(getErrorMessage(data, 'Failed to create file.'));
      }
      return data.data;
    },
    onSuccess: () => invalidateFileManagerQueries(queryClient),
  });
}

export function useRenameFileManagerEntryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { path: string; newName: string; scope: FileManagerScope }) => {
      const { data, response } = await apiPut<ApiDataResponse<FileManagerEntry>>(
        '/api/file-manager/rename',
        input,
      );
      if (!response.ok || !data.success || !data.data) {
        throw new Error(getErrorMessage(data, 'Failed to rename entry.'));
      }
      return data.data;
    },
    onSuccess: () => invalidateFileManagerQueries(queryClient),
  });
}

export function useMoveFileManagerEntryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      path: string;
      destinationParentPath: string;
      scope: FileManagerScope;
      overwrite?: boolean;
    }) => {
      const { data, response } = await apiPut<ApiDataResponse<FileManagerEntry>>(
        '/api/file-manager/move',
        input,
      );
      if (!response.ok || !data.success || !data.data) {
        const error = new Error(getErrorMessage(data, 'Failed to move entry.'));
        (error as Error & { status?: number }).status = response.status;
        throw error;
      }
      return data.data;
    },
    onSuccess: () => invalidateFileManagerQueries(queryClient),
  });
}

export function useDeleteFileManagerEntryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { path: string; scope: FileManagerScope; recursive?: boolean }) => {
      const { data, response } = await apiDelete<ApiDataResponse<{ path: string }>>(
        '/api/file-manager/entry',
        input,
      );
      if (!response.ok || !data.success) {
        throw new Error(getErrorMessage(data, 'Failed to delete entry.'));
      }
      return data.data;
    },
    onSuccess: () => invalidateFileManagerQueries(queryClient),
  });
}

export function useEmptyFileManagerFolderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { path: string; scope: FileManagerScope }) => {
      const { data, response } = await apiPost<ApiDataResponse<FileManagerEmptyFolderResult>>(
        '/api/file-manager/empty',
        input,
      );
      if (!response.ok || !data.success || !data.data) {
        throw new Error(getErrorMessage(data, 'Failed to empty folder.'));
      }
      return data.data;
    },
    onSuccess: () => invalidateFileManagerQueries(queryClient),
  });
}

export function useExtractFileManagerZipMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { path: string; scope: FileManagerScope }) => {
      const { data, response } = await apiPost<ApiDataResponse<FileManagerExtractResult>>(
        '/api/file-manager/extract',
        input,
      );
      if (!response.ok || !data.success || !data.data) {
        throw new Error(getErrorMessage(data, 'Failed to extract zip archive.'));
      }
      return data.data;
    },
    onSuccess: () => invalidateFileManagerQueries(queryClient),
  });
}

export async function uploadFileManagerFiles(
  parentPath: string,
  files: FileList | File[],
  scope: FileManagerScope,
): Promise<FileManagerUploadResult> {
  const formData = new FormData();
  formData.set('parentPath', parentPath);
  formData.set('scope', scope);
  for (const file of Array.from(files)) {
    formData.append('files', file, file.name);
  }

  const { data, response } = await apiRequest<ApiDataResponse<FileManagerUploadResult>>(
    '/api/file-manager/upload',
    {
      method: 'POST',
      body: formData,
    },
  );

  if (!response.ok || !data.success || !data.data) {
    throw new Error(getErrorMessage(data, 'Failed to upload files.'));
  }

  return data.data;
}

export function useUploadFileManagerFilesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { parentPath: string; files: FileList | File[]; scope: FileManagerScope }) => (
      uploadFileManagerFiles(input.parentPath, input.files, input.scope)
    ),
    onSuccess: () => invalidateFileManagerQueries(queryClient),
  });
}

export async function fetchFileManagerZipEntries(
  archivePath: string,
  scope: FileManagerScope,
): Promise<FileManagerZipEntriesResult> {
  const searchParams = new URLSearchParams({ archivePath, scope });
  const { data, response } = await apiGet<ApiDataResponse<FileManagerZipEntriesResult>>(
    `/api/file-manager/zip/entries?${searchParams.toString()}`,
  );
  if (!response.ok || !data.success || !data.data) {
    throw new Error(getErrorMessage(data, 'Failed to load zip entries.'));
  }
  return data.data;
}

export async function fetchFileManagerZipContent(
  archivePath: string,
  entryPath: string,
  scope: FileManagerScope,
): Promise<FileManagerZipContent> {
  const searchParams = new URLSearchParams({ archivePath, entryPath, scope });
  const { data, response } = await apiGet<ApiDataResponse<FileManagerZipContent>>(
    `/api/file-manager/zip/content?${searchParams.toString()}`,
  );
  if (!response.ok || !data.success || !data.data) {
    throw new Error(getErrorMessage(data, 'Failed to load zip entry content.'));
  }
  return data.data;
}

export function useFileManagerZipEntriesQuery(archivePath: string | null, scope: FileManagerScope) {
  return useQuery({
    queryKey: fileManagerQueryKeys.zipEntries(archivePath ?? '', scope),
    queryFn: () => fetchFileManagerZipEntries(archivePath ?? '', scope),
    enabled: Boolean(archivePath?.trim()),
  });
}

export function useFileManagerZipContentQuery(
  archivePath: string | null,
  entryPath: string | null,
  scope: FileManagerScope,
) {
  return useQuery({
    queryKey: fileManagerQueryKeys.zipContent(archivePath ?? '', entryPath ?? '', scope),
    queryFn: () => fetchFileManagerZipContent(archivePath ?? '', entryPath ?? '', scope),
    enabled: Boolean(archivePath?.trim() && entryPath?.trim()),
  });
}

const invalidateZipQueries = (queryClient: QueryClient, archivePath: string, scope: FileManagerScope) => {
  void queryClient.invalidateQueries({ queryKey: fileManagerQueryKeys.zipEntries(archivePath, scope) });
  void queryClient.invalidateQueries({ queryKey: fileManagerQueryKeys.all });
};

export function useWriteFileManagerZipContentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { archivePath: string; entryPath: string; content: string; scope: FileManagerScope }) => {
      const { data, response } = await apiPut<ApiDataResponse<FileManagerZipEntry>>(
        '/api/file-manager/zip/content',
        input,
      );
      if (!response.ok || !data.success || !data.data) {
        throw new Error(getErrorMessage(data, 'Failed to save zip entry.'));
      }
      return data.data;
    },
    onSuccess: (_data, variables) => {
      invalidateZipQueries(queryClient, variables.archivePath, variables.scope);
      void queryClient.invalidateQueries({
        queryKey: fileManagerQueryKeys.zipContent(variables.archivePath, variables.entryPath, variables.scope),
      });
    },
  });
}

export function useDeleteFileManagerZipEntryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { archivePath: string; entryPath: string; scope: FileManagerScope }) => {
      const { data, response } = await apiDelete<ApiDataResponse<{ removedEntries: number }>>(
        '/api/file-manager/zip/entry',
        input,
      );
      if (!response.ok || !data.success) {
        throw new Error(getErrorMessage(data, 'Failed to delete zip entry.'));
      }
      return data.data;
    },
    onSuccess: (_data, variables) => invalidateZipQueries(queryClient, variables.archivePath, variables.scope),
  });
}

export function useMoveFileManagerZipEntryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      archivePath: string;
      entryPath: string;
      destinationParentPath: string;
      scope: FileManagerScope;
      overwrite?: boolean;
    }) => {
      const { data, response } = await apiPut<ApiDataResponse<FileManagerZipEntry>>(
        '/api/file-manager/zip/move',
        input,
      );
      if (!response.ok || !data.success || !data.data) {
        const error = new Error(getErrorMessage(data, 'Failed to move zip entry.'));
        (error as Error & { status?: number }).status = response.status;
        throw error;
      }
      return data.data;
    },
    onSuccess: (_data, variables) => invalidateZipQueries(queryClient, variables.archivePath, variables.scope),
  });
}

export function useRenameFileManagerZipEntryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { archivePath: string; entryPath: string; newName: string; scope: FileManagerScope }) => {
      const { data, response } = await apiPut<ApiDataResponse<FileManagerZipEntry>>(
        '/api/file-manager/zip/rename',
        input,
      );
      if (!response.ok || !data.success || !data.data) {
        throw new Error(getErrorMessage(data, 'Failed to rename zip entry.'));
      }
      return data.data;
    },
    onSuccess: (_data, variables) => invalidateZipQueries(queryClient, variables.archivePath, variables.scope),
  });
}

export function useCreateFileManagerZipFolderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { archivePath: string; parentPath: string; name: string; scope: FileManagerScope }) => {
      const { data, response } = await apiPost<ApiDataResponse<FileManagerZipEntry>>(
        '/api/file-manager/zip/folder',
        input,
      );
      if (!response.ok || !data.success || !data.data) {
        throw new Error(getErrorMessage(data, 'Failed to create zip folder.'));
      }
      return data.data;
    },
    onSuccess: (_data, variables) => invalidateZipQueries(queryClient, variables.archivePath, variables.scope),
  });
}

export function useCreateFileManagerZipFileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { archivePath: string; parentPath: string; name: string; scope: FileManagerScope }) => {
      const { data, response } = await apiPost<ApiDataResponse<FileManagerZipEntry>>(
        '/api/file-manager/zip/file',
        input,
      );
      if (!response.ok || !data.success || !data.data) {
        throw new Error(getErrorMessage(data, 'Failed to create zip file.'));
      }
      return data.data;
    },
    onSuccess: (_data, variables) => invalidateZipQueries(queryClient, variables.archivePath, variables.scope),
  });
}

export function useImportFileManagerZipEntryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      archivePath: string;
      destinationParentPath: string;
      sourcePath: string;
      scope: FileManagerScope;
      overwrite?: boolean;
    }) => {
      const { data, response } = await apiPost<ApiDataResponse<FileManagerZipEntry>>(
        '/api/file-manager/zip/import',
        input,
      );
      if (!response.ok || !data.success || !data.data) {
        const error = new Error(getErrorMessage(data, 'Failed to import file into zip.'));
        (error as Error & { status?: number }).status = response.status;
        throw error;
      }
      return data.data;
    },
    onSuccess: (_data, variables) => invalidateZipQueries(queryClient, variables.archivePath, variables.scope),
  });
}

export async function uploadFileManagerZipEntries(
  archivePath: string,
  destinationParentPath: string,
  files: FileList | File[],
  scope: FileManagerScope,
): Promise<FileManagerZipUploadResult> {
  const formData = new FormData();
  formData.set('archivePath', archivePath);
  formData.set('destinationParentPath', destinationParentPath);
  formData.set('scope', scope);
  for (const file of Array.from(files)) {
    formData.append('files', file, file.name);
  }

  const { data, response } = await apiRequest<ApiDataResponse<FileManagerZipUploadResult>>(
    '/api/file-manager/zip/upload',
    {
      method: 'POST',
      body: formData,
    },
  );

  if (!response.ok || !data.success || !data.data) {
    throw new Error(getErrorMessage(data, 'Failed to upload files into zip.'));
  }

  return data.data;
}

export function useUploadFileManagerZipEntriesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      archivePath: string;
      destinationParentPath: string;
      files: FileList | File[];
      scope: FileManagerScope;
    }) => uploadFileManagerZipEntries(
      input.archivePath,
      input.destinationParentPath,
      input.files,
      input.scope,
    ),
    onSuccess: (_data, variables) => invalidateZipQueries(queryClient, variables.archivePath, variables.scope),
  });
}
