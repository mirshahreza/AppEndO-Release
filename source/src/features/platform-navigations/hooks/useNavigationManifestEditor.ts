import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { formatApiErrorMessage, isApiError } from '../../../shared/api/client';
import type { NavigationManifest } from '../../../shared/api/contracts/platform/navigation';
import { isBuiltInNavigationId } from '../../../shared/api/contracts/platform/navigation';
import { useComponentDesignerDraftsQuery } from '../../../shared/api/queries/component-designer';
import {
  platformQueryKeys,
  updateNavigationManifestRecord,
  useNavigationManifestQuery,
} from '../../../shared/api/queries/platform';
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
} from '../lib/navigationTreeRows';
import {
  parseNavigationManifestJson,
  serializeNavigationManifest,
} from '../lib/navigationManifestJson';
import { normalizeNavigationManifestPageKeys } from '../lib/navigationManifestPageKeys';
import {
  canMoveNavigationNode,
  canMoveNavigationNodeStep,
  moveNavigationNode,
  moveNavigationNodeStep,
  selectionIdFromRows,
} from '../lib/navigationTreeMove';
import type { TreeDropPosition } from '../../../shared/types/tree';

export type NavigationEditorMode = 'tree' | 'json';

export type NavigationManifestEditorModel = ReturnType<typeof useNavigationManifestEditor>;

export function useNavigationManifestEditor(editorId: string | null) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState<NavigationManifest | null>(null);
  const [selection, setSelection] = useState<NavigationTreeSelection | null>(null);
  const [editorMode, setEditorModeState] = useState<NavigationEditorMode>('tree');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  const detailQuery = useNavigationManifestQuery(editorId, Boolean(editorId));
  const designerDraftsQuery = useComponentDesignerDraftsQuery({
    enabled: Boolean(editorId),
  });

  const isEditorBuiltIn = editorId ? isBuiltInNavigationId(editorId) : false;
  const isEditorReadOnly = false;

  const invalidateAfterMutation = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: platformQueryKeys.navigations() });
    await queryClient.invalidateQueries({ queryKey: platformQueryKeys.runtimeConfig() });
    if (editorId) {
      await queryClient.invalidateQueries({
        queryKey: platformQueryKeys.navigation(editorId),
      });
    }
    if (editorId) {
      await detailQuery.refetch();
    }
  }, [detailQuery, editorId, queryClient]);

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

  const resetEditorState = useCallback(() => {
    setDraft(null);
    setSelection(null);
    setFormError(null);
    setEditorModeState('tree');
    setJsonText('');
    setJsonError(null);
  }, []);

  const initDraft = useCallback((manifest: NavigationManifest) => {
    setDraft(manifest);
    setSelection(null);
    setFormError(null);
    setJsonError(null);
  }, []);

  const setEditorMode = useCallback(
    (mode: NavigationEditorMode) => {
      if (mode === editorMode) {
        return;
      }

      if (mode === 'json') {
        if (workingManifest) {
          setJsonText(serializeNavigationManifest(workingManifest));
          setJsonError(null);
        }
        setEditorModeState('json');
        return;
      }

      const result = parseNavigationManifestJson(jsonText, editorId);
      if (!result.ok) {
        setJsonError(result.error);
        return;
      }

      setWorkingManifest(result.manifest);
      setJsonError(null);
      setEditorModeState('tree');
    },
    [editorId, editorMode, jsonText, setWorkingManifest, workingManifest],
  );

  const handleJsonTextChange = useCallback(
    (value: string | undefined) => {
      const next = value ?? '';
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

    if (editorMode === 'json') {
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
    } catch (caught) {
      setFormError(
        isApiError(caught)
          ? formatApiErrorMessage(caught)
          : 'Failed to save navigation manifest.',
      );
      throw caught;
    } finally {
      setIsSaving(false);
    }
  }, [
    editorId,
    editorMode,
    invalidateAfterMutation,
    isEditorReadOnly,
    jsonText,
    setWorkingManifest,
    workingManifest,
  ]);

  const updateDraftItem = useCallback(
    (
      groupIndex: number,
      itemPath: number[],
      patch: Partial<NavigationManifest['groups'][number]['items'][number]>,
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
    (direction: 'up' | 'down') => {
      if (!selectedTreeNodeId) {
        return false;
      }
      return canMoveNavigationNodeStep(treeRows, selectedTreeNodeId, direction);
    },
    [selectedTreeNodeId, treeRows],
  );

  const moveTreeNodeStep = useCallback(
    (direction: 'up' | 'down') => {
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
        setWorkingManifest(addNavigationGroup(workingManifest, 'New group'));
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
        if (editorMode === 'json' && detailQuery.data) {
          const {
            builtIn: _b,
            groupCount: _g,
            itemCount: _i,
            ...manifest
          } = detailQuery.data;
          setJsonText(serializeNavigationManifest(manifest));
        }
      },
    }),
    [detailQuery.data, editorMode, isEditorReadOnly, selection, setWorkingManifest, workingManifest],
  );

  const isEditorDirty = draft != null;
  const canSaveEditor = isEditorDirty && !jsonError && !isSaving;

  return {
    editorId,
    detailQuery,
    formError,
    setFormError,
    isSaving,
    workingManifest,
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
    saveEditor,
    updateDraftItem,
    editorActions,
    resetEditorState,
    initDraft,
    canMoveTreeNode,
    moveTreeNode,
    canMoveTreeNodeStep,
    moveTreeNodeStep,
  };
}
