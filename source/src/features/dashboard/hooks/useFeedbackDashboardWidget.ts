import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { feedbackApi } from '../../feedback/api/feedbackApi';
import type { FeedbackInboxBucket, FeedbackTicketDto } from '../../../shared/api/contracts/feedback/types';
import { useFeedbackPolicy } from '../../feedback/hooks/useFeedbackPolicy';

export type DashboardFeedbackRow = {
  item: FeedbackTicketDto;
  inMine: boolean;
  inInbox: boolean;
};

const mergeDashboardFeedbackRows = (
  mine: FeedbackTicketDto[],
  inbox: FeedbackTicketDto[],
): DashboardFeedbackRow[] => {
  const byId = new Map<string, DashboardFeedbackRow>();

  for (const item of mine) {
    byId.set(item.id, { item, inMine: true, inInbox: false });
  }
  for (const item of inbox) {
    const existing = byId.get(item.id);
    if (existing) {
      existing.inInbox = true;
      if (
        new Date(item.updatedAt).getTime() > new Date(existing.item.updatedAt).getTime()
      ) {
        existing.item = item;
      }
    } else {
      byId.set(item.id, { item, inMine: false, inInbox: true });
    }
  }

  return [...byId.values()].sort(
    (left, right) =>
      new Date(right.item.lastMessageAt ?? right.item.submittedAt).getTime()
      - new Date(left.item.lastMessageAt ?? left.item.submittedAt).getTime(),
  );
};

export function useFeedbackDashboardWidget() {
  const { showOnDashboard } = useFeedbackPolicy();
  const { currentUser } = useAuth();
  const previewLimit = 5;

  const isAdmin = Boolean(currentUser?.roles?.includes('ADMIN') || currentUser?.role === 'ADMIN');

  const [rows, setRows] = useState<DashboardFeedbackRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  const staffInboxBucket = useMemo((): FeedbackInboxBucket | null => {
    if (!currentUser) return null;
    if (isAdmin) return 'UNASSIGNED';
    return 'ASSIGNED_TO_ME';
  }, [currentUser, isAdmin]);

  const load = useCallback(async () => {
    if (!showOnDashboard) {
      setRows([]);
      return;
    }
    setIsLoading(true);
    setIsError(false);
    try {
      const minePromise = feedbackApi.listMine({ page: 1, pageSize: previewLimit });
      const inboxPromise = staffInboxBucket
        ? feedbackApi.listInbox(staffInboxBucket, previewLimit).catch(() => ({ items: [], total: 0 }))
        : Promise.resolve({ items: [], total: 0 });
      const [mineResult, inboxResult] = await Promise.all([minePromise, inboxPromise]);
      setRows(mergeDashboardFeedbackRows(mineResult.items, inboxResult.items));
    } catch {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, [previewLimit, showOnDashboard, staffInboxBucket]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onFocus = () => {
      void load();
    };
    const intervalId = window.setInterval(() => {
      void load();
    }, 60_000);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(intervalId);
    };
  }, [load]);

  const attentionCount = useMemo(
    () => rows.reduce((sum, row) => {
      if (row.inMine && row.item.unreadCount > 0) {
        return sum + row.item.unreadCount;
      }
      if (row.inInbox && (row.item.status === 'NEW' || row.item.status === 'TRIAGED')) {
        return sum + 1;
      }
      return sum;
    }, 0),
    [rows],
  );

  return {
    rows,
    attentionCount,
    isLoading,
    isError,
    enabled: showOnDashboard,
    refresh: load,
  };
}
