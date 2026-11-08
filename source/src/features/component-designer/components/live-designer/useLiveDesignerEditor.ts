import * as React from 'react';
import {
  canInsertPaletteItemWithAutoWrap,
  canMoveNodeToParent,
  getPaletteItemById,
  isContainerNode,
} from '../../../../domain/component-designer/catalog';
import { collectDesignerSelectAllNodeIds } from '../../../../domain/component-designer/selectAllNodes';
import {
  createInitialDesignerState,
  designerReducer,
} from '../../../../domain/component-designer/state';
import type {
  DesignerAction,
  DesignerBindingDefinitions,
  DesignerDocument,
  DesignerNode,
  DesignerState,
  DesignerViewport,
} from '../../../../domain/component-designer/types';
import {
  copyLiveDesignerSubtree,
  getLiveDesignerClipboard,
  readLiveDesignerClipboard,
  type LiveDesignerClipboardPayload,
} from './liveDesignerClipboard';

export type LiveDesignerEditorApi = {
  ready: boolean;
  /** Full designer reducer state — used by code sync (`useDesignerCode`). */
  state: DesignerState;
  document: DesignerDocument | null;
  bindingDefinitions: DesignerBindingDefinitions;
  selectedNodeId: string | null;
  selectedNodeIds: string[];
  hoveredNodeId: string | null;
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canDeleteSelected: boolean;
  canDuplicateSelected: boolean;
  canCopySelected: boolean;
  hasClipboard: boolean;
  documentRevision: string;
  dispatch: React.Dispatch<DesignerAction>;
  hydrate: (
    document: DesignerDocument,
    bindingDefinitions: DesignerBindingDefinitions,
    viewport?: DesignerViewport,
  ) => void;
  selectNode: (nodeId: string | null) => void;
  selectAllNodes: () => void;
  hoverNode: (nodeId: string | null) => void;
  removeNode: (nodeId: string) => boolean;
  removeNodes: (nodeIds: string[]) => boolean;
  duplicateNode: (nodeId?: string | null) => boolean;
  copyNode: (nodeId?: string | null) => boolean;
  pasteNode: () => Promise<boolean>;
  moveNode: (nodeId: string, targetParentId: string, index?: number) => boolean;
  insertPaletteItem: (itemId: string, parentNodeId?: string | null, index?: number) => boolean;
  setNodeProp: (nodeId: string, key: string, value: unknown) => void;
  applyDocument: (
    document: DesignerDocument,
    bindingDefinitions: DesignerBindingDefinitions,
  ) => void;
  undo: () => void;
  redo: () => void;
  markSaved: (document: DesignerDocument, bindingDefinitions: DesignerBindingDefinitions) => void;
  resolveInsertParentId: (preferredParentId?: string | null) => string | null;
};

function resolveInsertParentIdFromState(
  state: DesignerState,
  preferredParentId?: string | null,
): string {
  const preferred = preferredParentId?.trim() || state.selectedNodeId;
  if (preferred) {
    const node = state.document.nodes[preferred];
    if (node) {
      if (isContainerNode(node) || node.id === state.document.rootNodeId) {
        return node.id;
      }
      if (node.parentId && state.document.nodes[node.parentId]) {
        return node.parentId;
      }
    }
  }
  return state.document.rootNodeId;
}

function resolvePasteTarget(
  state: DesignerState,
  sourceRoot: DesignerNode,
): { parentId: string; index: number } | null {
  const selectedId = state.selectedNodeId;
  if (selectedId) {
    const selected = state.document.nodes[selectedId];
    if (selected) {
      if (
        (isContainerNode(selected) || selected.id === state.document.rootNodeId)
        && canMoveNodeToParent(sourceRoot, selected)
      ) {
        return { parentId: selected.id, index: selected.children.length };
      }

      if (selected.parentId) {
        const parent = state.document.nodes[selected.parentId];
        if (parent && canMoveNodeToParent(sourceRoot, parent)) {
          const siblingIndex = parent.children.indexOf(selected.id);
          return {
            parentId: parent.id,
            index: siblingIndex >= 0 ? siblingIndex + 1 : parent.children.length,
          };
        }
      }
    }
  }

  const root = state.document.nodes[state.document.rootNodeId];
  if (!root || !canMoveNodeToParent(sourceRoot, root)) {
    return null;
  }
  return { parentId: root.id, index: root.children.length };
}

export function useLiveDesignerEditor(): LiveDesignerEditorApi {
  const [state, dispatch] = React.useReducer(
    designerReducer,
    undefined,
    () => createInitialDesignerState('live-designer'),
  );
  const [hydrated, setHydrated] = React.useState(false);
  const [clipboardRevision, setClipboardRevision] = React.useState(0);
  const selectedNodeIdRef = React.useRef<string | null>(state.selectedNodeId);
  selectedNodeIdRef.current = state.selectedNodeId;
  const stateRef = React.useRef(state);
  stateRef.current = state;
  const hydratedRef = React.useRef(hydrated);
  hydratedRef.current = hydrated;

  const hydrate = React.useCallback((
    document: DesignerDocument,
    bindingDefinitions: DesignerBindingDefinitions,
    viewport?: DesignerViewport,
  ) => {
    dispatch({
      type: 'hydrate-document',
      document,
      bindingDefinitions,
      preferredSelectedNodeId: null,
      viewport,
    });
    setHydrated(true);
  }, []);

  const markSaved = React.useCallback((
    document: DesignerDocument,
    bindingDefinitions: DesignerBindingDefinitions,
  ) => {
    dispatch({
      type: 'hydrate-document',
      document,
      bindingDefinitions,
      preferredSelectedNodeId: selectedNodeIdRef.current,
    });
  }, []);

  const selectNode = React.useCallback((nodeId: string | null) => {
    dispatch({ type: 'select-node', nodeId });
  }, []);

  const selectAllNodes = React.useCallback(() => {
    if (!hydratedRef.current) {
      return;
    }
    dispatch({
      type: 'select-nodes',
      nodeIds: collectDesignerSelectAllNodeIds(stateRef.current.document),
    });
  }, []);

  const hoverNode = React.useCallback((nodeId: string | null) => {
    dispatch({ type: 'hover-node', nodeId });
  }, []);

  const resolveInsertParentId = React.useCallback((preferredParentId?: string | null) => {
    if (!hydrated) {
      return null;
    }
    return resolveInsertParentIdFromState(state, preferredParentId);
  }, [hydrated, state]);

  const removeNode = React.useCallback((nodeId: string) => {
    const trimmed = nodeId.trim();
    if (!hydrated || !trimmed || trimmed === state.document.rootNodeId) {
      return false;
    }
    if (!state.document.nodes[trimmed]) {
      return false;
    }
    dispatch({ type: 'remove-node', nodeId: trimmed });
    return true;
  }, [hydrated, state.document.nodes, state.document.rootNodeId]);

  const removeNodes = React.useCallback((nodeIds: string[]) => {
    if (!hydrated) {
      return false;
    }
    const ids = nodeIds.filter((id) => {
      const trimmed = id.trim();
      return Boolean(trimmed && trimmed !== state.document.rootNodeId && state.document.nodes[trimmed]);
    });
    if (ids.length === 0) {
      return false;
    }
    dispatch({ type: 'remove-nodes', nodeIds: ids });
    return true;
  }, [hydrated, state.document.nodes, state.document.rootNodeId]);

  const duplicateNode = React.useCallback((nodeId?: string | null) => {
    const trimmed = (nodeId ?? state.selectedNodeId)?.trim() || '';
    if (!hydrated || !trimmed || trimmed === state.document.rootNodeId) {
      return false;
    }
    if (!state.document.nodes[trimmed]) {
      return false;
    }
    dispatch({ type: 'duplicate-node', nodeId: trimmed });
    return true;
  }, [hydrated, state.document.nodes, state.document.rootNodeId, state.selectedNodeId]);

  const copyNode = React.useCallback((nodeId?: string | null) => {
    const trimmed = (nodeId ?? state.selectedNodeId)?.trim() || '';
    if (!hydrated || !trimmed || trimmed === state.document.rootNodeId) {
      return false;
    }
    if (!state.document.nodes[trimmed]) {
      return false;
    }
    const payload = copyLiveDesignerSubtree(state.document.nodes, trimmed);
    if (!payload) {
      return false;
    }
    setClipboardRevision((value) => value + 1);
    return true;
  }, [hydrated, state.document.nodes, state.document.rootNodeId, state.selectedNodeId]);

  const pasteNode = React.useCallback(async () => {
    if (!hydrated) {
      return false;
    }
    const payload: LiveDesignerClipboardPayload | null = await readLiveDesignerClipboard();
    if (!payload) {
      return false;
    }
    const sourceRoot = payload.nodes[payload.rootNodeId];
    if (!sourceRoot) {
      return false;
    }
    const target = resolvePasteTarget(state, sourceRoot);
    if (!target) {
      return false;
    }
    dispatch({
      type: 'paste-node-subtree',
      sourceNodes: payload.nodes,
      sourceRootId: payload.rootNodeId,
      targetParentId: target.parentId,
      index: target.index,
    });
    setClipboardRevision((value) => value + 1);
    return true;
  }, [hydrated, state]);

  const moveNode = React.useCallback((nodeId: string, targetParentId: string, index?: number) => {
    const trimmed = nodeId.trim();
    const parentId = targetParentId.trim();
    if (!hydrated || !trimmed || !parentId || trimmed === state.document.rootNodeId) {
      return false;
    }
    if (!state.document.nodes[trimmed] || !state.document.nodes[parentId]) {
      return false;
    }
    dispatch({
      type: 'move-node',
      nodeId: trimmed,
      targetParentId: parentId,
      index,
    });
    return true;
  }, [hydrated, state.document.nodes, state.document.rootNodeId]);

  const insertPaletteItem = React.useCallback((itemId: string, parentNodeId?: string | null, index?: number) => {
    if (!hydrated) {
      return false;
    }
    const item = getPaletteItemById(itemId);
    if (!item) {
      return false;
    }
    const parentId = parentNodeId?.trim()
      ? parentNodeId.trim()
      : resolveInsertParentIdFromState(state, parentNodeId);
    const parentNode = state.document.nodes[parentId];
    if (!parentNode || !canInsertPaletteItemWithAutoWrap(item, parentNode)) {
      return false;
    }
    dispatch({
      type: 'insert-palette-item',
      itemId,
      parentId,
      index: typeof index === 'number' ? index : parentNode.children.length,
    } satisfies DesignerAction);
    return true;
  }, [hydrated, state]);

  const setNodeProp = React.useCallback((nodeId: string, key: string, value: unknown) => {
    const trimmed = nodeId.trim();
    if (!trimmed) {
      return;
    }
    dispatch({
      type: 'set-node-prop',
      nodeId: trimmed,
      key,
      value,
    });
  }, []);

  const applyDocument = React.useCallback((
    document: DesignerDocument,
    bindingDefinitions: DesignerBindingDefinitions,
  ) => {
    dispatch({
      type: 'replace-document-from-code',
      document,
      bindingDefinitions,
      preferredSelectedNodeId: selectedNodeIdRef.current,
    });
  }, []);

  const undo = React.useCallback(() => {
    dispatch({ type: 'undo' });
  }, []);

  const redo = React.useCallback(() => {
    dispatch({ type: 'redo' });
  }, []);

  const selectedNodeId = state.selectedNodeId;
  const selectedNodeIds = state.selectedNodeIds;
  const canDeleteSelected = Boolean(
    hydrated
    && selectedNodeIds.some((id) => (
      Boolean(id && id !== state.document.rootNodeId && state.document.nodes[id])
    )),
  );
  const canDuplicateSelected = canDeleteSelected;
  const canCopySelected = canDeleteSelected;
  const hasClipboard = clipboardRevision >= 0 && Boolean(getLiveDesignerClipboard());

  const documentRevision = hydrated
    ? `${state.document.metadata.updatedAt ?? ''}:${state.history.past.length}`
    : '0';

  return React.useMemo(() => ({
    ready: hydrated,
    state,
    document: hydrated ? state.document : null,
    bindingDefinitions: state.bindingDefinitions,
    selectedNodeId,
    selectedNodeIds,
    hoveredNodeId: state.hoveredNodeId,
    isDirty: hydrated && state.isDirty,
    canUndo: hydrated && state.history.past.length > 0,
    canRedo: hydrated && state.history.future.length > 0,
    canDeleteSelected,
    canDuplicateSelected,
    canCopySelected,
    hasClipboard,
    documentRevision,
    dispatch,
    hydrate,
    selectNode,
    selectAllNodes,
    hoverNode,
    removeNode,
    removeNodes,
    duplicateNode,
    copyNode,
    pasteNode,
    moveNode,
    insertPaletteItem,
    setNodeProp,
    applyDocument,
    undo,
    redo,
    markSaved,
    resolveInsertParentId,
  }), [
    canCopySelected,
    canDeleteSelected,
    canDuplicateSelected,
    documentRevision,
    duplicateNode,
    copyNode,
    hasClipboard,
    hydrate,
    hoverNode,
    hydrated,
    insertPaletteItem,
    markSaved,
    moveNode,
    pasteNode,
    redo,
    removeNode,
    removeNodes,
    resolveInsertParentId,
    selectAllNodes,
    selectNode,
    selectedNodeId,
    selectedNodeIds,
    setNodeProp,
    applyDocument,
    state,
    undo,
  ]);
}
