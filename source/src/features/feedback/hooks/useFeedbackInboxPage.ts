import { useCallback, useEffect, useMemo, useState } from 'react';
import type { UIEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useCultureT } from '../../../core/culture/CultureContext';
import type {
  FeedbackInboxBucket,
  FeedbackTicketDetailDto,
  FeedbackTicketDto,
} from '../../../shared/api/contracts/feedback/types';
import { FEEDBACK_INBOX_BUCKETS } from '../../../shared/api/contracts/feedback/constants';
import { useListPageToolbarScroll } from '../../../shared/lib/useListPageToolbarScroll';
import { feedbackApi, FeedbackApiError } from '../api/feedbackApi';
import { createFeedbackInboxGridColumns } from '../feedbackInboxGridColumns';
import {
  FEEDBACK_TICKET_SEARCH_PARAM,
  readFeedbackTicketId,
} from '../feedbackTicketDeepLink';

const mergeTicketSummary = (
  items: FeedbackTicketDto[],
  ticket: FeedbackTicketDto,
): FeedbackTicketDto[] => (
  items.some((entry) => entry.id === ticket.id)
    ? items
    : [ticket, ...items]
);

export type FeedbackInboxPageModel = ReturnType<typeof useFeedbackInboxPage>;

export function useFeedbackInboxPage() {
  const t = useCultureT();
  const { currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkTicketId = readFeedbackTicketId(searchParams);
  const isAdmin = Boolean(currentUser?.roles?.includes('ADMIN') || currentUser?.role === 'ADMIN');

  const [bucket, setBucket] = useState<FeedbackInboxBucket>('ASSIGNED_TO_ME');
  const [items, setItems] = useState<FeedbackTicketDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [selected, setSelected] = useState<FeedbackTicketDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOpeningDetail, setIsOpeningDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const bucketOptions = useMemo(() => {
    const values = isAdmin
      ? FEEDBACK_INBOX_BUCKETS
      : (['ASSIGNED_TO_ME', 'MY_ROLE_QUEUE'] as const);
    return values.map((value) => ({ value, label: value }));
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) return;
    if (bucket === 'ALL' || bucket === 'UNASSIGNED') {
      setBucket('ASSIGNED_TO_ME');
    }
  }, [bucket, isAdmin]);

  const setTicketInUrl = useCallback((ticketId: string | null) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (ticketId) {
        next.set(FEEDBACK_TICKET_SEARCH_PARAM, ticketId);
      } else {
        next.delete(FEEDBACK_TICKET_SEARCH_PARAM);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const load = useCallback(async (refreshMode: 'initial' | 'refresh' = 'initial') => {
    if (refreshMode === 'initial') setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);
    try {
      const result = await feedbackApi.listInbox(bucket);
      setItems(result.items);
      setTotalCount(result.total);
    } catch (err) {
      setError(err instanceof FeedbackApiError ? err.message : t('feedback.inbox.loadError'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [bucket, t]);

  useEffect(() => {
    void load('initial');
  }, [load]);

  const openTicketById = useCallback(async (ticketId: string) => {
    setDetailError(null);
    setIsOpeningDetail(true);
    try {
      const result = await feedbackApi.get(ticketId);
      setSelected(result.ticket);
      setItems((current) => mergeTicketSummary(current, result.ticket));
      if (
        isAdmin
        && !result.ticket.assigneeUserId
        && !result.ticket.assigneeRoleName
        && bucket !== 'UNASSIGNED'
        && bucket !== 'ALL'
      ) {
        setBucket('UNASSIGNED');
      }
    } catch (err) {
      setSelected(null);
      setDetailError(err instanceof FeedbackApiError ? err.message : t('feedback.inbox.detailError'));
    } finally {
      setIsOpeningDetail(false);
    }
  }, [bucket, isAdmin, t]);

  useEffect(() => {
    if (!deepLinkTicketId) {
      setSelected(null);
      return;
    }
    if (selected?.id === deepLinkTicketId) {
      return;
    }
    void openTicketById(deepLinkTicketId);
  }, [deepLinkTicketId, openTicketById, selected?.id]);

  const openTicket = useCallback((item: FeedbackTicketDto) => {
    setTicketInUrl(item.id);
  }, [setTicketInUrl]);

  const refresh = useCallback(() => {
    void load('refresh');
  }, [load]);

  const claimTicket = useCallback(async () => {
    if (!selected) return;
    setBusy(true);
    setDetailError(null);
    try {
      const result = await feedbackApi.claim(selected.id);
      setSelected((current) => (current ? { ...current, ...result.ticket } : current));
      await load('refresh');
    } catch (err) {
      setDetailError(err instanceof FeedbackApiError ? err.message : t('feedback.inbox.claimError'));
    } finally {
      setBusy(false);
    }
  }, [load, selected, t]);

  const updateStatus = useCallback(async (status: FeedbackTicketDto['status']) => {
    if (!selected) return;
    setBusy(true);
    setDetailError(null);
    try {
      const result = await feedbackApi.updateStatus(selected.id, { status });
      setSelected((current) => (current ? { ...current, ...result.ticket } : current));
      await load('refresh');
    } catch (err) {
      setDetailError(err instanceof FeedbackApiError ? err.message : t('feedback.inbox.statusError'));
    } finally {
      setBusy(false);
    }
  }, [load, selected, t]);

  const { handleGridScroll } = useListPageToolbarScroll();
  const onGridScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    handleGridScroll(event);
  }, [handleGridScroll]);

  const gridColumns = useMemo(() => createFeedbackInboxGridColumns(t), [t]);

  return {
    items,
    totalCount,
    gridColumns,
    bucket,
    setBucket,
    bucketOptions,
    selected,
    setSelected,
    deepLinkTicketId,
    isLoading,
    isRefreshing,
    isOpeningDetail,
    error,
    detailError,
    busy,
    openTicket,
    refresh,
    claimTicket,
    updateStatus,
    onGridScroll,
    t,
  };
}
