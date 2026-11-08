import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useOptionalPortal } from '../../../app/platform/PortalContext';
import { usePlatformMount } from '../../../app/platform/PlatformMountContext';
import { workflowsApi, WorkflowsApiError } from '../api/workflowsApi';
import type { WorkflowDefinitionSummary } from '../types';
import type { WorkflowDuplicateSource } from '../components/DuplicateDialog';
import { workflowDuplicateSourceFromSummary } from '../components/DuplicateDialog';
import {
  buildWorkflowEditRelativePath,
  buildWorkflowListRelativePath,
  findWorkflowByEditSlug,
  parseWorkflowEditSlug,
  parseWorkflowEditSlugFromPathname,
} from '../workflowRoute';
import {
  buildWorkflowDeletePreviewFromImpact,
  formatWorkflowsApiError,
  type WorkflowDeletePreview,
} from '../lib/workflowDeletePreview';
import { TOOLBAR_FILTER_RADIO_ALL_VALUE } from '../../../shared/ui';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { usePersistedListFilters } from '../../../shared/lib/usePersistedListPreferences';
import { isWorkflowPublished } from '../lib/workflowPublished';
import { useWorkflowsListOverlayDeepLink } from './useWorkflowsListOverlayDeepLink';

export type WorkflowPublishedFilter = '' | 'PUBLISHED' | 'UNPUBLISHED';

export type WorkflowSortField = 'key' | 'published' | 'draftVersion' | 'updatedAt';

export type WorkflowSortDirection = 'asc' | 'desc';

type WorkflowsListFilters = {
  searchQuery: string;
  publishedFilter: WorkflowPublishedFilter;
};

const DEFAULT_WORKFLOWS_FILTERS: WorkflowsListFilters = {
  searchQuery: '',
  publishedFilter: TOOLBAR_FILTER_RADIO_ALL_VALUE,
};

function isWorkflowPublishedFilter(value: unknown): value is WorkflowPublishedFilter {
  return value === TOOLBAR_FILTER_RADIO_ALL_VALUE
    || value === 'PUBLISHED'
    || value === 'UNPUBLISHED';
}

function sanitizeWorkflowsFilters(raw: unknown): WorkflowsListFilters | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  return {
    searchQuery: typeof record.searchQuery === 'string' ? record.searchQuery : '',
    publishedFilter: isWorkflowPublishedFilter(record.publishedFilter)
      ? record.publishedFilter
      : TOOLBAR_FILTER_RADIO_ALL_VALUE,
  };
}

const compareDefinitions = (
  left: WorkflowDefinitionSummary,
  right: WorkflowDefinitionSummary,
  sortBy: WorkflowSortField,
  sortDirection: WorkflowSortDirection,
): number => {
  let result = 0;

  if (sortBy === 'key') {
    result = left.key.localeCompare(right.key, undefined, { sensitivity: 'base' });
  } else if (sortBy === 'published') {
    result = Number(isWorkflowPublished(left)) - Number(isWorkflowPublished(right));
  } else if (sortBy === 'draftVersion') {
    result = left.draftVersion - right.draftVersion;
  } else {
    result = (left.updatedAt ?? '').localeCompare(right.updatedAt ?? '');
  }

  return sortDirection === 'asc' ? result : -result;
};

export function useWorkflowsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { mountId, toMountPath } = usePlatformMount();
  const application = useOptionalPortal();
  const routeParamSuffix = useParams()['*'];
  const applicationSuffix = application?.pageRemainderPath.replace(/^\/+/, '') || undefined;
  const pathSuffix = applicationSuffix ?? routeParamSuffix;
  const editSlugFromUrl = useMemo(
    () => parseWorkflowEditSlug(pathSuffix) ?? parseWorkflowEditSlugFromPathname(location.pathname),
    [location.pathname, pathSuffix],
  );
  const skipUrlToStateSyncRef = useRef(false);

  const [definitions, setDefinitions] = useState<WorkflowDefinitionSummary[]>([]);  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filters, setFilters] = usePersistedListFilters({
    listKey: APP_LIST_PREFERENCE_KEYS.workflows,
    defaultFilters: DEFAULT_WORKFLOWS_FILTERS,
    sanitize: sanitizeWorkflowsFilters,
  });
  const { searchQuery, publishedFilter } = filters;
  const setSearchQuery = useCallback((next: string) => {
    setFilters((prev) => ({ ...prev, searchQuery: next }));
  }, [setFilters]);
  const setPublishedFilter = useCallback((next: WorkflowPublishedFilter) => {
    setFilters((prev) => ({ ...prev, publishedFilter: next }));
  }, [setFilters]);
  const [sortBy, setSortBy] = useState<WorkflowSortField>('updatedAt');
  const [sortDirection, setSortDirection] = useState<WorkflowSortDirection>('desc');
  const [openDefinitionId, setOpenDefinitionIdState] = useState<number | null>(null);  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newWorkflowKey, setNewWorkflowKey] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [duplicateSource, setDuplicateSource] = useState<WorkflowDuplicateSource | null>(null);
  const [isDuplicateOpen, setIsDuplicateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WorkflowDefinitionSummary | null>(null);
  const [deletePreview, setDeletePreview] = useState<WorkflowDeletePreview | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeletePreviewLoading, setIsDeletePreviewLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deadLettersOpen, setDeadLettersOpen] = useState(false);
  const [slaViolationsOpen, setSlaViolationsOpen] = useState(false);
  const [dossierDefinitionId, setDossierDefinitionId] = useState<number | null>(null);

  const openDossier = useCallback((definitionId: number) => {
    setDossierDefinitionId(definitionId);
  }, []);

  const closeDossier = useCallback(() => {
    setDossierDefinitionId(null);
  }, []);

  const loadDefinitions = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setLoadError(null);
    try {
      const result = await workflowsApi.listDefinitions();
      setDefinitions(result.definitions as WorkflowDefinitionSummary[]);
    } catch (error) {
      setLoadError(error instanceof WorkflowsApiError ? `${error.code}: ${error.message}` : 'Failed to load workflows.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDefinitions('initial');
  }, [loadDefinitions]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredDefinitions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return definitions.filter((definition) => {
      const published = isWorkflowPublished(definition);
      if (publishedFilter === 'PUBLISHED' && !published) {
        return false;
      }
      if (publishedFilter === 'UNPUBLISHED' && published) {
        return false;
      }
      if (!query) {
        return true;
      }
      const publishedLabel = published ? 'published' : 'unpublished';
      return definition.key.toLowerCase().includes(query)
        || definition.scopeKey.toLowerCase().includes(query)
        || publishedLabel.includes(query);
    });
  }, [definitions, publishedFilter, searchQuery]);

  const sortedDefinitions = useMemo(
    () => [...filteredDefinitions].sort((left, right) => compareDefinitions(left, right, sortBy, sortDirection)),
    [filteredDefinitions, sortBy, sortDirection],
  );

  const setOpenDefinitionId = useCallback((id: number | null) => {
    skipUrlToStateSyncRef.current = true;
    setOpenDefinitionIdState(id);

    if (id === null) {
      navigate(toMountPath(buildWorkflowListRelativePath(mountId)));
      return;
    }

    const target = definitions.find((definition) => definition.id === id);
    if (target) {
      navigate(toMountPath(buildWorkflowEditRelativePath(target, mountId)));
    }
  }, [definitions, mountId, navigate, toMountPath]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (skipUrlToStateSyncRef.current) {
      skipUrlToStateSyncRef.current = false;
      return;
    }

    if (!editSlugFromUrl) {
      if (openDefinitionId !== null) {
        setOpenDefinitionIdState(null);
      }
      return;
    }

    const matched = findWorkflowByEditSlug(definitions, editSlugFromUrl);
    if (!matched) {
      navigate(toMountPath(buildWorkflowListRelativePath(mountId)), { replace: true });
      return;
    }

    if (openDefinitionId !== matched.id) {
      setOpenDefinitionIdState(matched.id);
    }
  }, [
    definitions,
    editSlugFromUrl,
    isLoading,
    mountId,
    navigate,
    openDefinitionId,
    toMountPath,
  ]);

  useEffect(() => {
    if (!openDefinitionId || !editSlugFromUrl) {
      return;
    }

    const target = definitions.find((definition) => definition.id === openDefinitionId);
    if (!target) {
      return;
    }

    const canonicalPath = toMountPath(buildWorkflowEditRelativePath(target, mountId));
    if (location.pathname !== canonicalPath) {
      navigate(canonicalPath, { replace: true });
    }
  }, [definitions, editSlugFromUrl, location.pathname, mountId, navigate, openDefinitionId, toMountPath]);

  const openCreateModal = () => {    setCreateError(null);
    setNewWorkflowKey('');
    setIsCreateOpen(true);
  };

  const handleCreateWorkflow = async () => {
    const key = newWorkflowKey.trim();
    if (!key) {
      return;
    }
    setIsCreating(true);
    setCreateError(null);
    try {
      const result = await workflowsApi.createDefinition({ key });
      const newId = (result.record as { id: number }).id;
      setIsCreateOpen(false);
      setNewWorkflowKey('');
      await loadDefinitions('refresh');
      setOpenDefinitionId(newId);    } catch (error) {
      setCreateError(error instanceof WorkflowsApiError ? `${error.code}: ${error.message}` : 'Failed to create workflow.');
    } finally {
      setIsCreating(false);
    }
  };

  const toggleSortDirection = () => {
    setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
  };

  const openDuplicateDialog = (definition: WorkflowDefinitionSummary) => {
    setDuplicateSource(workflowDuplicateSourceFromSummary(definition));
    setIsDuplicateOpen(true);
  };

  const closeDuplicateDialog = () => {
    setIsDuplicateOpen(false);
    setDuplicateSource(null);
  };

  const handleDuplicated = async (newDefinitionId: number) => {
    closeDuplicateDialog();
    await loadDefinitions('refresh');
    setOpenDefinitionId(newDefinitionId);
    setToast({ type: 'success', text: 'Workflow duplicated.' });
  };

  const closeDeleteDialog = (force = false) => {
    if (isDeleting && !force) {
      return;
    }
    setDeleteTarget(null);
    setDeletePreview(null);
    setDeleteConfirmName('');
    setDeleteError(null);
    setIsDeletePreviewLoading(false);
  };

  const openDeleteDialog = (definition: WorkflowDefinitionSummary) => {
    if (isWorkflowPublished(definition)) {
      return;
    }
    setDeleteTarget(definition);
    setDeletePreview(null);
    setDeleteConfirmName('');
    setDeleteError(null);
    setIsDeletePreviewLoading(true);
    void workflowsApi.getDeleteImpact(definition.id)
      .then((result) => {
        setDeletePreview(buildWorkflowDeletePreviewFromImpact(result.impact));
        setDeleteError(null);
      })
      .catch((loadError) => {
        setDeletePreview(null);
        setDeleteError(formatWorkflowsApiError(loadError, 'Failed to load workflow details.'));
      })
      .finally(() => setIsDeletePreviewLoading(false));
  };

  const handleDeleteWorkflow = async () => {
    if (!deleteTarget || !deletePreview?.canDelete) {
      return;
    }
    if (deletePreview.hasExecutionHistory && deleteConfirmName.trim() !== deleteTarget.key) {
      return;
    }

    const expectedDefinitionStateVersion = deletePreview.stateVersion;

    setIsDeleting(true);
    setDeleteError(null);
    try {
      await workflowsApi.deleteDefinition(deleteTarget.id, expectedDefinitionStateVersion);
      const deletedId = deleteTarget.id;
      closeDeleteDialog(true);
      if (openDefinitionId === deletedId) {
        setOpenDefinitionId(null);
      }
      await loadDefinitions('refresh');
      setToast({ type: 'success', text: 'Workflow deleted.' });
    } catch (error) {
      setDeleteError(formatWorkflowsApiError(error, 'Failed to delete workflow.'));
    } finally {
      setIsDeleting(false);
    }
  };

  useWorkflowsListOverlayDeepLink({
    enabled: openDefinitionId === null,
    definitions,
    deadLettersOpen,
    setDeadLettersOpen,
    slaViolationsOpen,
    setSlaViolationsOpen,
    isCreateOpen,
    openCreateModal,
    isDuplicateOpen,
    deleteTarget,
    openDeleteDialog,
    dossierDefinitionId,
    openDossier,
  });

  return {
    definitions,
    sortedDefinitions,
    totalCount: definitions.length,
    filteredCount: filteredDefinitions.length,
    isLoading,
    isRefreshing,
    loadError,
    searchQuery,
    setSearchQuery,
    publishedFilter,
    setPublishedFilter,
    sortBy,
    setSortBy,
    sortDirection,
    toggleSortDirection,
    openDefinitionId,
    editSlugFromUrl,
    setOpenDefinitionId,    isCreateOpen,
    setIsCreateOpen,
    newWorkflowKey,
    setNewWorkflowKey,
    createError,
    isCreating,
    openCreateModal,
    handleCreateWorkflow,
    refreshDefinitions: () => loadDefinitions('refresh'),
    toast,
    setToast,
    duplicateSource,
    isDuplicateOpen,
    openDuplicateDialog,
    closeDuplicateDialog,
    handleDuplicated,
    deleteTarget,
    deletePreview,
    deleteConfirmName,
    setDeleteConfirmName,
    deleteError,
    isDeletePreviewLoading,
    isDeleting,
    openDeleteDialog,
    closeDeleteDialog,
    handleDeleteWorkflow,
    deadLettersOpen,
    setDeadLettersOpen,
    slaViolationsOpen,
    setSlaViolationsOpen,
    dossierDefinitionId,
    openDossier,
    closeDossier,
  };
}

export type WorkflowsPageState = ReturnType<typeof useWorkflowsPage>;
