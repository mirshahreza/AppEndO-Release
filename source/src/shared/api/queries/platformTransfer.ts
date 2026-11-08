import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '../client';
import type {
  PlatformTransferBundle,
  PlatformTransferCatalogEntry,
  PlatformTransferSectionKey,
} from '../contracts/settings/platformTransfer';
import { settingsQueryKeys } from './settings';

export const platformTransferQueryKeys = {
  catalog: () => [...settingsQueryKeys.all, 'transfer', 'catalog'] as const,
};

export function usePlatformTransferCatalogQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: platformTransferQueryKeys.catalog(),
    enabled: options?.enabled ?? true,
    queryFn: async () => {
      const { data } = await apiGet<{ success: true; catalog: PlatformTransferCatalogEntry[] }>(
        '/api/settings/transfer/catalog',
      );
      return data.catalog;
    },
  });
}

export function useExportPlatformTransferMutation() {
  return useMutation({
    mutationFn: async (sections: PlatformTransferSectionKey[]) => {
      const { data } = await apiPost<{ success: true; export: PlatformTransferBundle }>(
        '/api/settings/transfer/export',
        { sections },
      );
      return data.export;
    },
  });
}

export function useImportPlatformTransferMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      sections: PlatformTransferSectionKey[];
      bundle: PlatformTransferBundle;
    }) => {
      const { data } = await apiPost<{ success: true; imported: PlatformTransferSectionKey[] }>(
        '/api/settings/transfer/import',
        payload,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsQueryKeys.all });
    },
  });
}

export function downloadPlatformTransferBundle(bundle: PlatformTransferBundle, fileName?: string): void {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName ?? `appendo-platform-transfer-${bundle.exportedAt.slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
