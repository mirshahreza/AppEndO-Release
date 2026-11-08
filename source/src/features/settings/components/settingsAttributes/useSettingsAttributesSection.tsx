import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSettingsAttributesOverlayDeepLink } from '../../hooks/useSettingsAttributesOverlayDeepLink';
import { useCultureT } from '../../../../core/culture/CultureContext';
import {
  useSettingsAttributesQuery,
  useCreateSettingsAttributeMutation,
  useDeleteSettingsAttributeMutation,
  useReorderSettingsAttributesMutation,
  useUpdateSettingsAttributeMutation,
} from '../../../../shared/api/queries/settingsAttributes';
import { formatApiErrorMessage, formatQueryError, isApiError } from '../../../../shared/api/client';
import type { SettingsAttributeRecord, AttributeScope } from '../../../../shared/api/contracts/attributes/types';
import { APP_LIST_PREFERENCE_KEYS } from '../../../../shared/lib/listPreferenceKeys';
import { usePersistedListFilters } from '../../../../shared/lib/usePersistedListPreferences';
import {
  EMPTY_SETTINGS_ATTRIBUTE_FORM,
} from './constants';
import type {
  ActiveFilter,
  SettingsAttributeFormState,
  SettingsAttributeSortField,
  ToastState,
} from './types';
import { formFromRecord } from './types';
import { getMutationError, isValidAttributeKey, toPayloadNumbers } from './utils';
import { attributeText } from '../../settingsAttributesI18n';

type SettingsAttributesListFilters = {
  searchInput: string;
  activeFilter: ActiveFilter;
};

const DEFAULT_SETTINGS_ATTRIBUTES_FILTERS: SettingsAttributesListFilters = {
  searchInput: '',
  activeFilter: 'ALL',
};

function sanitizeSettingsAttributesFilters(raw: unknown): SettingsAttributesListFilters | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const activeFilter = record.activeFilter === 'ALL'
    || record.activeFilter === 'ACTIVE'
    || record.activeFilter === 'INACTIVE'
    ? record.activeFilter
    : 'ALL';
  return {
    searchInput: typeof record.searchInput === 'string'
      ? record.searchInput
      : typeof record.searchText === 'string'
        ? record.searchText
        : '',
    activeFilter,
  };
}

export function useSettingsAttributesSection(scope: AttributeScope) {
  const t = useCultureT();
  const definitionsQuery = useSettingsAttributesQuery(scope);
  const createMutation = useCreateSettingsAttributeMutation(scope);
  const updateMutation = useUpdateSettingsAttributeMutation(scope);
  const deleteMutation = useDeleteSettingsAttributeMutation(scope);
  const reorderMutation = useReorderSettingsAttributesMutation(scope);

  const definitions = definitionsQuery.data ?? [];
  const isLoading = definitionsQuery.isLoading;
  const isError = definitionsQuery.isError;
  const error = isError
    ? formatQueryError(definitionsQuery.error, attributeText('loadFailed', t))
    : null;

  const retryLoad = useCallback(() => {
    void definitionsQuery.refetch();
  }, [definitionsQuery]);

  const [filters, setFilters] = usePersistedListFilters({
    listKey: `${APP_LIST_PREFERENCE_KEYS.settingsAttributes}:${scope}`,
    defaultFilters: DEFAULT_SETTINGS_ATTRIBUTES_FILTERS,
    sanitize: sanitizeSettingsAttributesFilters,
  });
  const { searchInput, activeFilter } = filters;
  const [searchText, setSearchText] = useState(searchInput);

  const setSearchInput = useCallback((next: string) => {
    setFilters((prev) => ({ ...prev, searchInput: next }));
  }, [setFilters]);

  const setActiveFilter = useCallback((next: ActiveFilter) => {
    setFilters((prev) => ({ ...prev, activeFilter: next }));
  }, [setFilters]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState<SettingsAttributeFormState>({ ...EMPTY_SETTINGS_ATTRIBUTE_FORM });
  const [formError, setFormError] = useState<string | null>(null);

  const [editingRecord, setEditingRecord] = useState<SettingsAttributeRecord | null>(null);
  const [editForm, setEditForm] = useState<SettingsAttributeFormState>({ ...EMPTY_SETTINGS_ATTRIBUTE_FORM });
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [toast, setToast] = useState<ToastState | null>(null);

  const [sortBy, setSortBy] = useState<SettingsAttributeSortField>('view_order');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

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

  const renderActorLabel = useCallback((username?: string | null, actorId?: number | null) => {
    const label = username || (actorId ? `#${actorId}` : null);
    if (!label) return <span className="text-slate-300">-</span>;
    return <span className="text-slate-600">{label}</span>;
  }, []);

  const nextViewOrder = useMemo(() => {
    if (definitions.length === 0) return 0;
    return Math.max(...definitions.map((record) => Number(record.view_order ?? 0))) + 10;
  }, [definitions]);

  const buildPayload = (state: SettingsAttributeFormState, options?: { viewOrder?: number }) => ({
    key: state.key.trim(),
    label: state.label.trim() || null,
    scope,
    sourceType: state.sourceType,
    baseInfoRootId: state.sourceType === 'BASE_INFO' ? state.baseInfoRootId.trim() || null : null,
    profileField: null,
    dataType: state.sourceType === 'CUSTOM' ? state.dataType : null,
    cardinality: state.sourceType === 'CUSTOM' ? 'single' : state.cardinality,
    minSelections: state.sourceType !== 'CUSTOM' && state.cardinality === 'multi'
      ? toPayloadNumbers(state.minSelections)
      : null,
    maxSelections: state.sourceType !== 'CUSTOM' && state.cardinality === 'multi'
      ? toPayloadNumbers(state.maxSelections)
      : null,
    visibility: state.visibility,
    isRequired: state.isRequired,
    isActive: state.isActive,
    userEditPolicy: scope === 'USER' ? state.userEditPolicy : 'NONE',
    viewOrder: options?.viewOrder ?? (Number(state.viewOrder) || 0),
  });

  const openCreateModal = () => {
    setShowCreateModal(true);
    setFormError(null);
    setForm({ ...EMPTY_SETTINGS_ATTRIBUTE_FORM });
  };

  const handleCreate = async () => {
    if (!form.key.trim()) {
      setFormError(attributeText('keyRequired', t));
      return;
    }
    if (!isValidAttributeKey(form.key)) {
      setFormError(attributeText('keyInvalid', t));
      return;
    }
    if (form.sourceType === 'BASE_INFO' && !form.baseInfoRootId.trim()) {
      setFormError(attributeText('baseInfoRootRequired', t));
      return;
    }

    setFormError(null);
    try {
      const { data } = await createMutation.mutateAsync(buildPayload(form, { viewOrder: nextViewOrder }));
      const mutationError = getMutationError(data, attributeText('createFailed', t));
      if (mutationError) {
        setFormError(mutationError);
        return;
      }
      setShowCreateModal(false);
      setForm({ ...EMPTY_SETTINGS_ATTRIBUTE_FORM });
      showToast('success', attributeText('created', t));
    } catch (caught) {
      setFormError(isApiError(caught) ? formatApiErrorMessage(caught) : attributeText('networkError', t));
    }
  };

  const startEdit = (record: SettingsAttributeRecord) => {
    setEditingRecord(record);
    setEditForm(formFromRecord(record));
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingRecord(null);
    setEditForm({ ...EMPTY_SETTINGS_ATTRIBUTE_FORM });
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!editingRecord) return;

    if (editForm.sourceType === 'BASE_INFO' && !editForm.baseInfoRootId.trim()) {
      setEditError(attributeText('baseInfoRootRequired', t));
      return;
    }

    setEditError(null);
    try {
      const { key, scope: _scope, ...payload } = buildPayload(editForm);
      const { data } = await updateMutation.mutateAsync({
        id: editingRecord.id,
        payload: { ...payload, key },
      });
      const mutationError = getMutationError(data, attributeText('updateFailed', t));
      if (mutationError) {
        setEditError(mutationError);
        return;
      }
      cancelEdit();
      showToast('success', attributeText('updated', t));
    } catch (caught) {
      setEditError(isApiError(caught) ? formatApiErrorMessage(caught) : attributeText('networkError', t));
    }
  };

  const requestDelete = (id: number) => {
    const record = definitions.find((item) => item.id === id);
    if (record?.is_builtin) {
      showToast('error', attributeText('builtinDeleteBlocked', t));
      return;
    }
    setDeleteId(id);
    setDeleteError(null);
  };

  const cancelDelete = () => {
    setDeleteId(null);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (deleteId === null) return;

    setDeleteError(null);
    try {
      const { data } = await deleteMutation.mutateAsync(deleteId);
      const mutationError = getMutationError(data, attributeText('deleteFailed', t));
      if (mutationError) {
        setDeleteError(mutationError);
        return;
      }
      setDeleteId(null);
      showToast('success', attributeText('deleted', t));
    } catch (caught) {
      setDeleteError(isApiError(caught) ? formatApiErrorMessage(caught) : attributeText('networkError', t));
    }
  };

  const orderedDefinitions = useMemo(() => {
    const filtered = definitions.filter((record) => {
      if (activeFilter === 'ACTIVE' && !record.is_active) return false;
      if (activeFilter === 'INACTIVE' && record.is_active) return false;

      const q = searchText.trim().toLowerCase();
      if (!q) return true;

      return (
        record.key.toLowerCase().includes(q)
        || (record.label ?? '').toLowerCase().includes(q)
        || String(record.id).includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      let left: string | number = '';
      let right: string | number = '';

      if (sortBy === 'key') {
        left = a.key.toLowerCase();
        right = b.key.toLowerCase();
      } else if (sortBy === 'created_at') {
        left = new Date(a.created_at || 0).getTime();
        right = new Date(b.created_at || 0).getTime();
      } else {
        left = Number(a.view_order ?? 0);
        right = Number(b.view_order ?? 0);
      }

      if (left === right) return 0;
      const compare = left > right ? 1 : -1;
      return sortDirection === 'asc' ? compare : -compare;
    });
  }, [definitions, searchText, sortBy, sortDirection, activeFilter]);

  const canReorder = sortBy === 'view_order'
    && searchText.trim().length === 0
    && activeFilter === 'ALL';

  const handleReorder = async (orderedIds: number[]) => {
    try {
      const { data } = await reorderMutation.mutateAsync(orderedIds);
      const mutationError = getMutationError(data, attributeText('reorderFailed', t));
      if (mutationError) {
        showToast('error', mutationError);
        return;
      }
      showToast('success', attributeText('reordered', t));
    } catch (caught) {
      showToast('error', isApiError(caught) ? formatApiErrorMessage(caught) : attributeText('networkError', t));
    }
  };

  useSettingsAttributesOverlayDeepLink({
    showCreateModal,
    openCreateModal,
    editingRecord,
    startEdit,
    definitions,
    deleteId,
    requestDelete,
  });

    return {
    scope,
    searchInput,
    setSearchInput,
    activeFilter,
    setActiveFilter,
    openCreateModal,
    isLoading,
    isError,
    error,
    retryLoad,
    isRetrying: definitionsQuery.isFetching && isError,
    isRefreshing: definitionsQuery.isFetching && !definitionsQuery.isLoading,
    orderedDefinitions,
    canReorder,
    isReordering: reorderMutation.isPending,
    onReorder: handleReorder,
    renderActorLabel,
    startEdit,
    requestDelete,
    sortBy,
    setSortBy,
    sortDirection,
    setSortDirection,
    showCreateModal,
    setShowCreateModal,
    form,
    setForm,
    formError,
    handleCreate,
    isSaving: createMutation.isPending,
    editingRecord,
    editForm,
    setEditForm,
    editError,
    cancelEdit,
    saveEdit,
    isUpdating: updateMutation.isPending,
    deleteId,
    deleteError,
    cancelDelete,
    confirmDelete,
    toast,
  };
}

export type SettingsAttributesSectionState = ReturnType<typeof useSettingsAttributesSection>;
