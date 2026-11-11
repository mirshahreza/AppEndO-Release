import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TreeDropPosition } from '@/src/components/ui/BaseTreeGrid';
import {
  fetchBaseInfoChildren,
  useCreateBaseInfoMutation,
  useDeleteBaseInfoMutation,
  useMoveBaseInfoMutation,
  useUpdateBaseInfoMutation,
} from '@/src/shared/api/queries/base-info';
import { EMPTY_EDIT_FORM, ROOT_KEY } from '../constants';
import type { BaseInfoEditForm, BaseInfoRow, BaseInfoTreeRow, TreeDisplayRow } from '../types';

export function useBaseInfoPage() {
  const createMutation = useCreateBaseInfoMutation();
  const updateMutation = useUpdateBaseInfoMutation();
  const deleteMutation = useDeleteBaseInfoMutation();
  const moveMutation = useMoveBaseInfoMutation();

  const [rowsById, setRowsById] = useState<Record<string, BaseInfoRow>>({});
  const [childrenByParent, setChildrenByParent] = useState<Record<string, string[]>>({});
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});
  const [loadedParents, setLoadedParents] = useState<Record<string, boolean>>({});
  const [loadingByParent, setLoadingByParent] = useState<Record<string, boolean>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState('en');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<BaseInfoEditForm>(EMPTY_EDIT_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BaseInfoRow | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

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
      const items = await fetchBaseInfoChildren({ lang, root: '', parentId });
      mergeRows(items);
      setChildrenByParent((prev) => ({
        ...prev,
        [parentKey]: items.map((item) => item.id),
      }));
      setLoadedParents((prev) => ({ ...prev, [parentKey]: true }));
    } finally {
      setLoadingByParent((prev) => ({ ...prev, [parentKey]: false }));
    }
  }, [lang, mergeRows]);

  const load = useCallback(async (options?: { expandedById?: Record<string, boolean> }) => {
    setIsLoading(true);
    setError(null);

    try {
      setRowsById({});
      setChildrenByParent({});
      setExpandedById(options?.expandedById || {});
      setLoadedParents({});
      await loadChildren(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error while loading base info tree.';
      setError(msg);
      setRowsById({});
      setChildrenByParent({});
      setExpandedById(options?.expandedById || {});
      setLoadedParents({});
    } finally {
      setIsLoading(false);
    }
  }, [loadChildren]);

  useEffect(() => {
    void load();
  }, [load]);

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
    setEditingId(row.id);
    setSaveError(null);
    setEditForm({
      parentId: row.parent_id || '',
      childDigits: '3',
      title: row.title || '',
      titleEn: row.title_en || '',
      titleFa: row.title_fa || '',
      titleAr: row.title_ar || '',
      shortName: row.short_name || '',
      note: row.note || '',
      noteEn: row.note_en || '',
      noteFa: row.note_fa || '',
      noteAr: row.note_ar || '',
      viewOrder: row.view_order === null || row.view_order === undefined ? '' : String(row.view_order),
      value: row.value === null || row.value === undefined ? '' : String(row.value),
      metadata: row.metadata || '',
      uiColor: row.ui_color || '',
      uiHtml: row.ui_html || '',
      isActive: Boolean(row.is_active),
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
      await deleteMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      await load();
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

  const buildSavePayload = () => ({
    parentId: editForm.parentId.trim() || undefined,
    title: editForm.title.trim() || undefined,
    titleEn: editForm.titleEn.trim() || undefined,
    titleFa: editForm.titleFa.trim() || undefined,
    titleAr: editForm.titleAr.trim() || undefined,
    shortName: editForm.shortName.trim() || undefined,
    note: editForm.note.trim() || undefined,
    noteEn: editForm.noteEn.trim() || undefined,
    noteFa: editForm.noteFa.trim() || undefined,
    noteAr: editForm.noteAr.trim() || undefined,
    viewOrder: editForm.viewOrder.trim() ? Number(editForm.viewOrder) : undefined,
    value: editForm.value.trim() ? Number(editForm.value) : undefined,
    metadata: editForm.metadata.trim() || undefined,
    uiColor: editForm.uiColor.trim() || undefined,
    uiHtml: editForm.uiHtml.trim() || undefined,
    isActive: editForm.isActive,
  });

  const submitEdit = async () => {
    if (!editingId) return;
    if (!editForm.title.trim() && !editForm.titleEn.trim() && !editForm.titleFa.trim() && !editForm.titleAr.trim()) {
      setSaveError('At least one title is required.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await updateMutation.mutateAsync({ id: editingId, body: buildSavePayload() });
      await load();
      closeModal();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Network error while saving changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const submitCreate = async () => {
    if (!editForm.title.trim() && !editForm.titleEn.trim() && !editForm.titleFa.trim() && !editForm.titleAr.trim()) {
      setSaveError('At least one title is required.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const parsedChildDigits = Number(editForm.childDigits || '3');
      const childDigits = Number.isFinite(parsedChildDigits) && parsedChildDigits > 0 ? parsedChildDigits : 3;
      await createMutation.mutateAsync({
        ...buildSavePayload(),
        childDigits,
      });
      await load();
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

  const isModalOpen = Boolean(editingId || isCreateModalOpen);

  return {
    lang,
    setLang,
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
    submitCreate,
    submitEdit,
    rootCount,
    totalLoaded,
    expandAll,
    collapseAll,
  };
}

export type BaseInfoPageModel = ReturnType<typeof useBaseInfoPage>;
