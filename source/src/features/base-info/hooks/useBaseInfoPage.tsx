import { useCallback, useEffect, useMemo, useRef, useState, type UIEvent } from 'react';
import { useCollapsingListToolbar } from '../../../shared/lib/useCollapsingListToolbar';
import { useCulture } from '../../../core/culture/CultureContext';
import type { TreeDropPosition } from '../../../components/ui/BaseTreeGrid';
import {
  fetchBaseInfoChildren,
  fetchBaseInfoNode,
  useCreateBaseInfoMutation,
  useDeleteBaseInfoMutation,
  useMoveBaseInfoMutation,
  useUpdateBaseInfoMutation,
} from '../../../shared/api/queries/base-info';
import {
  persistBaseInfoExpandedById,
  readStoredBaseInfoExpandedById,
} from '../baseInfoTreePreferences';
import { EMPTY_EDIT_FORM, ROOT_KEY } from '../constants';
import { buildBaseInfoCreatePayload, buildBaseInfoSavePayload } from '../lib/buildBaseInfoSavePayload';
import type { BaseInfoEditForm, BaseInfoRow, BaseInfoTreeRow, TreeDisplayRow } from '../types';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { usePersistedListFilters } from '../../../shared/lib/usePersistedListPreferences';

type BaseInfoListFilters = {
  search: string;
};

const DEFAULT_BASE_INFO_FILTERS: BaseInfoListFilters = {
  search: '',
};

function sanitizeBaseInfoFilters(raw: unknown): BaseInfoListFilters | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  return {
    search: typeof record.search === 'string' ? record.search : '',
  };
}

export function useBaseInfoPage() {
  const { cultureId } = useCulture();
  const { onListBodyScroll } = useCollapsingListToolbar();
  const createMutation = useCreateBaseInfoMutation();
  const updateMutation = useUpdateBaseInfoMutation();
  const deleteMutation = useDeleteBaseInfoMutation();
  const moveMutation = useMoveBaseInfoMutation();

  const [rowsById, setRowsById] = useState<Record<string, BaseInfoRow>>({});
  const [childrenByParent, setChildrenByParent] = useState<Record<string, string[]>>({});
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>(
    () => readStoredBaseInfoExpandedById(),
  );
  const expandedByIdRef = useRef(expandedById);
  expandedByIdRef.current = expandedById;
  const [loadedParents, setLoadedParents] = useState<Record<string, boolean>>({});
  const [loadingByParent, setLoadingByParent] = useState<Record<string, boolean>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = usePersistedListFilters({
    listKey: APP_LIST_PREFERENCE_KEYS.baseInfo,
    defaultFilters: DEFAULT_BASE_INFO_FILTERS,
    sanitize: sanitizeBaseInfoFilters,
  });
  const search = filters.search;
  const setSearch = useCallback((next: string) => {
    setFilters({ search: next });
  }, [setFilters]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<BaseInfoEditForm>(EMPTY_EDIT_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BaseInfoRow | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const activeEditLoadIdRef = useRef<string | null>(null);

  const mergeRows = useCallback((items: BaseInfoRow[]) => {
    setRowsById((prev) => {
      const next = { ...prev };
      for (const item of items) {
        next[item.id] = item;
      }
      return next;
    });
  }, []);

  const loadChildren = useCallback(async (parentId?: string | null) => {
    const parentKey = parentId || ROOT_KEY;
    setLoadingByParent((prev) => ({ ...prev, [parentKey]: true }));

    try {
      const items = await fetchBaseInfoChildren({ lang: cultureId, root: '', parentId });
      mergeRows(items);
      setChildrenByParent((prev) => ({
        ...prev,
        [parentKey]: items.map((item) => item.id),
      }));
      setLoadedParents((prev) => ({ ...prev, [parentKey]: true }));
    } finally {
      setLoadingByParent((prev) => ({ ...prev, [parentKey]: false }));
    }
  }, [cultureId, mergeRows]);

  const load = useCallback(async (options?: { expandedById?: Record<string, boolean> }) => {
    const nextExpandedById = options?.expandedById ?? expandedByIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      setRowsById({});
      setChildrenByParent({});
      setExpandedById(nextExpandedById);
      setLoadedParents({});
      await loadChildren(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error while loading base info tree.';
      setError(msg);
      setRowsById({});
      setChildrenByParent({});
      setExpandedById(nextExpandedById);
      setLoadedParents({});
    } finally {
      setIsLoading(false);
    }
  }, [loadChildren]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    persistBaseInfoExpandedById(expandedById);
  }, [expandedById]);

  const treeRows = useMemo(() => {
    const result: TreeDisplayRow[] = [];

    const walk = (parentKey: string, depth: number) => {
      const children = childrenByParent[parentKey] || [];
      for (const childId of children) {
        const row = rowsById[childId];
        if (!row) continue;
        result.push({ id: childId, depth, row });
        if (expandedById[childId]) {
          walk(childId, depth + 1);
        }
      }
    };

    walk(ROOT_KEY, 0);
    return result;
  }, [childrenByParent, expandedById, rowsById]);

  const filteredTreeRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return treeRows;
    return treeRows.filter((item) => {
      const label = (item.row.label || item.row.title || '').toLowerCase();
      return item.row.id.toLowerCase().includes(q) || label.includes(q);
    });
  }, [treeRows, search]);

  const rootCount = (childrenByParent[ROOT_KEY] || []).length;
  const totalLoaded = Object.keys(rowsById).length;

  const toggleExpand = async (row: BaseInfoRow) => {
    if (!row.has_children) return;

    const isExpanded = Boolean(expandedById[row.id]);
    if (isExpanded) {
      setExpandedById((prev) => ({ ...prev, [row.id]: false }));
      return;
    }

    setExpandedById((prev) => ({ ...prev, [row.id]: true }));
    if (!loadedParents[row.id]) {
      try {
        await loadChildren(row.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load child nodes.';
        setError(msg);
      }
    }
  };

  const openEditModal = (row: BaseInfoRow) => {
    setIsCreateModalOpen(false);
    const openedId = row.id;
    activeEditLoadIdRef.current = openedId;
    setEditingId(openedId);
    setSaveError(null);
    const rowUiHtml = typeof row.ui_html === 'string' ? row.ui_html : '';
    setEditForm({
      ...EMPTY_EDIT_FORM,
      parentId: row.parent_id || '',
      title: row.title || row.label || '',
      uiHtml: rowUiHtml,
    });
    void fetchBaseInfoNode(openedId)
      .then((detail) => {
        if (!detail || activeEditLoadIdRef.current !== openedId) {
          return;
        }
        setEditForm({
          parentId: detail.parentId || '',
          childDigits: '3',
          title: detail.title || '',
          shortName: detail.shortName || '',
          note: detail.note || '',
          locales: detail.locales ?? {},
          viewOrder: detail.viewOrder === null || detail.viewOrder === undefined ? '' : String(detail.viewOrder),
          value: detail.value === null || detail.value === undefined ? '' : String(detail.value),
          metadata: detail.metadata || '',
          uiColor: detail.uiColor || '',
          uiHtml: detail.uiHtml
            || (typeof (detail as { ui_html?: string | null }).ui_html === 'string'
              ? (detail as { ui_html: string }).ui_html
              : ''),
          isActive: detail.isActive !== false,
        });
      })
      .catch((err) => {
        if (activeEditLoadIdRef.current !== openedId) {
          return;
        }
        setSaveError(err instanceof Error ? err.message : 'Failed to load this record.');
      });
  };

  const openCreateModal = () => {
    setEditingId(null);
    setIsCreateModalOpen(true);
    setSaveError(null);
    setEditForm(EMPTY_EDIT_FORM);
  };

  const openCreateChildModal = (row: BaseInfoRow) => {
    setEditingId(null);
    setIsCreateModalOpen(true);
    setSaveError(null);
    setEditForm({
      ...EMPTY_EDIT_FORM,
      parentId: row.id,
    });
  };

  const closeModal = () => {
    activeEditLoadIdRef.current = null;
    setEditingId(null);
    setIsCreateModalOpen(false);
    setSaveError(null);
    setEditForm(EMPTY_EDIT_FORM);
  };

  const openDeleteModal = (row: BaseInfoRow) => {
    if (row.has_children) return;
    setDeleteTarget(row);
    setSaveError(null);
  };

  const closeDeleteModal = () => {
    if (isDeleting) return;
    setDeleteTarget(null);
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setSaveError(null);
    try {
      const deletedId = deleteTarget.id;
      const nextExpandedById = { ...expandedById };
      delete nextExpandedById[deletedId];
      await deleteMutation.mutateAsync(deletedId);
      setDeleteTarget(null);
      await load({ expandedById: nextExpandedById });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete node.';
      setSaveError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const collectAncestorChain = useCallback((startId: string | null) => {
    const chain: string[] = [];
    const seen = new Set<string>();
    let cursor = startId;
    while (cursor && !seen.has(cursor)) {
      chain.push(cursor);
      seen.add(cursor);
      cursor = rowsById[cursor]?.parent_id || null;
    }
    return chain;
  }, [rowsById]);

  const moveNode = useCallback(async (sourceId: string, targetId: string | null, position: TreeDropPosition) => {
    setIsMoving(true);
    setError(null);

    const nextExpandedById: Record<string, boolean> = { ...expandedById };
    if (targetId) {
      if (position === 'inside') {
        const chain = collectAncestorChain(targetId);
        for (const nodeId of chain) {
          nextExpandedById[nodeId] = true;
        }
      } else {
        const parentId = rowsById[targetId]?.parent_id || null;
        const chain = collectAncestorChain(parentId);
        for (const nodeId of chain) {
          nextExpandedById[nodeId] = true;
        }
      }
    }

    try {
      await moveMutation.mutateAsync({
        id: sourceId,
        body: { targetId, position },
      });
      await load({ expandedById: nextExpandedById });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to move node.';
      setError(msg);
    } finally {
      setIsMoving(false);
    }
  }, [collectAncestorChain, expandedById, load, moveMutation, rowsById]);

  const isKnownDescendant = useCallback((sourceId: string, candidateParentId: string) => {
    const stack = [...(childrenByParent[sourceId] || [])];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) continue;
      if (current === candidateParentId) return true;
      const children = childrenByParent[current] || [];
      for (const child of children) stack.push(child);
    }
    return false;
  }, [childrenByParent]);

  const canDropNode = useCallback((sourceId: string, targetId: string | null, position: TreeDropPosition) => {
    if (!targetId) {
      return true;
    }

    if (sourceId === targetId) return false;
    if (isKnownDescendant(sourceId, targetId)) return false;

    if (position === 'inside') {
      return true;
    }

    const effectiveParentId = rowsById[targetId]?.parent_id || null;
    if (effectiveParentId === sourceId) return false;
    if (effectiveParentId && isKnownDescendant(sourceId, effectiveParentId)) return false;

    return true;
  }, [isKnownDescendant, rowsById]);

  useEffect(() => {
    const pendingLoads = Object.keys(expandedById).filter((id) => (
      expandedById[id]
      && !loadedParents[id]
      && Boolean(rowsById[id]?.has_children)
      && !loadingByParent[id]
    ));

    if (pendingLoads.length === 0) return;

    for (const id of pendingLoads) {
      void loadChildren(id).catch((err) => {
        const msg = err instanceof Error ? err.message : 'Failed to load child nodes.';
        setError(msg);
      });
    }
  }, [expandedById, loadedParents, loadingByParent, rowsById, loadChildren]);

  const collapseAll = useCallback(() => {
    setExpandedById({});
  }, []);

  const expandAll = useCallback(() => {
    setExpandedById((current) => {
      const next = { ...current };
      for (const row of Object.values(rowsById)) {
        if (row?.has_children) {
          next[row.id] = true;
        }
      }
      return next;
    });
  }, [rowsById]);

  const treeGridRows = useMemo<BaseInfoTreeRow[]>(() => (
    filteredTreeRows.map(({ row, depth }) => ({
      id: row.id,
      parentId: row.parent_id,
      depth,
      hasChildren: Boolean(row.has_children),
      row,
    }))
  ), [filteredTreeRows]);

  const buildSavePayload = () => buildBaseInfoSavePayload(editForm);

  const submitEdit = async () => {
    if (!editingId) return;
    if (!editForm.title.trim()) {
      setSaveError('Title (canonical) is required.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await updateMutation.mutateAsync({ id: editingId, body: buildSavePayload() });
      await load({ expandedById });
      closeModal();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Network error while saving changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const submitCreate = async () => {
    if (!editForm.title.trim()) {
      setSaveError('Title (canonical) is required.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const parentId = editForm.parentId.trim();
      const nextExpandedById = { ...expandedById };
      if (parentId) nextExpandedById[parentId] = true;
      await createMutation.mutateAsync(buildBaseInfoCreatePayload(editForm));
      await load({ expandedById: nextExpandedById });
      closeModal();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Network error while saving changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const isCreateMode = isCreateModalOpen;
  const parentDisplayValue = useMemo(() => {
    const parentId = editForm.parentId.trim();
    if (!parentId) return 'Root';
    const parentRow = rowsById[parentId];
    const parentLabel = parentRow?.label || parentRow?.title || parentRow?.title_en || parentRow?.title_fa || parentRow?.title_ar;
    return parentLabel ? `${parentId} - ${parentLabel}` : parentId;
  }, [editForm.parentId, rowsById]);

  const titlePathDisplayValue = useMemo(() => {
    if (!editingId) {
      return null;
    }
    return rowsById[editingId]?.title_path ?? null;
  }, [editingId, rowsById]);

  const isModalOpen = Boolean(editingId || isCreateModalOpen);

    const handleTreeScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    onListBodyScroll(event.currentTarget.scrollTop, event.currentTarget);
  }, [onListBodyScroll]);

  return {
    search,
    setSearch,
    load,
    openCreateModal,
    openCreateChildModal,
    isLoading,
    error,
    filteredTreeRows,
    treeGridRows,
    expandedById,
    loadingByParent,
    isMoving,
    isSaving,
    isDeleting,
    editingId,
    isCreateModalOpen,
    isModalOpen,
    deleteTarget,
    toggleExpand,
    moveNode,
    canDropNode,
    openEditModal,
    openDeleteModal,
    closeDeleteModal,
    submitDelete,
    closeModal,
    editForm,
    setEditForm,
    saveError,
    isCreateMode,
    parentDisplayValue,
    titlePathDisplayValue,
    submitCreate,
    submitEdit,
    rootCount,
    totalLoaded,
    expandAll,
    collapseAll,
    handleTreeScroll,
  };
}

export type BaseInfoPageModel = ReturnType<typeof useBaseInfoPage>;
