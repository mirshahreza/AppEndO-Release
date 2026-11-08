import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCulture } from '../../../core/culture/CultureContext';
import type { TreeDropPosition } from '../../../components/ui/BaseTreeGrid';
import {
  fetchBaseInfoChildren,
  useCreateBaseInfoMutation,
  useDeleteBaseInfoMutation,
  useMoveBaseInfoMutation,
  useUpdateBaseInfoMutation,
} from '../../../shared/api/queries/base-info';
import { isBaseInfoIdInSubtree } from '../../../shared/lib/isBaseInfoIdInSubtree';
import { resolveLucideIconNameFromUiHtml } from '../../../shared/lib/baseInfoUiIcon';
import {
  EMPTY_EDIT_FORM,
  ROOT_KEY,
} from '../../base-info/constants';
import { buildBaseInfoCreatePayload, buildBaseInfoSavePayload } from '../../base-info/lib/buildBaseInfoSavePayload';
import type { BaseInfoEditForm, BaseInfoRow, BaseInfoTreeRow, TreeDisplayRow } from '../../base-info/types';
import {
  readOrgChartRootConfig,
  writeOrgChartRootConfigToMetadata,
  type OrgChartRootConfig,
} from '../lib/orgChartRootConfig';
import {
  readOrgChartSelectedNodeId,
  writeOrgChartSelectedNodeId,
} from '../lib/orgChartSelectionPrefs';
import type { OrgChartTreeNode } from '../types';
import { useListPageToolbarScroll } from '../../../shared/lib/useListPageToolbarScroll';

export type ScopedBaseInfoTreeOptions = {
  rootId: string;
  rootTitleFallback: string;
  /** Expand first N levels under the workspace root after the initial fetch. */
  initialTreeExpandedDepth?: number;
  resolveNodeTypeLabel?: (row: BaseInfoRow) => string | null;
  resolveNodeAccentColor?: (row: BaseInfoRow) => string | null;
};

const toDesignerNodes = (
  parentId: string,
  childrenByParent: Record<string, string[]>,
  rowsById: Record<string, BaseInfoRow>,
  resolveNodeTypeLabel?: (row: BaseInfoRow) => string | null,
  resolveNodeAccentColor?: (row: BaseInfoRow) => string | null,
): OrgChartTreeNode[] => {
  const childIds = childrenByParent[parentId] || [];
  return childIds.map((id) => {
    const row = rowsById[id];
    const label = row?.label || row?.title_en || row?.title || id;
    const icon = resolveLucideIconNameFromUiHtml(row?.ui_html) ?? undefined;
    const typeLabel = row ? resolveNodeTypeLabel?.(row) ?? undefined : undefined;
    const kindColor = row ? resolveNodeAccentColor?.(row) ?? undefined : undefined;
    const color = row?.ui_color?.trim() || kindColor || undefined;
    const children = toDesignerNodes(
      id,
      childrenByParent,
      rowsById,
      resolveNodeTypeLabel,
      resolveNodeAccentColor,
    );
    const hasChildren = Boolean(row?.has_children) || children.length > 0;
    return {
      id,
      label,
      isActive: row?.is_active !== false,
      ...(icon ? { icon } : {}),
      ...(color ? { color } : {}),
      ...(typeLabel ? { typeLabel } : {}),
      ...(hasChildren ? { hasChildren: true } : {}),
      children: children.length > 0 ? children : undefined,
    };
  });
};

export function useScopedBaseInfoTree({
  rootId,
  rootTitleFallback,
  initialTreeExpandedDepth = 0,
  resolveNodeTypeLabel,
  resolveNodeAccentColor,
}: ScopedBaseInfoTreeOptions) {
  const { cultureId } = useCulture();
  const createMutation = useCreateBaseInfoMutation();
  const updateMutation = useUpdateBaseInfoMutation();
  const deleteMutation = useDeleteBaseInfoMutation();
  const moveMutation = useMoveBaseInfoMutation();

  const [rootLabel, setRootLabel] = useState(rootTitleFallback);
  const [rowsById, setRowsById] = useState<Record<string, BaseInfoRow>>({});
  const [childrenByParent, setChildrenByParent] = useState<Record<string, string[]>>({});
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});
  const expandedByIdRef = useRef(expandedById);
  expandedByIdRef.current = expandedById;
  const [loadedParents, setLoadedParents] = useState<Record<string, boolean>>({});
  const [loadingByParent, setLoadingByParent] = useState<Record<string, boolean>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<BaseInfoEditForm>(EMPTY_EDIT_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BaseInfoRow | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedChartId, setSelectedChartId] = useState<string | undefined>(() => (
    readOrgChartSelectedNodeId(rootId) ?? undefined
  ));
  const [chartRevealId, setChartRevealId] = useState<string | null>(null);

  const inScope = useCallback((id: string | null | undefined) => {
    if (!id) return false;
    return isBaseInfoIdInSubtree(rootId, id);
  }, [rootId]);

  const mergeRows = useCallback((items: BaseInfoRow[]) => {
    setRowsById((prev) => {
      const next = { ...prev };
      for (const item of items) {
        if (inScope(item.id) || item.id === rootId) {
          next[item.id] = item;
        }
      }
      return next;
    });
  }, [inScope, rootId]);

  const loadChildren = useCallback(async (parentId: string) => {
    if (!inScope(parentId) && parentId !== rootId) return;
    setLoadingByParent((prev) => ({ ...prev, [parentId]: true }));
    try {
      const items = await fetchBaseInfoChildren({ lang: cultureId, root: '', parentId });
      const scoped = items.filter((item) => inScope(item.id));
      mergeRows(scoped);
      setChildrenByParent((prev) => ({
        ...prev,
        [parentId]: scoped.map((item) => item.id),
      }));
      setLoadedParents((prev) => ({ ...prev, [parentId]: true }));
    } finally {
      setLoadingByParent((prev) => ({ ...prev, [parentId]: false }));
    }
  }, [cultureId, inScope, mergeRows, rootId]);

  const load = useCallback(async (options?: { expandedById?: Record<string, boolean>; quiet?: boolean }) => {
    const nextExpandedById = options?.expandedById ?? expandedByIdRef.current;
    const quiet = Boolean(options?.quiet);
    if (!quiet) setIsLoading(true);
    setError(null);
    try {
      setRowsById({});
      setChildrenByParent({});
      setExpandedById(nextExpandedById);
      setLoadedParents({});

      const rootItems = await fetchBaseInfoChildren({ lang: cultureId, root: rootId, parentId: null });
      const rootRow = rootItems.find((item) => item.id === rootId) ?? null;
      if (rootRow) {
        mergeRows([rootRow]);
        setRootLabel(rootRow.label || rootRow.title_en || rootRow.title || rootTitleFallback);
      } else {
        setRootLabel(rootTitleFallback);
      }

      await loadChildren(rootId);

      if (initialTreeExpandedDepth > 0 && !options?.expandedById) {
        const expandLoadedLevels = async (parentId: string, levelsRemaining: number) => {
          if (levelsRemaining <= 0) return;
          await loadChildren(parentId);
          const items = await fetchBaseInfoChildren({ lang: cultureId, root: '', parentId });
          const scoped = items.filter((item) => inScope(item.id));
          mergeRows(scoped);
          if (scoped.length === 0) return;
          setExpandedById((prev) => {
            const next = { ...prev };
            for (const item of scoped) {
              if (item.has_children) next[item.id] = true;
            }
            return next;
          });
          for (const item of scoped) {
            if (item.has_children) {
              await expandLoadedLevels(item.id, levelsRemaining - 1);
            }
          }
        };
        await expandLoadedLevels(rootId, initialTreeExpandedDepth);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error while loading tree.';
      setError(msg);
      setRowsById({});
      setChildrenByParent({});
      setExpandedById(nextExpandedById);
      setLoadedParents({});
    } finally {
      if (!quiet) setIsLoading(false);
    }
  }, [cultureId, inScope, initialTreeExpandedDepth, loadChildren, mergeRows, rootId, rootTitleFallback]);

  useEffect(() => {
    void load();
  }, [load]);

  // Restore persisted selection when switching chart roots (org ↔ geo).
  useEffect(() => {
    setSelectedChartId(readOrgChartSelectedNodeId(rootId) ?? undefined);
  }, [rootId]);

  // Persist selection the same way zoom/pan prefs survive revisits.
  useEffect(() => {
    writeOrgChartSelectedNodeId(rootId, selectedChartId);
  }, [rootId, selectedChartId]);

  // Drop stale ids after chart reload (deleted / remapped hierarchical keys).
  useEffect(() => {
    if (isLoading || !selectedChartId) return;
    if (selectedChartId === rootId) return;
    // Skip while a quiet reload has wiped the tree maps (childrenByParent reset).
    if (!Object.prototype.hasOwnProperty.call(childrenByParent, rootId)) return;
    if (!rowsById[selectedChartId]) {
      setSelectedChartId(undefined);
    }
  }, [childrenByParent, isLoading, rootId, rowsById, selectedChartId]);

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
    walk(rootId, 0);
    return result;
  }, [childrenByParent, expandedById, rootId, rowsById]);

  const filteredTreeRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return treeRows;
    return treeRows.filter((item) => {
      const label = (item.row.label || item.row.title || '').toLowerCase();
      return item.row.id.toLowerCase().includes(q) || label.includes(q);
    });
  }, [treeRows, search]);

  const toggleExpand = async (row: BaseInfoRow) => {
    if (!row.has_children || !inScope(row.id)) return;
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
        setError(err instanceof Error ? err.message : 'Failed to load child nodes.');
      }
    }
  };

  const openEditModal = (row: BaseInfoRow) => {
    if (!inScope(row.id) && row.id !== rootId) return;
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
    setEditForm({
      ...EMPTY_EDIT_FORM,
      parentId: rootId,
    });
  };

  const openCreateChildModal = (row: BaseInfoRow) => {
    if (!inScope(row.id)) return;
    setEditingId(null);
    setIsCreateModalOpen(true);
    setSaveError(null);
    setEditForm({
      ...EMPTY_EDIT_FORM,
      parentId: row.id,
    });
  };

  const openCreateChildById = (nodeId: string) => {
    const row = rowsById[nodeId];
    if (!row) return;
    openCreateChildModal(row);
  };

  const closeModal = () => {
    setEditingId(null);
    setIsCreateModalOpen(false);
    setSaveError(null);
    setEditForm(EMPTY_EDIT_FORM);
  };

  const openDeleteModal = (row: BaseInfoRow) => {
    if (row.id === rootId || row.has_children || !inScope(row.id)) return;
    setDeleteTarget(row);
    setSaveError(null);
  };

  const closeDeleteModal = () => {
    if (isDeleting) return;
    setDeleteTarget(null);
  };

  const submitDelete = async () => {
    if (!deleteTarget || deleteTarget.id === rootId || !inScope(deleteTarget.id)) return;
    setIsDeleting(true);
    setSaveError(null);
    try {
      const deletedId = deleteTarget.id;
      const parentId = deleteTarget.parent_id || rootId;
      await deleteMutation.mutateAsync(deletedId);
      setDeleteTarget(null);
      if (selectedChartId === deletedId) setSelectedChartId(undefined);
      await loadChildren(parentId);
      setChartRevealId(parentId);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to delete node.');
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
    if (sourceId === rootId || !inScope(sourceId)) return;
    const effectiveTargetId = targetId ?? rootId;
    if (!inScope(effectiveTargetId) && effectiveTargetId !== rootId) return;
    const effectivePosition: TreeDropPosition = targetId ? position : 'inside';

    setIsMoving(true);
    setError(null);
    const nextExpandedById: Record<string, boolean> = { ...expandedById };
    if (effectivePosition === 'inside') {
      for (const nodeId of collectAncestorChain(effectiveTargetId)) {
        nextExpandedById[nodeId] = true;
      }
    } else {
      const parentId = rowsById[effectiveTargetId]?.parent_id || rootId;
      for (const nodeId of collectAncestorChain(parentId)) {
        nextExpandedById[nodeId] = true;
      }
    }

    try {
      await moveMutation.mutateAsync({
        id: sourceId,
        body: { targetId: effectiveTargetId, position: effectivePosition },
      });
      await load({ expandedById: nextExpandedById });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move node.');
    } finally {
      setIsMoving(false);
    }
  }, [collectAncestorChain, expandedById, inScope, load, moveMutation, rootId, rowsById]);

  const isKnownDescendant = useCallback((sourceId: string, candidateParentId: string) => {
    const stack = [...(childrenByParent[sourceId] || [])];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) continue;
      if (current === candidateParentId) return true;
      for (const child of childrenByParent[current] || []) stack.push(child);
    }
    return false;
  }, [childrenByParent]);

  const canDropNode = useCallback((sourceId: string, targetId: string | null, position: TreeDropPosition) => {
    if (sourceId === rootId || !inScope(sourceId)) return false;
    const effectiveTargetId = targetId ?? rootId;
    if (!inScope(effectiveTargetId) && effectiveTargetId !== rootId) return false;
    if (sourceId === effectiveTargetId) return false;
    if (isKnownDescendant(sourceId, effectiveTargetId)) return false;
    if (position === 'inside' || !targetId) return true;
    const effectiveParentId = rowsById[effectiveTargetId]?.parent_id || rootId;
    if (effectiveParentId === sourceId) return false;
    if (isKnownDescendant(sourceId, effectiveParentId)) return false;
    return true;
  }, [inScope, isKnownDescendant, rootId, rowsById]);

  useEffect(() => {
    const pendingLoads = Object.keys(expandedById).filter((id) => (
      expandedById[id]
      && !loadedParents[id]
      && Boolean(rowsById[id]?.has_children)
      && !loadingByParent[id]
      && inScope(id)
    ));
    for (const id of pendingLoads) {
      void loadChildren(id).catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load child nodes.');
      });
    }
  }, [expandedById, inScope, loadChildren, loadedParents, loadingByParent, rowsById]);

  const ensureChildrenLoaded = useCallback(async (parentId: string) => {
    if (!parentId || loadedParents[parentId] || loadingByParent[parentId]) return;
    try {
      await loadChildren(parentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load child nodes.');
    }
  }, [loadChildren, loadedParents, loadingByParent]);

  const collapseAll = useCallback(() => {
    setExpandedById({});
  }, []);

  const expandAll = useCallback(() => {
    setExpandedById((current) => {
      const next = { ...current };
      for (const row of Object.values(rowsById)) {
        if (row?.has_children && inScope(row.id)) {
          next[row.id] = true;
        }
      }
      return next;
    });
  }, [inScope, rowsById]);

  const ensureFullTreeLoaded = useCallback(async () => {
    const queue = [rootId];
    const seen = new Set<string>();
    while (queue.length > 0) {
      const parentId = queue.shift();
      if (!parentId || seen.has(parentId)) continue;
      seen.add(parentId);
      if (!loadedParents[parentId]) {
        await loadChildren(parentId);
      }
      for (const childId of childrenByParent[parentId] || []) {
        const row = rowsById[childId];
        if (row?.has_children) queue.push(childId);
      }
      // After loadChildren, childrenByParent may update async — re-read via another pass using latest state is hard.
      // Expand all and rely on effect; for chart we rebuild from whatever is loaded after expand.
    }
    expandAll();
  }, [childrenByParent, expandAll, loadChildren, loadedParents, rootId, rowsById]);

  const loadAllForChart = useCallback(async (options?: { quiet?: boolean }) => {
    const quiet = Boolean(options?.quiet);
    const visit = async (parentId: string) => {
      await loadChildren(parentId);
      // children set in state — need sync fetch for recursion
      const items = await fetchBaseInfoChildren({ lang: cultureId, root: '', parentId });
      const scoped = items.filter((item) => inScope(item.id));
      mergeRows(scoped);
      setChildrenByParent((prev) => ({
        ...prev,
        [parentId]: scoped.map((item) => item.id),
      }));
      setLoadedParents((prev) => ({ ...prev, [parentId]: true }));
      setExpandedById((prev) => {
        const next = { ...prev };
        for (const item of scoped) {
          if (item.has_children) next[item.id] = true;
        }
        return next;
      });
      for (const item of scoped) {
        if (item.has_children) {
          await visit(item.id);
        }
      }
    };
    if (!quiet) setIsLoading(true);
    try {
      // Drop stale ids (moves rename hierarchical keys) so the chart cannot drag ghosts.
      setChildrenByParent({});
      setLoadedParents({});
      setExpandedById({ [rootId]: true });
      setRowsById((prev) => {
        const rootRow = prev[rootId];
        return rootRow ? { [rootId]: rootRow } : {};
      });

      const rootItems = await fetchBaseInfoChildren({ lang: cultureId, root: rootId, parentId: null });
      const rootRow = rootItems.find((item) => item.id === rootId) ?? null;
      if (rootRow) {
        mergeRows([rootRow]);
        setRootLabel(rootRow.label || rootRow.title_en || rootRow.title || rootTitleFallback);
      }

      await visit(rootId);
    } finally {
      if (!quiet) setIsLoading(false);
    }
  }, [cultureId, inScope, loadChildren, mergeRows, rootId, rootTitleFallback]);

  /** Chart DnD move — API then quiet reload (move may rename hierarchical ids). */
  const moveChartNode = useCallback(async (
    sourceId: string,
    targetId: string,
    position: TreeDropPosition = 'inside',
  ) => {
    const source = String(sourceId || '').trim();
    const target = String(targetId || '').trim();
    if (!source || !target) {
      setError('Move failed: missing source or target.');
      return;
    }
    if (!canDropNode(source, target, position)) {
      setError('That drop target is not allowed.');
      return;
    }

    setIsMoving(true);
    setError(null);
    try {
      await moveMutation.mutateAsync({
        id: source,
        body: { targetId: target, position },
      });
      if (selectedChartId === source) {
        setSelectedChartId(undefined);
      }
      await load({ quiet: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to move node.';
      setError(`${message} (${source} → ${target})`);
    } finally {
      setIsMoving(false);
    }
  }, [canDropNode, load, moveMutation, selectedChartId]);

  const treeGridRows = useMemo<BaseInfoTreeRow[]>(() => (
    filteredTreeRows.map(({ row, depth }) => ({
      id: row.id,
      parentId: row.parent_id,
      depth,
      hasChildren: Boolean(row.has_children),
      row,
    }))
  ), [filteredTreeRows]);

  const chartTreeData = useMemo(
    () => toDesignerNodes(
      rootId,
      childrenByParent,
      rowsById,
      resolveNodeTypeLabel,
      resolveNodeAccentColor,
    ),
    [childrenByParent, resolveNodeAccentColor, resolveNodeTypeLabel, rootId, rowsById],
  );

  const selectedChartRow = selectedChartId ? rowsById[selectedChartId] ?? null : null;

  const submitEdit = async () => {
    if (!editingId || (!inScope(editingId) && editingId !== rootId)) return;
    if (!editForm.title.trim() && !editForm.titleEn.trim() && !editForm.titleFa.trim() && !editForm.titleAr.trim()) {
      setSaveError('At least one title is required.');
      return;
    }
    const parentId = editingId === rootId
      ? ''
      : (editForm.parentId.trim() || rootId);
    if (editingId !== rootId && !inScope(parentId) && parentId !== rootId) {
      setSaveError('Parent must stay inside this tree.');
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const payload = buildBaseInfoSavePayload({
        ...editForm,
        parentId,
      });
      // Root stays top-level — never send parentId for it.
      if (editingId === rootId) {
        delete (payload as { parentId?: string }).parentId;
      }
      await updateMutation.mutateAsync({ id: editingId, body: payload });
      await load({ quiet: true });
      closeModal();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Network error while saving changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const quickUpdateSelected = async (patch: {
    titleEn?: string;
    uiHtml?: string;
    uiColor?: string;
    isActive?: boolean;
  }) => {
    const row = selectedChartId ? rowsById[selectedChartId] : null;
    if (!row || (!inScope(row.id) && row.id !== rootId)) return;
    const nextTitleEn = (patch.titleEn ?? row.title_en ?? row.title ?? '').trim();
    if (!nextTitleEn) {
      setError('Title is required.');
      return;
    }
    const nextUiHtml = patch.uiHtml !== undefined ? patch.uiHtml : (row.ui_html ?? null);
    const nextUiColor = patch.uiColor !== undefined
      ? (patch.uiColor.trim() || null)
      : (row.ui_color ?? null);
    const nextIsActive = patch.isActive !== undefined ? patch.isActive : Boolean(row.is_active);

    setIsSaving(true);
    setError(null);
    try {
      await updateMutation.mutateAsync({
        id: row.id,
        body: {
          title: nextTitleEn,
          titleEn: nextTitleEn,
          titleFa: row.title_fa ?? undefined,
          titleAr: row.title_ar ?? undefined,
          shortName: row.short_name ?? undefined,
          metadata: row.metadata ?? undefined,
          uiHtml: nextUiHtml ?? undefined,
          uiColor: nextUiColor ?? undefined,
          isActive: nextIsActive,
        },
      });
      // Patch only this node in memory — avoid full chart reload (viewport jump).
      setRowsById((prev) => {
        const current = prev[row.id];
        if (!current) return prev;
        return {
          ...prev,
          [row.id]: {
            ...current,
            label: nextTitleEn,
            title: nextTitleEn,
            title_en: nextTitleEn,
            ui_html: nextUiHtml,
            ui_color: nextUiColor,
            is_active: nextIsActive,
          },
        };
      });
      if (row.id === rootId) {
        setRootLabel(nextTitleEn);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const saveRootChartConfig = async (chart: OrgChartRootConfig): Promise<boolean> => {
    const row = rowsById[rootId];
    if (!row) {
      setError('Root node is not loaded yet.');
      return false;
    }
    const nextMetadata = writeOrgChartRootConfigToMetadata(row.metadata, chart);
    setIsSaving(true);
    setError(null);
    try {
      await updateMutation.mutateAsync({
        id: rootId,
        body: {
          title: row.title_en || row.title || rootLabel,
          titleEn: row.title_en || row.title || rootLabel,
          titleFa: row.title_fa ?? undefined,
          titleAr: row.title_ar ?? undefined,
          shortName: row.short_name ?? undefined,
          metadata: nextMetadata,
          uiHtml: row.ui_html ?? undefined,
          uiColor: row.ui_color ?? undefined,
          isActive: row.is_active !== false,
        },
      });
      setRowsById((prev) => {
        const current = prev[rootId];
        if (!current) return prev;
        return {
          ...prev,
          [rootId]: {
            ...current,
            metadata: nextMetadata,
          },
        };
      });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save chart settings.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const submitCreate = async () => {
    if (!editForm.title.trim() && !editForm.titleEn.trim() && !editForm.titleFa.trim() && !editForm.titleAr.trim()) {
      setSaveError('At least one title is required.');
      return;
    }
    const parentId = editForm.parentId.trim() || rootId;
    if (!inScope(parentId) && parentId !== rootId) {
      setSaveError('Parent must stay inside this tree.');
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      await createMutation.mutateAsync(buildBaseInfoCreatePayload({
        ...editForm,
        parentId,
      }));
      await loadChildren(parentId);
      setChartRevealId(parentId);
      closeModal();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Network error while saving changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const clearChartRevealId = useCallback(() => {
    setChartRevealId(null);
  }, []);

  const rootCount = (childrenByParent[rootId] || []).length;

  const parentDisplayValue = useMemo(() => {
    const parentId = editForm.parentId.trim() || rootId;
    if (parentId === rootId) {
      return `${rootId} - ${rootLabel}`;
    }
    const parentRow = rowsById[parentId];
    const parentLabel = parentRow?.label || parentRow?.title || parentRow?.title_en;
    return parentLabel ? `${parentId} - ${parentLabel}` : parentId;
  }, [editForm.parentId, rootId, rootLabel, rowsById]);

  const { listToolbarCollapsed, handleGridScroll: handleTreeScroll } = useListPageToolbarScroll();

  return {
    rootId,
    rootLabel,
    search,
    setSearch,
    load,
    loadAllForChart,
    ensureFullTreeLoaded,
    ensureChildrenLoaded,
    chartRevealId,
    clearChartRevealId,
    openCreateModal,
    openCreateChildModal,
    openCreateChildById,
    isLoading,
    error,
    filteredTreeRows,
    treeGridRows,
    chartTreeData,
    expandedById,
    loadingByParent: {
      ...loadingByParent,
      [ROOT_KEY]: loadingByParent[rootId],
    },
    isMoving,
    isSaving,
    isDeleting,
    editingId,
    isCreateModalOpen,
    isModalOpen: Boolean(editingId || isCreateModalOpen),
    deleteTarget,
    toggleExpand,
    moveNode,
    moveChartNode,
    canDropNode,
    openEditModal,
    openDeleteModal,
    closeDeleteModal,
    submitDelete,
    closeModal,
    editForm,
    setEditForm,
    saveError,
    isCreateMode: isCreateModalOpen,
    parentDisplayValue,
    submitCreate,
    submitEdit,
    expandAll,
    collapseAll,
    selectedChartId,
    setSelectedChartId,
    selectedChartRow,
    rootUiHtml: rowsById[rootId]?.ui_html ?? null,
    rootUiColor: rowsById[rootId]?.ui_color ?? null,
    rootIsActive: rowsById[rootId]?.is_active !== false,
    rootMetadata: rowsById[rootId]?.metadata ?? null,
    rootChartConfig: readOrgChartRootConfig(rowsById[rootId]?.metadata),
    rootCount,
    totalLoaded: Object.keys(rowsById).filter((id) => id !== rootId).length,
    quickUpdateSelected,
    saveRootChartConfig,
    handleTreeScroll,
  };
}

export type ScopedBaseInfoTreeModel = ReturnType<typeof useScopedBaseInfoTree>;
