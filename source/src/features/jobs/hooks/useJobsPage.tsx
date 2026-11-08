import { useCallback, useEffect, useMemo, useState } from 'react';
import { useServerFunctionsCatalogQuery } from '../../../shared/api/queries/server-functions';
import {
  useCancelJobMutation,
  useEnqueueJobMutation,
  useJobsListQuery,
  useRetryJobMutation,
} from '../../../shared/api/queries/jobs';
import { formatApiErrorMessage, isApiError } from '../../../shared/api/client';
import type { JobGridRow } from '../../../shared/api/contracts/jobs/types';
import { TOOLBAR_FILTER_RADIO_ALL_VALUE } from '../../../shared/ui';
import { toJobGridRow } from '../../../shared/lib/jobPayload';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { useGridListPresentation } from '../../../shared/lib/useGridListPresentation';
import { useListPagePresentationScroll } from '../../../shared/lib/useListPagePresentationScroll';
import {
  usePersistedListFilters,
  usePersistedListPaging,
} from '../../../shared/lib/usePersistedListPreferences';
import { DEFAULT_PAGE_SIZE, EMPTY_ENQUEUE_FORM } from '../constants';
import { useCultureT } from '../../../core/culture/CultureContext';
import { operationsKey } from '../../../core/culture/translations/cultureKeyHelpers';
import { interpolateOperationsTemplate } from '../../operations/operationsI18n';
import { createJobGridColumns } from '../jobGridColumns';

type ToastState = { type: 'success' | 'error'; text: string } | null;

type JobsListFilters = {
  searchInput: string;
  statusFilter: string;
};

const DEFAULT_JOBS_FILTERS: JobsListFilters = {
  searchInput: '',
  statusFilter: TOOLBAR_FILTER_RADIO_ALL_VALUE,
};

function sanitizeJobsFilters(raw: unknown): JobsListFilters | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  return {
    searchInput: typeof record.searchInput === 'string' ? record.searchInput : '',
    statusFilter: typeof record.statusFilter === 'string'
      ? record.statusFilter
      : TOOLBAR_FILTER_RADIO_ALL_VALUE,
  };
}

export function useJobsPage() {
  const t = useCultureT();
  const [showEnqueueModal, setShowEnqueueModal] = useState(false);
  const jobsQuery = useJobsListQuery({ limit: 200 });
  const functionsQuery = useServerFunctionsCatalogQuery(showEnqueueModal);
  const enqueueMutation = useEnqueueJobMutation();
  const cancelMutation = useCancelJobMutation();
  const retryMutation = useRetryJobMutation();

  const [filters, setFilters] = usePersistedListFilters({
    listKey: APP_LIST_PREFERENCE_KEYS.jobs,
    defaultFilters: DEFAULT_JOBS_FILTERS,
    sanitize: sanitizeJobsFilters,
  });
  const { searchInput, statusFilter } = filters;
  const [searchText, setSearchText] = useState(searchInput);
  const { pageSize, setPageSize, listMode, setListMode } = usePersistedListPaging({
    listKey: APP_LIST_PREFERENCE_KEYS.jobs,
    defaultPageSize: DEFAULT_PAGE_SIZE,
  });
  const [toast, setToast] = useState<ToastState>(null);

  const [enqueueForm, setEnqueueForm] = useState(EMPTY_ENQUEUE_FORM);
  const [enqueueError, setEnqueueError] = useState<string | null>(null);

  const [cancelTarget, setCancelTarget] = useState<JobGridRow | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [pendingActionJobId, setPendingActionJobId] = useState<number | null>(null);

  const setSearchInput = useCallback((next: string) => {
    setFilters((prev) => ({ ...prev, searchInput: next }));
  }, [setFilters]);

  const setStatusFilter = useCallback((next: string) => {
    setFilters((prev) => ({ ...prev, statusFilter: next }));
  }, [setFilters]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchText(searchInput), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (type: ToastState['type'], text: string) => setToast({ type, text });

  const rows = useMemo(() => {
    const items = jobsQuery.data?.items ?? [];
    return items.map((item) => toJobGridRow(item));
  }, [jobsQuery.data?.items]);

  const filteredRows = useMemo(() => {
    const statusNeedle = statusFilter.trim();
    const textNeedle = searchText.trim().toLowerCase();

    return rows.filter((row) => {
      if (statusNeedle && row.status !== statusNeedle) return false;
      if (!textNeedle) return true;
      return (
        String(row.id).includes(textNeedle)
        || row.title.toLowerCase().includes(textNeedle)
        || row.functionId.toLowerCase().includes(textNeedle)
        || row.status.toLowerCase().includes(textNeedle)
        || row.sourceLabel.toLowerCase().includes(textNeedle)
        || (row.error_message?.toLowerCase().includes(textNeedle) ?? false)
      );
    });
  }, [rows, searchText, statusFilter]);

  const presentation = useGridListPresentation({
    items: filteredRows,
    pageSize,
    listMode,
    resetKeys: [searchText, statusFilter],
  });
  const onGridScroll = useListPagePresentationScroll(presentation);

    const functionCatalog = useMemo(() => {
    const catalog = functionsQuery.data?.functions ?? [];
    return catalog.map((item) => ({
      id: item.id,
      name: item.name,
      method: item.method,
      path: item.path,
    }));
  }, [functionsQuery.data?.functions]);

  const openEnqueueModal = () => {
    setEnqueueForm({ ...EMPTY_ENQUEUE_FORM });
    setEnqueueError(null);
    setShowEnqueueModal(true);
  };

  const handleEnqueue = async () => {
    if (!enqueueForm.functionId.trim()) {
      setEnqueueError(t(operationsKey('jobs.validation.functionRequired')));
      return;
    }

    let payload: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(enqueueForm.payloadText || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setEnqueueError(t(operationsKey('common.payloadJsonObject')));
        return;
      }
      payload = parsed as Record<string, unknown>;
    } catch {
      setEnqueueError(t(operationsKey('common.payloadJsonInvalid')));
      return;
    }

    setEnqueueError(null);
    try {
      const result = await enqueueMutation.mutateAsync({
        functionId: enqueueForm.functionId.trim(),
        title: enqueueForm.title?.trim() || undefined,
        payload,
      });
      setShowEnqueueModal(false);
      showToast('success', interpolateOperationsTemplate(t(operationsKey('jobs.toast.queued')), { id: result.data.id }));
    } catch (error) {
      setEnqueueError(isApiError(error) ? formatApiErrorMessage(error) : t(operationsKey('jobs.toast.enqueueFailed')));
    }
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelError(null);
    setPendingActionJobId(cancelTarget.id);
    try {
      await cancelMutation.mutateAsync(cancelTarget.id);
      setCancelTarget(null);
      showToast('success', interpolateOperationsTemplate(t(operationsKey('jobs.toast.cancelRequested')), { id: cancelTarget.id }));
    } catch (error) {
      setCancelError(isApiError(error) ? formatApiErrorMessage(error) : t(operationsKey('jobs.toast.cancelFailed')));
    } finally {
      setPendingActionJobId(null);
    }
  };

  const handleRetry = async (job: JobGridRow) => {
    setPendingActionJobId(job.id);
    try {
      const result = await retryMutation.mutateAsync(job.id);
      showToast('success', interpolateOperationsTemplate(t(operationsKey('jobs.toast.retried')), { id: job.id, newId: result.data.id }));
    } catch (error) {
      showToast('error', isApiError(error) ? formatApiErrorMessage(error) : t(operationsKey('jobs.toast.retryFailed')));
    } finally {
      setPendingActionJobId(null);
    }
  };

  const gridColumns = useMemo(
    () => createJobGridColumns({
      onCancel: setCancelTarget,
      onRetry: (job) => { void handleRetry(job); },
      pendingActionJobId,
    }, t),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pendingActionJobId, t],
  );

  const retryLoad = useCallback(() => {
    void jobsQuery.refetch();
  }, [jobsQuery]);

  return {
    stats: jobsQuery.data?.stats,
    isLoading: jobsQuery.isLoading,
    isError: jobsQuery.isError,
    error: jobsQuery.isError ? t(operationsKey('jobs.loadFailed')) : null,
    retryLoad,
    isRefreshing: jobsQuery.isFetching && !jobsQuery.isLoading,
    searchInput,
    setSearchInput,
    statusFilter,
    setStatusFilter,
    pageSize,
    setPageSize,
    listMode,
    setListMode,
    presentation,
    onGridScroll,
    gridColumns,
    openEnqueueModal,
    showEnqueueModal,
    setShowEnqueueModal,
    enqueueForm,
    setEnqueueForm,
    enqueueError,
    functionCatalog,
    isEnqueueing: enqueueMutation.isPending,
    handleEnqueue,
    cancelTarget,
    setCancelTarget,
    cancelError,
    confirmCancel,
    toast,
  };
}

export type JobsPageState = ReturnType<typeof useJobsPage>;
