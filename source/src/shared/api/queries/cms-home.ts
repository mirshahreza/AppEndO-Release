import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../client';
import type { CmsHomeReviewQueueResponse } from '../contracts/cms-home/types';

export const cmsHomeQueryKeys = {
  all: ['cms-home'] as const,
  reviewQueue: () => [...cmsHomeQueryKeys.all, 'review-queue'] as const,
};

export async function fetchCmsHomeReviewQueue(signal?: AbortSignal) {
  const { data, response } = await apiGet<CmsHomeReviewQueueResponse>('/api/cms/home/review-queue', { signal });
  if (!response.ok || !data.success) {
    throw new Error('Failed to load the CMS review queue.');
  }
  return data;
}

export function useCmsHomeReviewQueueQuery(enabled = true) {
  return useQuery({
    queryKey: cmsHomeQueryKeys.reviewQueue(),
    queryFn: ({ signal }) => fetchCmsHomeReviewQueue(signal),
    enabled,
    staleTime: 30_000,
    refetchInterval: 45_000,
  });
}
