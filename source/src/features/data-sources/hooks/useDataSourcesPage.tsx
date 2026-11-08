import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useOptionalPortal } from '../../../app/platform/PortalContext';
import { usePlatformMount } from '../../../app/platform/PlatformMountContext';
import { DataSourceType, type DataSourceFormState, type DataSourceRecord } from '../../../shared/api/contracts/data-sources/types';
import { formatApiErrorMessage, isApiError } from '../../../shared/api/client';
import {
  requestTestAllDataSources,
  requestTestDataSourceById,
  requestTestDataSourceDraft,
  useCreateDataSourceMutation,
  useDataSourcesQuery,
  useDeleteDataSourceMutation,
  useUpdateDataSourceMutation,
} from '../../../shared/api/queries/data-sources';
import { useShellNavigate } from '../../../shared/ui/shell/useShellNavigate';
import { DEFAULT_FORM, TEST_REQUEST_TIMEOUT_MS } from '../constants';
import {
  buildDataSourcesListRelativePath,
  buildDataSourcesQuestionsRelativePath,
  findDataSourceByQuestionsId,
  isUnknownDataSourcesNestedPath,
  parseDataSourcesQuestionsId,
  parseDataSourcesQuestionsIdFromPathname,
} from '../dataSourcesRoute';
import {
  buildSavePayload,
  buildTestDraftPayload,
  formToEditState,
  getDefaultFormByType,
  getMutationError,
  getReadableErrorMessage,
} from '../utils';

export function useDataSourcesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const navigateShell = useShellNavigate();
  const { mountId, toMountPath } = usePlatformMount();
  const application = useOptionalPortal();
  const routeParamSuffix = useParams()['*'];
  const applicationSuffix = application?.pageRemainderPath.replace(/^\/+/, '') || undefined;
  const pathSuffix = applicationSuffix ?? routeParamSuffix;
  const questionsIdFromUrl = useMemo(
    () => parseDataSourcesQuestionsId(pathSuffix)
      ?? parseDataSourcesQuestionsIdFromPathname(location.pathname),
    [location.pathname, pathSuffix],
  );

  const listQuery = useDataSourcesQuery();
  const createMutation = useCreateDataSourceMutation();
  const updateMutation = useUpdateDataSourceMutation();
  const deleteMutation = useDeleteDataSourceMutation();

  const items = listQuery.data?.items ?? [];
  const questionsDataSource = questionsIdFromUrl
    ? findDataSourceByQuestionsId(items, questionsIdFromUrl)
    : undefined;
  const listError = listQuery.data?.error ?? null;
  const loading = listQuery.isLoading;
  const isRefreshingList = listQuery.isFetching && !listQuery.isLoading;
  const isError = Boolean(listError);
  const listLoadError = listError;

  const [submitting, setSubmitting] = useState(false);
  const [testingAll, setTestingAll] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testingDraft, setTestingDraft] = useState(false);
  const [form, setForm] = useState<DataSourceFormState>(DEFAULT_FORM);
  const [preferredCreateType, setPreferredCreateType] = useState<DataSourceType>(DataSourceType.SQL_SERVER);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DataSourceRecord | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const typeOptions = useMemo(() => {
    const options = Object.values(DataSourceType).filter(
      (type) => type !== DataSourceType.SQLITE,
    );
    const orderedPriority: DataSourceType[] = [
      DataSourceType.SQL_SERVER,
      DataSourceType.POSTGRES,
      DataSourceType.MYSQL,
      DataSourceType.ORACLE,
    ];

    return [
      ...orderedPriority,
      ...options.filter((type) => !orderedPriority.includes(type as DataSourceType)),
    ];
  }, []);

  const isSqlite = form.type === DataSourceType.SQLITE;
  const isSqlServer = form.type === DataSourceType.SQL_SERVER;
  const isAnalytics = form.type === DataSourceType.OLAP_BRIDGE
    || form.type === DataSourceType.MONGODB_ANALYTICS
    || form.type === DataSourceType.ELASTICSEARCH_ANALYTICS;

  const showHost = !isSqlite;
  const showPort = !isSqlite;
  const showUsername = !isSqlite;
  const showPassword = !isSqlite;
  const showDatabase = !isAnalytics || form.type === DataSourceType.MONGODB_ANALYTICS;

  useEffect(() => {
    if (listError) {
      setError(listError);
    }
  }, [listError]);

  useEffect(() => {
    if (listQuery.isLoading) {
      return;
    }

    const unknownNested = isUnknownDataSourcesNestedPath(pathSuffix)
      || isUnknownDataSourcesNestedPath(location.pathname);
    if (unknownNested) {
      navigate(toMountPath(buildDataSourcesListRelativePath(mountId)), { replace: true });
      return;
    }

    if (!questionsIdFromUrl) {
      return;
    }

    if (!findDataSourceByQuestionsId(items, questionsIdFromUrl)) {
      navigate(toMountPath(buildDataSourcesListRelativePath(mountId)), { replace: true });
    }
  }, [
    items,
    listQuery.isLoading,
    location.pathname,
    mountId,
    navigate,
    pathSuffix,
    questionsIdFromUrl,
    toMountPath,
  ]);

  const resolveQuestionsHref = useCallback((item: Pick<DataSourceRecord, 'id'>) => (
    toMountPath(buildDataSourcesQuestionsRelativePath(item, mountId))
  ), [mountId, toMountPath]);

  const openQuestions = useCallback((item: Pick<DataSourceRecord, 'id'>) => {
    navigateShell(toMountPath(buildDataSourcesQuestionsRelativePath(item, mountId)));
  }, [mountId, navigateShell, toMountPath]);

  const closeQuestions = useCallback(() => {
    navigate(toMountPath(buildDataSourcesListRelativePath(mountId)));
  }, [mountId, navigate, toMountPath]);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(''), 4500);
    return () => window.clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (!successMessage) return;
    const timer = window.setTimeout(() => setSuccessMessage(''), 3500);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  const refreshList = useCallback(async (options?: { preserveFeedback?: boolean }) => {
    if (!options?.preserveFeedback) {
      setError('');
    }
    await listQuery.refetch();
  }, [listQuery]);

  const openCreateDialog = (type: DataSourceType = preferredCreateType) => {
    setEditingId(null);
    setPreferredCreateType(type);
    setForm(getDefaultFormByType(type));
    setError('');
    setSuccessMessage('');
    setIsDialogOpen(true);
  };

  const openEditDialog = (item: DataSourceRecord) => {
    setEditingId(item.id);
    setForm(formToEditState(item));
    setError('');
    setSuccessMessage('');
    setIsDialogOpen(true);
  };

  const closeDialog = () => setIsDialogOpen(false);

  const saveDataSource = async () => {
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccessMessage('');
    try {
      const payload = buildSavePayload(form);

      if (editingId) {
        const { data, response } = await updateMutation.mutateAsync({ id: editingId, payload });
        const mutationError = getMutationError(data, 'Failed to save data source.');
        if (mutationError || !response.ok) {
          throw new Error(mutationError || 'Failed to save data source.');
        }
      } else {
        const { data, response } = await createMutation.mutateAsync(payload);
        const mutationError = getMutationError(data, 'Failed to save data source.');
        if (mutationError || !response.ok) {
          throw new Error(mutationError || 'Failed to save data source.');
        }
      }

      setForm(DEFAULT_FORM);
      setEditingId(null);
      setIsDialogOpen(false);
      await refreshList();
    } catch (caught) {
      setError(isApiError(caught) ? formatApiErrorMessage(caught) : getReadableErrorMessage(caught, 'Failed to save data source.'));
    } finally {
      setSubmitting(false);
    }
  };

  const testDraftConnectivity = async () => {
    setTestingDraft(true);
    setError('');
    setSuccessMessage('');
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), TEST_REQUEST_TIMEOUT_MS);

    try {
      const { data, response } = await requestTestDataSourceDraft(buildTestDraftPayload(form), controller.signal);
      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Connectivity test failed for current form values.');
      }

      if (data?.status === 'connected') {
        setSuccessMessage(`Current values are reachable. ${data?.message || ''}`.trim());
      } else {
        setError(`Current values are not reachable. ${data?.message || ''}`.trim());
      }
    } catch (caught) {
      setError(getReadableErrorMessage(caught, 'Connectivity test failed for current form values.'));
      setSuccessMessage('');
    } finally {
      window.clearTimeout(timeoutId);
      setTestingDraft(false);
    }
  };

  const remove = async (id: string) => {
    const selected = items.find((item) => item.id === id);
    if (selected?.isDefault) {
      setError('Default data source cannot be deleted.');
      return;
    }

    setError('');
    setSuccessMessage('');
    try {
      const { data, response } = await deleteMutation.mutateAsync(id);
      const mutationError = getMutationError(data, 'Failed to delete data source.');
      if (mutationError || !response.ok) {
        throw new Error(mutationError || 'Failed to delete data source.');
      }
      await refreshList();
    } catch (caught) {
      setError(isApiError(caught) ? formatApiErrorMessage(caught) : getReadableErrorMessage(caught, 'Failed to delete data source.'));
    }
  };

  const openDeleteConfirm = (item: DataSourceRecord) => {
    if (item.isDefault) {
      setError('Default data source cannot be deleted.');
      return;
    }
    setDeleteTarget(item);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await remove(deleteTarget.id);
    setDeleteTarget(null);
  };

  const cancelDelete = () => setDeleteTarget(null);

  const testConnectivity = async (id: string) => {
    setTestingId(id);
    setError('');
    setSuccessMessage('');
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), TEST_REQUEST_TIMEOUT_MS);
    try {
      const { data, response } = await requestTestDataSourceById(id, controller.signal);
      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Connectivity test failed.');
      }

      const sourceName = items.find((item) => item.id === id)?.name || 'Data source';
      if (data?.status === 'connected') {
        setSuccessMessage(`${sourceName} is reachable. ${data?.message || ''}`.trim());
      } else {
        setError(`${sourceName} is not reachable. ${data?.message || ''}`.trim());
      }
      await refreshList({ preserveFeedback: true });
    } catch (caught) {
      setError(getReadableErrorMessage(caught, 'Connectivity test failed.'));
      setSuccessMessage('');
    } finally {
      window.clearTimeout(timeoutId);
      setTestingId(null);
    }
  };

  const testConnectivityAll = async () => {
    setTestingAll(true);
    setError('');
    setSuccessMessage('');
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), TEST_REQUEST_TIMEOUT_MS);
    try {
      const { data, response } = await requestTestAllDataSources(controller.signal);
      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Connectivity test for all data sources failed.');
      }

      const results = Array.isArray(data?.items) ? data.items : [];
      const total = results.length;
      const connected = results.filter((item) => item?.status === 'connected').length;
      const unavailable = total - connected;

      if (unavailable === 0) {
        setSuccessMessage(`All data sources are reachable (${connected}/${total}).`);
      } else {
        setError(`Connectivity check finished: ${connected}/${total} reachable, ${unavailable} unavailable.`);
      }

      await refreshList({ preserveFeedback: true });
    } catch (caught) {
      setError(getReadableErrorMessage(caught, 'Connectivity test for all data sources failed.'));
      setSuccessMessage('');
    } finally {
      window.clearTimeout(timeoutId);
      setTestingAll(false);
    }
  };

  const dismissError = () => setError('');
  const dismissSuccess = () => setSuccessMessage('');

    return {
    typeOptions,
    items,
    questionsIdFromUrl,
    questionsDataSource,
    resolveQuestionsHref,
    openQuestions,
    closeQuestions,
    isError,
    listLoadError,
    isRetryingList: isRefreshingList,
    loading,
    submitting,
    testingAll,
    testingId,
    testingDraft,
    form,
    setForm,
    editingId,
    isDialogOpen,
    deleteTarget,
    error,
    successMessage,
    isSqlite,
    isSqlServer,
    showHost,
    showPort,
    showUsername,
    showPassword,
    showDatabase,
    refreshList,
    openCreateDialog,
    openEditDialog,
    closeDialog,
    saveDataSource,
    testDraftConnectivity,
    openDeleteConfirm,
    confirmDelete,
    cancelDelete,
    testConnectivity,
    testConnectivityAll,
    dismissError,
    dismissSuccess,
  };
}

export type DataSourcesPageModel = ReturnType<typeof useDataSourcesPage>;
