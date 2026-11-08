import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../client';
import type { SlotCatalogResponse } from '../contracts/slots/catalog';

export const slotsQueryKeys = {
  all: ['slots'] as const,
  catalog: () => [...slotsQueryKeys.all, 'catalog'] as const,
};

export async function fetchSlotsCatalog(signal?: AbortSignal): Promise<SlotCatalogResponse> {
  const { data, response } = await apiGet<SlotCatalogResponse & { success?: boolean }>('/api/slots', { signal });
  if (!response.ok) {
    throw new Error('Failed to load slot catalog.');
  }
  return {
    slots: Array.isArray(data.slots) ? data.slots : [],
    registered: Array.isArray(data.registered) ? data.registered : [],
    active: Array.isArray(data.active) ? data.active : [],
  };
}

export function useSlotsCatalogQuery(enabled = true) {
  return useQuery({
    queryKey: slotsQueryKeys.catalog(),
    queryFn: ({ signal }) => fetchSlotsCatalog(signal),
    enabled,
    staleTime: 60_000,
  });
}
