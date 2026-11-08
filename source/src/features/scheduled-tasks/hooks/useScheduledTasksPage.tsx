import { useCallback, useEffect, useMemo, useState } from 'react';
import { useServerFunctionsCatalogQuery } from '../../../shared/api/queries/server-functions';
import { waitForJobTerminalStatus } from '../../../shared/api/queries/jobs';
import {
  useCreateScheduledTaskMutation,
  useDeleteScheduledTaskMutation,
  useReplaceSchedulerSettingsMutation,
  useRunScheduledTaskNowMutation,
  useSchedulerSnapshotQuery,
  useUpdateScheduledTaskMutation,
} from '../../../shared/api/queries/scheduler';
import { formatApiErrorMessage, isApiError } from '../../../shared/api/client';
import type {
  MissedRunPolicy,
  ScheduledTaskEntry,
  ScheduledTaskGridRow,
  SchedulerSettings,
} from '../../../shared/api/contracts/scheduler/types';

const toSchedulerTaskEntries = (tasks: ScheduledTaskGridRow[]): ScheduledTaskEntry[] => (
  tasks.map((task) => ({
    id: task.id,
    name: task.name,
    enabled: task.enabled,
    functionId: task.functionId,
    cron: task.cron,
    payload: task.payload,
    note: task.note,
  }))
);
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { useGridListPresentation } from '../../../shared/lib/useGridListPresentation';
import { useListPagePresentationScroll } from '../../../shared/lib/useListPagePresentationScroll';
import {
  usePersistedListFilters,
  usePersistedListPaging,
} from '../../../shared/lib/usePersistedListPreferences';
import { DEFAULT_PAGE_SIZE, EMPTY_TASK_FORM } from '../constants';
import { useCultureT } from '../../../core/culture/CultureContext';
import { operationsKey } from '../../../core/culture/translations/cultureKeyHelpers';
import { interpolateOperationsTemplate } from '../../operations/operationsI18n';
import { createScheduledTaskGridColumns } from '../scheduledTaskGridColumns';

type ToastState = { type: 'success' | 'error'; text: string } | null;

type ScheduledTasksListFilters = {
  searchInput: string;
};

const DEFAULT_SCHEDULED_TASKS_FILTERS: ScheduledTasksListFilters = {
  searchInput: '',
};

function sanitizeScheduledTasksFilters(raw: unknown): ScheduledTasksListFilters | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  return {
    searchInput: typeof record.searchInput === 'string' ? record.searchInput : '',
  };
}

export function useScheduledTasksPage() {
  const t = useCultureT();
  const snapshotQuery = useSchedulerSnapshotQuery();
  const functionsQuery = useServerFunctionsCatalogQuery();
  const replaceSettingsMutation = useReplaceSchedulerSettingsMutation();
  const createTaskMutation = useCreateScheduledTaskMutation();
  const updateTaskMutation = useUpdateScheduledTaskMutation();
  const deleteTaskMutation = useDeleteScheduledTaskMutation();
  const runNowMutation = useRunScheduledTaskNowMutation();

  const scheduler = snapshotQuery.data;
  const tasks = scheduler?.tasks ?? [];

  const [filters, setFilters] = usePersistedListFilters({
    listKey: APP_LIST_PREFERENCE_KEYS.scheduledTasks,
    defaultFilters: DEFAULT_SCHEDULED_TASKS_FILTERS,
    sanitize: sanitizeScheduledTasksFilters,
  });
  const searchInput = filters.searchInput;
  const setSearchInput = useCallback((next: string) => {
    setFilters({ searchInput: next });
  }, [setFilters]);
  const [searchText, setSearchText] = useState(searchInput);
  const { pageSize, setPageSize, listMode, setListMode } = usePersistedListPaging({
    listKey: APP_LIST_PREFERENCE_KEYS.scheduledTasks,
    defaultPageSize: DEFAULT_PAGE_SIZE,
  });
  const [toast, setToast] = useState<ToastState>(null);

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [form, setForm] = useState<ScheduledTaskEntry>(EMPTY_TASK_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ScheduledTaskGridRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);

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

  const filteredTasks = useMemo(() => {
    const needle = searchText.trim().toLowerCase();
    if (!needle) return tasks;
    return tasks.filter((task) => (
      task.name.toLowerCase().includes(needle)
      || task.functionId.toLowerCase().includes(needle)
      || task.cron.toLowerCase().includes(needle)
    ));
  }, [tasks, searchText]);

  const presentation = useGridListPresentation({
    items: filteredTasks,
    pageSize,
    listMode,
    resetKeys: [searchText],
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

  const openCreateModal = () => {
    setModalMode('create');
    setForm({ ...EMPTY_TASK_FORM });
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (task: ScheduledTaskGridRow) => {
    setModalMode('edit');
    setForm({
      id: task.id,
      name: task.name,
      enabled: task.enabled,
      functionId: task.functionId,
      cron: task.cron,
      payload: task.payload,
      note: task.note,
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSaveTask = async () => {
    if (!form.name.trim() || !form.functionId.trim() || !form.cron.trim()) {
      setFormError(t(operationsKey('scheduler.validation.required')));
      return;
    }
    if (modalMode === 'create' && !form.id.trim()) {
      setFormError(t(operationsKey('scheduler.validation.taskIdRequired')));
      return;
    }

    setFormError(null);
    try {
      if (modalMode === 'create') {
        await createTaskMutation.mutateAsync(form);
        showToast('success', t(operationsKey('scheduler.toast.created')));
      } else {
        await updateTaskMutation.mutateAsync({
          id: form.id,
          payload: form,
        });
        showToast('success', t(operationsKey('scheduler.toast.updated')));
      }
      setShowModal(false);
    } catch (error) {
      setFormError(isApiError(error) ? formatApiErrorMessage(error) : t(operationsKey('scheduler.toast.saveFailed')));
    }
  };

  const handleToggleScheduler = async (enabled: boolean) => {
    if (!scheduler) return;
    try {
      const payload: SchedulerSettings = {
        enabled,
        tickIntervalSec: scheduler.tickIntervalSec,
        defaultTimezone: scheduler.defaultTimezone,
        missedRunPolicy: scheduler.missedRunPolicy ?? 'skip',
        tasks: toSchedulerTaskEntries(scheduler.tasks),
      };
      await replaceSettingsMutation.mutateAsync(payload);
      showToast('success', enabled ? t(operationsKey('scheduler.toast.enabled')) : t(operationsKey('scheduler.toast.disabled')));
    } catch (error) {
      showToast('error', isApiError(error) ? formatApiErrorMessage(error) : t(operationsKey('scheduler.toast.schedulerUpdateFailed')));
    }
  };

  const handleMissedRunPolicyChange = async (missedRunPolicy: MissedRunPolicy) => {
    if (!scheduler || scheduler.missedRunPolicy === missedRunPolicy) return;
    try {
      const payload: SchedulerSettings = {
        enabled: scheduler.enabled,
        tickIntervalSec: scheduler.tickIntervalSec,
        defaultTimezone: scheduler.defaultTimezone,
        missedRunPolicy,
        tasks: toSchedulerTaskEntries(scheduler.tasks),
      };
      await replaceSettingsMutation.mutateAsync(payload);
      showToast('success', t(operationsKey('scheduler.toast.missedRunUpdated')));
    } catch (error) {
      showToast('error', isApiError(error) ? formatApiErrorMessage(error) : t(operationsKey('scheduler.toast.missedRunFailed')));
    }
  };

  const handleRunNow = async (task: ScheduledTaskGridRow) => {
    if (runningTaskId) return;

    setRunningTaskId(task.id);
    try {
      const jobId = await runNowMutation.mutateAsync(task.id);
      showToast('success', interpolateOperationsTemplate(t(operationsKey('scheduler.toast.queued')), {
        name: task.name,
        id: jobId,
      }));

      const job = await waitForJobTerminalStatus(jobId);
      await snapshotQuery.refetch();

      if (!job) {
        showToast('error', interpolateOperationsTemplate(t(operationsKey('scheduler.toast.stillRunning')), { name: task.name }));
        return;
      }

      if (job.status === 'completed') {
        showToast('success', interpolateOperationsTemplate(t(operationsKey('scheduler.toast.completed')), {
          name: task.name,
          id: jobId,
        }));
        return;
      }

      const detail = job.error_message?.trim();
      showToast(
        'error',
        detail
          ? interpolateOperationsTemplate(t(operationsKey('scheduler.toast.failedWithDetail')), {
            name: task.name,
            id: jobId,
            detail,
          })
          : interpolateOperationsTemplate(t(operationsKey('scheduler.toast.failed')), {
            name: task.name,
            id: jobId,
          }),
      );
    } catch (error) {
      showToast('error', isApiError(error) ? formatApiErrorMessage(error) : t(operationsKey('scheduler.toast.runFailed')));
    } finally {
      setRunningTaskId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await deleteTaskMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      showToast('success', t(operationsKey('scheduler.toast.deleted')));
    } catch (error) {
      setDeleteError(isApiError(error) ? formatApiErrorMessage(error) : t(operationsKey('scheduler.toast.deleteFailed')));
    }
  };

  const gridColumns = useMemo(
    () => createScheduledTaskGridColumns({
      onEdit: openEditModal,
      onRunNow: (task) => { void handleRunNow(task); },
      onDelete: setDeleteTarget,
      runningTaskId,
    }, t),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runningTaskId, t],
  );

  const retryLoad = useCallback(() => {
    void snapshotQuery.refetch();
  }, [snapshotQuery]);

  return {
    scheduler,
    isLoading: snapshotQuery.isLoading,
    isError: snapshotQuery.isError,
    error: snapshotQuery.isError ? t(operationsKey('scheduler.loadFailed')) : null,
    retryLoad,
    isRefreshing: snapshotQuery.isFetching && !snapshotQuery.isLoading,
    searchInput,
    setSearchInput,
    pageSize,
    setPageSize,
    listMode,
    setListMode,
    presentation,
    onGridScroll,
    gridColumns,
    openCreateModal,
    showModal,
    setShowModal,
    modalMode,
    form,
    setForm,
    formError,
    functionCatalog,
    isSaving: createTaskMutation.isPending || updateTaskMutation.isPending,
    handleSaveTask,
    handleToggleScheduler,
    handleMissedRunPolicyChange,
    isTogglingScheduler: replaceSettingsMutation.isPending,
    deleteTarget,
    setDeleteTarget,
    deleteError,
    confirmDelete,
    toast,
  };
}

export type ScheduledTasksPageState = ReturnType<typeof useScheduledTasksPage>;
