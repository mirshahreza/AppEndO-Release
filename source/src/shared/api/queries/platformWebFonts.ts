import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPut, apiRequest } from '../client';
import type {
  PlatformWebFont,
  PlatformWebFontsResponse,
  UploadPlatformWebFontPayload,
  UpdatePlatformWebFontScriptResponse,
  UploadPlatformWebFontResponse,
  WebFontScript,
} from '../contracts/platform/webFonts';
import { bootQueryKeys } from './boot';
import { platformQueryKeys } from './platform';

export const platformWebFontsQueryKeys = {
  all: ['platform-web-fonts'] as const,
  list: () => [...platformWebFontsQueryKeys.all, 'list'] as const,
};

export async function fetchPlatformWebFonts(signal?: AbortSignal): Promise<PlatformWebFont[]> {
  const { data, response } = await apiGet<PlatformWebFontsResponse>(
    '/api/platform/web-fonts',
    { signal },
  );

  if (!response.ok || data?.success !== true) {
    throw new Error('Failed to load platform web fonts.');
  }

  return Array.isArray(data.fonts) ? data.fonts : [];
}

export function usePlatformWebFontsQuery(enabled = true) {
  return useQuery({
    queryKey: platformWebFontsQueryKeys.list(),
    queryFn: ({ signal }) => fetchPlatformWebFonts(signal),
    enabled,
    staleTime: 30_000,
  });
}

export async function invalidatePlatformWebFontsQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: platformWebFontsQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: bootQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: platformQueryKeys.cultures() }),
  ]);
}

export function useUploadPlatformWebFontMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { file: File } & UploadPlatformWebFontPayload) => {
      const formData = new FormData();
      formData.append('file', input.file);
      formData.append('label', input.label.trim());
      formData.append('family', input.family.trim());
      if (input.packagePolicy) formData.append('packagePolicy', input.packagePolicy);
      if (input.licenseName?.trim()) formData.append('licenseName', input.licenseName.trim());
      if (input.licenseUrl?.trim()) formData.append('licenseUrl', input.licenseUrl.trim());
      if (input.licenseNotice?.trim()) formData.append('licenseNotice', input.licenseNotice.trim());

      const { data, response } = await apiRequest<UploadPlatformWebFontResponse & { error?: string }>(
        '/api/platform/web-fonts/upload',
        {
          method: 'POST',
          body: formData,
        },
      );

      if (!response.ok || data?.success !== true || !data.font) {
        throw new Error(data?.error || 'Failed to upload web font.');
      }

      return data.font;
    },
    onSuccess: async () => {
      await invalidatePlatformWebFontsQueries(queryClient);
    },
  });
}

export function useDeletePlatformWebFontMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fontId: string) => {
      const { response } = await apiDelete(`/api/platform/web-fonts/${encodeURIComponent(fontId)}`);
      if (!response.ok) {
        throw new Error('Failed to delete web font.');
      }
    },
    onSuccess: async () => {
      await invalidatePlatformWebFontsQueries(queryClient);
    },
  });
}

export function useUpdatePlatformWebFontScriptMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { fontId: string; script: WebFontScript }) => {
      const { data, response } = await apiPut<UpdatePlatformWebFontScriptResponse & { error?: string }>(
        `/api/platform/web-fonts/${encodeURIComponent(input.fontId)}/script`,
        { script: input.script },
      );

      if (!response.ok || data?.success !== true || !data.font) {
        throw new Error(data?.error || 'Failed to update web font script.');
      }

      return data.font;
    },
    onSuccess: async () => {
      await invalidatePlatformWebFontsQueries(queryClient);
    },
  });
}
