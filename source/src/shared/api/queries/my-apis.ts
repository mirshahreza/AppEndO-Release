import { useQuery } from '@tanstack/react-query';
import { apiGet, isAbortError } from '../client';
import type { AccessibleApiRouteItem, AccessibleApiRoutesResponse } from '../contracts/my-apis/types';

export const myApisQueryKeys = {
  all: ['my-apis'] as const,
  routes: () => [...myApisQueryKeys.all, 'routes'] as const,
};

export async function fetchAccessibleApiRoutes(signal?: AbortSignal): Promise<AccessibleApiRouteItem[]> {
  const { data } = await apiGet<AccessibleApiRoutesResponse>('/api/docs/routes', { signal });
  if (!data.success) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load accessible API routes.');
  }
  return Array.isArray(data.items) ? data.items : [];
}

export function useAccessibleApiRoutesQuery() {
  return useQuery({
    queryKey: myApisQueryKeys.routes(),
    queryFn: ({ signal }) => fetchAccessibleApiRoutes(signal),
    retry: (failureCount, error) => (
      isAbortError(error)
        ? failureCount < 2
        : failureCount < 1
    ),
  });
}
