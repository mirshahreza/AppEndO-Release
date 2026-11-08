import * as React from 'react';
import type {
  DesignerAction,
  DesignerBindingDefinition,
  DesignerDiagnostic,
  DesignerNode,
  DesignerState,
} from '../../../domain/component-designer/types';
import { getNodeLabel } from '../utils/nodeLabel';
import { hasOpenDesignerModal, isEditableKeyboardTarget } from './designerUtils';
import type { DesignerDialogFlags } from './types';

export type UseDesignerInteractionsParams = {
  state: DesignerState;
  dispatch: React.Dispatch<DesignerAction>;
  selectedNode: DesignerNode | null | undefined;
  previewDiagnostics: DesignerDiagnostic[];
  getDialogFlags: () => DesignerDialogFlags;
  flashToolbarStatus: (message: string) => void;
};

export type UseDesignerInteractionsResult = {
  handleRemoveSelectedNode: (source?: 'canvas' | 'toolbar' | 'keyboard', nodeId?: string) => void;
  setNodeBindingField: (
    nodeId: string,
    bindingKey: string,
    updater: (definition: DesignerBindingDefinition) => DesignerBindingDefinition,
  ) => void;
  setGlobalBindingField: (
    bindingKey: string,
    updater: (definition: DesignerBindingDefinition) => DesignerBindingDefinition,
  ) => void;
  allDiagnostics: DesignerDiagnostic[];
  diagnosticsByNodeId: Record<string, DesignerDiagnostic[]>;
};

export const useDesignerInteractions = ({
  state,
  dispatch,
  selectedNode,
  previewDiagnostics,
  getDialogFlags,
  flashToolbarStatus,
}: UseDesignerInteractionsParams): UseDesignerInteractionsResult => {
  const canRemoveSelectedNode = Boolean(selectedNode && selectedNode.id !== state.document.rootNodeId);

  const handleRemoveSelectedNode = React.useCallback((source: 'canvas' | 'toolbar' | 'keyboard' = 'toolbar', nodeId?: string) => {
    const targetNodeId = nodeId ?? selectedNode?.id;
    if (!targetNodeId || targetNodeId === state.document.rootNodeId) {
      return;
    }

    const targetNode = state.document.nodes[targetNodeId];
    if (!targetNode) {
      return;
    }

    const nodeLabel = getNodeLabel(targetNode, state.bindingDefinitions);
    dispatch({ type: 'remove-node', nodeId: targetNodeId });
    if (source === 'keyboard') {
      flashToolbarStatus(`Deleted ${nodeLabel} from canvas.`);
      return;
    }

    flashToolbarStatus(`Deleted ${nodeLabel}.`);
  }, [dispatch, flashToolbarStatus, selectedNode?.id, state.bindingDefinitions, state.document.nodes, state.document.rootNodeId]);

  React.useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      const isDeleteKey = event.key === 'Delete' || event.key === 'Backspace';
      const isEscapeKey = event.key === 'Escape';
      if (!isDeleteKey && !isEscapeKey) {
        return;
      }

      if (event.defaultPrevented && !isEscapeKey) {
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const { draftDialogMode, isPreviewDialogOpen: previewOpen } = getDialogFlags();
      if (draftDialogMode !== null || previewOpen || hasOpenDesignerModal()) {
        return;
      }

      if (isEditableKeyboardTarget(event.target)) {
        return;
      }

      if (isEscapeKey) {
        if (!selectedNode) {
          return;
        }

        const parentNodeId = selectedNode.parentId && state.document.nodes[selectedNode.parentId]
          ? selectedNode.parentId
          : state.document.rootNodeId;

        if (parentNodeId === selectedNode.id) {
          return;
        }

        event.preventDefault();
        dispatch({ type: 'select-node', nodeId: parentNodeId });
        return;
      }

      if (!canRemoveSelectedNode) {
        return;
      }

      event.preventDefault();
      handleRemoveSelectedNode('keyboard');
    };

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown);
    };
  }, [canRemoveSelectedNode, dispatch, getDialogFlags, handleRemoveSelectedNode, selectedNode, state.document.nodes, state.document.rootNodeId]);

  const allDiagnostics = React.useMemo(
    () => [...state.document.diagnostics, ...state.syncDiagnostics, ...previewDiagnostics],
    [previewDiagnostics, state.document.diagnostics, state.syncDiagnostics],
  );

  const diagnosticsByNodeId = React.useMemo(() => {
    const map: Record<string, DesignerDiagnostic[]> = {};
    for (const diagnostic of allDiagnostics) {
      if (!diagnostic.nodeId) {
        continue;
      }
      if (!map[diagnostic.nodeId]) {
        map[diagnostic.nodeId] = [];
      }
      map[diagnostic.nodeId].push(diagnostic);
    }
    return map;
  }, [allDiagnostics]);

  const setNodeBindingField = React.useCallback(
    (nodeId: string, bindingKey: string, updater: (definition: DesignerBindingDefinition) => DesignerBindingDefinition) => {
      const node = state.document.nodes[nodeId];
      if (!node) {
        return;
      }

      const currentDefinition: DesignerBindingDefinition = node.binding[bindingKey] ?? {
        sourceType: 'static',
      };

      dispatch({
        type: 'set-node-binding',
        nodeId,
        bindingKey,
        definition: updater(currentDefinition),
      });
    },
    [dispatch, state.document.nodes],
  );

  const setGlobalBindingField = React.useCallback(
    (bindingKey: string, updater: (definition: DesignerBindingDefinition) => DesignerBindingDefinition) => {
      const currentDefinition: DesignerBindingDefinition = state.bindingDefinitions.definitions[bindingKey] ?? {
        sourceType: 'static',
      };
      dispatch({
        type: 'set-binding-definition',
        bindingKey,
        definition: updater(currentDefinition),
      });
    },
    [dispatch, state.bindingDefinitions],
  );

  return {
    handleRemoveSelectedNode,
    setNodeBindingField,
    setGlobalBindingField,
    allDiagnostics,
    diagnosticsByNodeId,
  };
};
