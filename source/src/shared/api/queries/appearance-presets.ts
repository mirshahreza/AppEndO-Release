import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut } from '../client';
import type {
  ThemePresetDocument,
  UpdateThemePresetInput,
} from '../contracts/appearance-presets/types';

export const appearancePresetQueryKeys = {
  all: ['appearance', 'presets'] as const,
  detail: (swatchId: string) => [...appearancePresetQueryKeys.all, 'detail', swatchId] as const,
};

type ThemePresetDetailResponse = { success: boolean; preset: ThemePresetDocument };
type ThemePresetUpdateResponse = { success: boolean; preset: ThemePresetDocument };

export async function fetchThemePreset(swatchId: string, signal?: AbortSignal): Promise<ThemePresetDocument> {
  const { data, response } = await apiGet<ThemePresetDetailResponse>(
    `/api/appearance/presets/${encodeURIComponent(swatchId)}`,
    { signal },
  );
  if (!response.ok || data?.success !== true || !data.preset) {
    throw new Error('Failed to load theme preset.');
  }
  return data.preset;
}

export function useThemePresetQuery(
  swatchId: string | null,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: appearancePresetQueryKeys.detail(swatchId ?? ''),
    queryFn: ({ signal }) => fetchThemePreset(swatchId!, signal),
    enabled: (options?.enabled ?? true) && Boolean(swatchId),
  });
}

export function useUpdateThemePresetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      swatchId,
      payload,
    }: {
      swatchId: string;
      payload: UpdateThemePresetInput;
    }): Promise<ThemePresetDocument> => {
      const { data, response } = await apiPut<ThemePresetUpdateResponse>(
        `/api/appearance/presets/${encodeURIComponent(swatchId)}`,
        payload,
      );
      if (!response.ok || data?.success !== true || !data.preset) {
        throw new Error('Failed to save theme preset.');
      }
      return data.preset;
    },
    onSuccess: (preset, variables) => {
      queryClient.setQueryData(appearancePresetQueryKeys.detail(variables.swatchId), preset);
    },
  });
}
