import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { workItemsApi } from '../../work-items/api/workItemsApi';
import type { WorkItemSummary } from '../../work-items/types';
import { useVisibilityAwareRefetchInterval } from '../../../shared/lib/useDocumentVisibility';

const MY_INBOX_WIDGET_POLL_MS = 60_000;
const MY_INBOX_WIDGET_PREVIEW_LIMIT = 5;

export type MyInboxWorkItemPreview = WorkItemSummary & {
  bucket: 'MINE_ASSIGNED' | 'MINE_CLAIMED' | 'AVAILABLE_TO_CLAIM';
};

/**
 * Dashboard widget preview of actionable work items — same `workItemsApi` as the full inbox page.
 */
export function useMyInboxWidget() {
  const pollInterval = useVisibilityAwareRefetchInterval(MY_INBOX_WIDGET_POLL_MS);

  const assignedQuery = useQuery({
    queryKey: ['dashboard', 'my-inbox', 'MINE_ASSIGNED'],
    queryFn: () => workItemsApi.listInbox('MINE_ASSIGNED'),
    refetchInterval: pollInterval,
    staleTime: 20_000,
  });

  const claimableQuery = useQuery({
    queryKey: ['dashboard', 'my-inbox', 'AVAILABLE_TO_CLAIM'],
    queryFn: () => workItemsApi.listInbox('AVAILABLE_TO_CLAIM'),
    refetchInterval: pollInterval,
    staleTime: 20_000,
  });

  const claimedQuery = useQuery({
    queryKey: ['dashboard', 'my-inbox', 'MINE_CLAIMED'],
    queryFn: () => workItemsApi.listInbox('MINE_CLAIMED'),
    refetchInterval: pollInterval,
    staleTime: 20_000,
  });

  const items = useMemo((): MyInboxWorkItemPreview[] => {
    const assigned = (assignedQuery.data?.items ?? []).map((item): MyInboxWorkItemPreview => ({ ...item, bucket: 'MINE_ASSIGNED' }));
    const claimable = (claimableQuery.data?.items ?? []).map((item): MyInboxWorkItemPreview => ({ ...item, bucket: 'AVAILABLE_TO_CLAIM' }));
    const claimed = (claimedQuery.data?.items ?? []).map((item): MyInboxWorkItemPreview => ({ ...item, bucket: 'MINE_CLAIMED' }));
    return [...assigned, ...claimable, ...claimed]
      .sort((a, b) => b.priority - a.priority || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
      .slice(0, MY_INBOX_WIDGET_PREVIEW_LIMIT);
  }, [assignedQuery.data, claimableQuery.data, claimedQuery.data]);

  return {
    items,
    assignedCount: assignedQuery.data?.total ?? assignedQuery.data?.items.length ?? 0,
    claimableCount: claimableQuery.data?.total ?? claimableQuery.data?.items.length ?? 0,
    claimedCount: claimedQuery.data?.total ?? claimedQuery.data?.items.length ?? 0,
    isLoading: assignedQuery.isLoading || claimableQuery.isLoading || claimedQuery.isLoading,
    isError: assignedQuery.isError || claimableQuery.isError || claimedQuery.isError,
  };
}
