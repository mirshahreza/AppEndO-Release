import { useCallback, useMemo, useState } from "react";

import { useQueryClient } from "@tanstack/react-query";

import { formatApiErrorMessage, isApiError } from "../../../shared/api/client";

import type { NavigationManifest } from "../../../shared/api/contracts/platform/navigation";

import { isBuiltInNavigationId } from "../../../shared/api/contracts/platform/navigation";

import {
  DEFAULT_GRID_PAGE_SIZE,
} from "../../../shared/lib/gridPagingConstants";

import { applyClientGridQuery } from "../../../shared/lib/appTableGridQuery";

import { APP_LIST_PREFERENCE_KEYS } from "../../../shared/lib/listPreferenceKeys";

import { BUILTIN_FILTER_ALL, matchesBuiltInFilter, migrateLegacyBuiltInFilter } from "../../../shared/lib/builtInFilter";

import { useGridListPresentation } from "../../../shared/lib/useGridListPresentation";

import { useListPagePresentationScroll } from "../../../shared/lib/useListPagePresentationScroll";

import { useGridQueryState } from "../../../shared/lib/useGridQueryState";

import {
  usePersistedListFilters,
  usePersistedListPaging,
} from "../../../shared/lib/usePersistedListPreferences";

import {
  createNavigationManifestRecord,
  deleteNavigationManifestRecord,
  platformQueryKeys,
  updateNavigationManifestRecord,
  useNavigationManifestQuery,
  useNavigationManifestsQuery,
} from "../../../shared/api/queries/platform";

import { useComponentDesignerDraftsQuery } from "../../../shared/api/queries/component-designer";

import { NAVIGATION_SORT_FIELDS } from "../constants";

import { useCultureT } from "../../../core/culture/CultureContext";
import { createNavigationsGridColumns } from "../navigationsGridColumns";

import {
  addNavigationGroup,
  addNavigationItem,
  addNavigationItemAtSelection,
  navigationManifestToTreeRows,
  removeNavigationGroup,
  removeNavigationItemAtPath,
  type NavigationTreeSelection,
  updateNavigationGroupCollapsedLabel,
  updateNavigationGroupHeading,
  updateNavigationItemAtPath,
} from "../lib/navigationTreeRows";

import {
  canMoveNavigationNode,
  canMoveNavigationNodeStep,
  moveNavigationNode,
  moveNavigationNodeStep,
  selectionIdFromRows,
} from "../lib/navigationTreeMove";

import type { TreeDropPosition } from "../../../shared/types/tree";

import {
  parseNavigationManifestJson,
  serializeNavigationManifest,
} from "../lib/navigationManifestJson";

import { normalizeNavigationManifestPageKeys } from "../lib/navigationManifestPageKeys";

export type NavigationEditorMode = "tree" | "json";

export type PlatformNavigationsPageModel = ReturnType<
  typeof usePlatformNavigationsPage
>;

export function usePlatformNavigationsPage() {
  const t = useCultureT();
  const queryClient = useQueryClient();

  const listQuery = useNavigationManifestsQuery();

  const [formError, setFormError] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);

  const { pageSize, setPageSize, listMode, setListMode } = usePersistedListPaging({
    listKey: APP_LIST_PREFERENCE_KEYS.platformNavigations,
    defaultPageSize: DEFAULT_GRID_PAGE_SIZE,
  });

  const [navFilters, setNavFilters] = usePersistedListFilters({
    listKey: APP_LIST_PREFERENCE_KEYS.platformNavigations,
    defaultFilters: { builtInFilter: BUILTIN_FILTER_ALL },
    sanitize: (raw) => {
      if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
      const record = raw as Record<string, unknown>;
      return {
        builtInFilter: migrateLegacyBuiltInFilter(record),
      };
    },
  });

  const builtInFilter = navFilters.builtInFilter;

  const setBuiltInFilter = useCallback((next: string) => {
    setNavFilters({ builtInFilter: next });
  }, [setNavFilters]);

  const [editorId, setEditorId] = useState<string | null>(null);

  const [draft, setDraft] = useState<NavigationManifest | null>(null);

  const [selection, setSelection] = useState<NavigationTreeSelection | null>(
    null,
  );

  const [createModalOpen, setCreateModalOpen] = useState(false);

  const [createIdInput, setCreateIdInput] = useState("");

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const [editorMode, setEditorModeState] = useState<NavigationEditorMode>("tree");

  const [jsonText, setJsonText] = useState("");

  const [jsonError, setJsonError] = useState<string | null>(null);

  const detailQuery = useNavigationManifestQuery(editorId, Boolean(editorId));

  const designerDraftsQuery = useComponentDesignerDraftsQuery({
    enabled: Boolean(editorId),
  });

  const items = listQuery.data ?? [];

  const openEditor = useCallback((id: string) => {
    setFormError(null);

    setSelection(null);

    setEditorId(id);

    setDraft(null);

    setEditorModeState("tree");

    setJsonText("");

    setJsonError(null);
  }, []);

  const gridColumns = useMemo(
    () =>
      createNavigationsGridColumns({
        onEdit: (row) => openEditor(row.id),

        onDelete: (row) => setDeleteTargetId(row.id),
      }, t),

    [openEditor, t],
  );

  const {
    query,

    handleGridQueryChange,

    setFooterSort,

    getFooterSort,

    getFooterSortBy,
  } = useGridQueryState({
    columns: gridColumns,

    gridQueryMode: "client",

    persistListKey: APP_LIST_PREFERENCE_KEYS.platformNavigations,

    initialQuery: {
      sort: { columnId: "id", direction: "asc" },

      filters: {},
    },
  });

  const filteredItems = useMemo(() => {
    return items.filter((item) => matchesBuiltInFilter(Boolean(item.builtIn), builtInFilter));
  }, [builtInFilter, items]);

  const sortedItems = useMemo(
    () => applyClientGridQuery(filteredItems, query, gridColumns, "client"),

    [filteredItems, gridColumns, query],
  );

  const presentation = useGridListPresentation({
    items: sortedItems,

    pageSize,

    listMode,

    resetKeys: [builtInFilter, query, items.length],
  });
  const onGridScroll = useListPagePresentationScroll(presentation);

    const footerSort = getFooterSort(NAVIGATION_SORT_FIELDS);

  const sortBy = getFooterSortBy(NAVIGATION_SORT_FIELDS, "id");

  const sortDirection = footerSort.sortDirection;

  const isEditorBuiltIn = editorId ? isBuiltInNavigationId(editorId) : false;

  const isEditorReadOnly = false;

  const invalidateAfterMutation = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: platformQueryKeys.navigations(),
    });

    await queryClient.invalidateQueries({
      queryKey: platformQueryKeys.runtimeConfig(),
    });

    if (editorId) {
      await queryClient.invalidateQueries({
        queryKey: platformQueryKeys.navigation(editorId),
      });
    }

    await listQuery.refetch();
  }, [editorId, listQuery, queryClient]);

  const closeEditor = useCallback(() => {
    setEditorId(null);

    setDraft(null);

    setSelection(null);

    setFormError(null);

    setEditorModeState("tree");

    setJsonText("");

    setJsonError(null);
  }, []);

  const workingManifest = useMemo(() => {
    let manifest: NavigationManifest | null = null;

    if (draft) {
      manifest = draft;
    } else if (detailQuery.data) {
      const {
        builtIn: _builtIn,
        groupCount: _groupCount,
        itemCount: _itemCount,
        ...loaded
      } = detailQuery.data;

      manifest = loaded;
    }

    if (!manifest) {
      return null;
    }

    return normalizeNavigationManifestPageKeys(
      manifest,
      designerDraftsQuery.data ?? [],
    );
  }, [detailQuery.data, designerDraftsQuery.data, draft]);

  const setWorkingManifest = useCallback((next: NavigationManifest) => {
    setDraft(next);
  }, []);

  const setEditorMode = useCallback(
    (mode: NavigationEditorMode) => {
      if (mode === editorMode) {
        return;
      }

      if (mode === "json") {
        if (workingManifest) {
          setJsonText(serializeNavigationManifest(workingManifest));
          setJsonError(null);
        }

        setEditorModeState("json");
        return;
      }

      const result = parseNavigationManifestJson(jsonText, editorId);
      if (!result.ok) {
        setJsonError(result.error);
        return;
      }

      setWorkingManifest(result.manifest);
      setJsonError(null);
      setEditorModeState("tree");
    },
    [editorId, editorMode, jsonText, setWorkingManifest, workingManifest],
  );

  const handleJsonTextChange = useCallback(
    (value: string | undefined) => {
      const next = value ?? "";
      setJsonText(next);

      const result = parseNavigationManifestJson(next, editorId);
      if (!result.ok) {
        setJsonError(result.error);
        return;
      }

      setJsonError(null);
      setWorkingManifest(result.manifest);
    },
    [editorId, setWorkingManifest],
  );

  const saveEditor = useCallback(async () => {
    if (!editorId || !workingManifest || isEditorReadOnly) {
      return;
    }

    let manifestToSave = workingManifest;

    if (editorMode === "json") {
      const result = parseNavigationManifestJson(jsonText, editorId);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }

      manifestToSave = result.manifest;
      setWorkingManifest(result.manifest);
    }

    setFormError(null);

    setIsSaving(true);

    try {
      await updateNavigationManifestRecord(editorId, manifestToSave);

      setDraft(null);

      await invalidateAfterMutation();

      await detailQuery.refetch();
    } catch (caught) {
      setFormError(
        isApiError(caught)
          ? formatApiErrorMessage(caught)
          : "Failed to save navigation manifest.",
      );

      throw caught;
    } finally {
      setIsSaving(false);
    }
  }, [
    detailQuery,
    editorId,
    editorMode,
    invalidateAfterMutation,
    isEditorReadOnly,
    jsonText,
    setWorkingManifest,
    workingManifest,
  ]);

  const createManifest = useCallback(async () => {
    const id = createIdInput.trim();

    if (!id) {
      setFormError("Navigation id is required.");

      return;
    }

    setFormError(null);

    setIsSaving(true);

    try {
      const manifest: NavigationManifest = {
        id,

        version: "1",

        groups: [],
      };

      await createNavigationManifestRecord(manifest);

      setCreateModalOpen(false);

      setCreateIdInput("");

      await invalidateAfterMutation();

      openEditor(id);
    } catch (caught) {
      setFormError(
        isApiError(caught)
          ? formatApiErrorMessage(caught)
          : "Failed to create navigation manifest.",
      );

      throw caught;
    } finally {
      setIsSaving(false);
    }
  }, [createIdInput, invalidateAfterMutation, openEditor]);

  const removeManifest = useCallback(
    async (id: string) => {
      setFormError(null);

      setIsSaving(true);

      try {
        await deleteNavigationManifestRecord(id);

        if (editorId === id) {
          closeEditor();
        }

        setDeleteTargetId(null);

        await invalidateAfterMutation();
      } catch (caught) {
        setFormError(
          isApiError(caught)
            ? formatApiErrorMessage(caught)
            : "Failed to delete navigation manifest.",
        );

        throw caught;
      } finally {
        setIsSaving(false);
      }
    },
    [closeEditor, editorId, invalidateAfterMutation],
  );

  const updateDraftItem = useCallback(
    (
      groupIndex: number,

      itemPath: number[],

      patch: Partial<NavigationManifest["groups"][number]["items"][number]>,
    ) => {
      if (!workingManifest || isEditorReadOnly) {
        return;
      }

      setWorkingManifest(
        updateNavigationItemAtPath(
          workingManifest,
          groupIndex,
          itemPath,
          (item) => ({
            ...item,

            ...patch,
          }),
        ),
      );
    },
    [isEditorReadOnly, setWorkingManifest, workingManifest],
  );

  const treeRows = useMemo(
    () => (workingManifest ? navigationManifestToTreeRows(workingManifest) : []),
    [workingManifest],
  );

  const selectedTreeNodeId = useMemo(() => {
    if (!selection) {
      return null;
    }
    return selectionIdFromRows(treeRows, selection);
  }, [selection, treeRows]);

  const canMoveTreeNode = useCallback(
    (sourceId: string, targetId: string | null, position: TreeDropPosition) => (
      canMoveNavigationNode(treeRows, sourceId, targetId, position)
    ),
    [treeRows],
  );

  const moveTreeNode = useCallback(
    async (sourceId: string, targetId: string | null, position: TreeDropPosition) => {
      if (!workingManifest || isEditorReadOnly || !targetId) {
        return;
      }

      const { manifest, selection: nextSelection } = moveNavigationNode(
        workingManifest,
        sourceId,
        targetId,
        position,
      );

      if (manifest === workingManifest) {
        return;
      }

      setWorkingManifest(manifest);
      if (nextSelection) {
        setSelection(nextSelection);
      }
    },
    [isEditorReadOnly, setWorkingManifest, workingManifest],
  );

  const canMoveTreeNodeStep = useCallback(
    (direction: "up" | "down") => {
      if (!selectedTreeNodeId) {
        return false;
      }
      return canMoveNavigationNodeStep(treeRows, selectedTreeNodeId, direction);
    },
    [selectedTreeNodeId, treeRows],
  );

  const moveTreeNodeStep = useCallback(
    (direction: "up" | "down") => {
      if (!workingManifest || isEditorReadOnly || !selectedTreeNodeId) {
        return;
      }

      const { manifest, selection: nextSelection } = moveNavigationNodeStep(
        workingManifest,
        selectedTreeNodeId,
        direction,
      );

      if (manifest === workingManifest) {
        return;
      }

      setWorkingManifest(manifest);
      if (nextSelection) {
        setSelection(nextSelection);
      }
    },
    [isEditorReadOnly, selectedTreeNodeId, setWorkingManifest, workingManifest],
  );

  const editorActions = useMemo(
    () => ({
      addGroup: () => {
        if (!workingManifest || isEditorReadOnly) return;

        setWorkingManifest(addNavigationGroup(workingManifest, "New group"));
      },

      addItem: (groupIndex: number, parentItemPath: number[] = []) => {
        if (!workingManifest || isEditorReadOnly) return;

        setWorkingManifest(
          addNavigationItem(workingManifest, groupIndex, parentItemPath),
        );
      },

      addItemAtSelection: () => {
        if (!workingManifest || isEditorReadOnly) return;

        setWorkingManifest(addNavigationItemAtSelection(workingManifest, selection));
      },

      removeGroup: (groupIndex: number) => {
        if (!workingManifest || isEditorReadOnly) return;

        setWorkingManifest(removeNavigationGroup(workingManifest, groupIndex));

        setSelection(null);
      },

      removeItem: (groupIndex: number, itemPath: number[]) => {
        if (!workingManifest || isEditorReadOnly) return;

        setWorkingManifest(
          removeNavigationItemAtPath(workingManifest, groupIndex, itemPath),
        );

        setSelection(null);
      },

      updateGroupHeading: (groupIndex: number, heading: string | null) => {
        if (!workingManifest || isEditorReadOnly) return;

        setWorkingManifest(
          updateNavigationGroupHeading(workingManifest, groupIndex, heading),
        );
      },

      updateGroupCollapsedLabel: (groupIndex: number, collapsedLabel: string | null) => {
        if (!workingManifest || isEditorReadOnly) return;

        setWorkingManifest(
          updateNavigationGroupCollapsedLabel(workingManifest, groupIndex, collapsedLabel),
        );
      },

      resetDraft: () => {
        setDraft(null);
        setJsonError(null);

        if (editorMode === "json" && detailQuery.data) {
          const {
            builtIn: _b,
            groupCount: _g,
            itemCount: _i,
            ...manifest
          } = detailQuery.data;

          setJsonText(serializeNavigationManifest(manifest));
        }
      },

      discardDraft: () => setDraft(null),
    }),
    [detailQuery.data, editorMode, isEditorReadOnly, selection, setWorkingManifest, workingManifest],
  );

  const isEditorDirty = draft != null;

  const canSaveEditor = isEditorDirty && !jsonError && !isSaving;

  return {
    listQuery,

    detailQuery,

    formError,

    setFormError,

    isSaving,

    pageSize,

    setPageSize,

    listMode,

    setListMode,

    builtInFilter,

    setBuiltInFilter,

    gridColumns,

    query,

    handleGridQueryChange,

    presentation,

    onGridScroll,

    displayItems: sortedItems,

    orderedItemsCount: sortedItems.length,

    sortBy,

    sortDirection,

    setFooterSort,

    editorId,

    workingManifest,

    setWorkingManifest,

    isEditorReadOnly,

    isEditorBuiltIn,

    isEditorDirty,

    canSaveEditor,

    editorMode,

    setEditorMode,

    jsonText,

    jsonError,

    handleJsonTextChange,

    selection,

    setSelection,

    openEditor,

    closeEditor,

    saveEditor,

    createManifest,

    removeManifest,

    createModalOpen,

    setCreateModalOpen,

    createIdInput,

    setCreateIdInput,

    deleteTargetId,

    setDeleteTargetId,

    updateDraftItem,

    editorActions,

    canMoveTreeNode,

    moveTreeNode,

    canMoveTreeNodeStep,

    moveTreeNodeStep,

    retryLoad: () => {
      void listQuery.refetch();
    },
  };
}
