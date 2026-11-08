import * as React from 'react';
import { isContainerNode } from '../../../domain/component-designer/catalog';
import {
  resolveOutlineNodeDisplay,
  resolveOutlinePrimaryLabel,
} from '../../../domain/component-designer/outlineNodeDisplay';
import type { DesignerDiagnostic, DesignerNode, DesignerState } from '../../../domain/component-designer/types';
import type { OutlineTreeRow } from '../types';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { computeVisibleTreeNodeIds } from './designerUtils';

export type UseDesignerOutlineParams = {
  state: DesignerState;
  previewDiagnostics: DesignerDiagnostic[];
};

export type UseDesignerOutlineResult = {
  nodeTreeSearch: string;
  setNodeTreeSearch: React.Dispatch<React.SetStateAction<string>>;
  handleToggleNodeCollapse: (nodeId: string) => void;
  handleExpandAllNodes: () => void;
  handleCollapseAllNodes: () => void;
  outlineRows: OutlineTreeRow[];
  outlineExpandedById: Record<string, boolean>;
  visibleTreeNodeIds: ReadonlySet<string> | null;
};

export const useDesignerOutline = ({
  state,
  previewDiagnostics,
}: UseDesignerOutlineParams): UseDesignerOutlineResult => {
  const [nodeTreeSearch, setNodeTreeSearch] = React.useState('');
  const debouncedNodeTreeSearch = useDebouncedValue(nodeTreeSearch, 180);
  const [collapsedNodeIds, setCollapsedNodeIds] = React.useState<ReadonlySet<string>>(new Set());
  const documentIdRef = React.useRef(state.document.id);

  React.useEffect(() => {
    if (documentIdRef.current === state.document.id) {
      return;
    }

    documentIdRef.current = state.document.id;
    setNodeTreeSearch('');
    setCollapsedNodeIds(new Set());
  }, [state.document.id]);

  const handleToggleNodeCollapse = React.useCallback((nodeId: string) => {
    setCollapsedNodeIds((previous) => {
      const next = new Set(previous);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const handleExpandAllNodes = React.useCallback(() => {
    setCollapsedNodeIds(new Set());
  }, []);

  const handleCollapseAllNodes = React.useCallback(() => {
    const containerIds = new Set<string>();
    for (const node of Object.values(state.document.nodes) as DesignerNode[]) {
      if (isContainerNode(node) && node.id !== state.document.rootNodeId && node.children.length > 0) {
        containerIds.add(node.id);
      }
    }
    setCollapsedNodeIds(containerIds);
  }, [state.document.nodes, state.document.rootNodeId]);

  const visibleTreeNodeIds = React.useMemo(
    () => computeVisibleTreeNodeIds(
      state.document.nodes,
      state.document.rootNodeId,
      debouncedNodeTreeSearch,
      state.bindingDefinitions,
    ),
    [debouncedNodeTreeSearch, state.bindingDefinitions, state.document.nodes, state.document.rootNodeId],
  );

  const outlineExpandedById = React.useMemo<Record<string, boolean>>(() => {
    const searching = debouncedNodeTreeSearch.trim().length > 0;
    const expanded: Record<string, boolean> = {};
    for (const node of Object.values(state.document.nodes) as DesignerNode[]) {
      if (!isContainerNode(node) || node.children.length === 0) {
        continue;
      }
      expanded[node.id] = node.id === state.document.rootNodeId || searching || !collapsedNodeIds.has(node.id);
    }
    return expanded;
  }, [collapsedNodeIds, debouncedNodeTreeSearch, state.document.nodes, state.document.rootNodeId]);

  const outlineDiagnosticsCountByNodeId = React.useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    const collect = (items: DesignerDiagnostic[]) => {
      for (const item of items) {
        if (!item.nodeId) {
          continue;
        }
        map[item.nodeId] = (map[item.nodeId] ?? 0) + 1;
      }
    };

    collect(state.document.diagnostics);
    collect(state.syncDiagnostics);
    collect(previewDiagnostics);
    return map;
  }, [previewDiagnostics, state.document.diagnostics, state.syncDiagnostics]);

  const outlineRows = React.useMemo<OutlineTreeRow[]>(() => {
    const rows: OutlineTreeRow[] = [];
    const searching = debouncedNodeTreeSearch.trim().length > 0;

    const walk = (nodeId: string, depth: number) => {
      const node = state.document.nodes[nodeId];
      if (!node) {
        return;
      }

      const isRoot = nodeId === state.document.rootNodeId;
      if (!isRoot && visibleTreeNodeIds !== null && !visibleTreeNodeIds.has(nodeId)) {
        return;
      }

      const hasChildren = isContainerNode(node) && node.children.length > 0;
      const display = resolveOutlineNodeDisplay(node, state.bindingDefinitions);
      const treeLabel = isRoot
        ? (state.document.name?.trim() || 'Layout')
        : resolveOutlinePrimaryLabel(node, state.bindingDefinitions);

      rows.push({
        id: node.id,
        parentId: node.parentId,
        depth,
        hasChildren,
        node,
        diagnosticsCount: outlineDiagnosticsCountByNodeId[node.id] ?? 0,
        isRoot,
        display,
        treeLabel,
      });

      if (!hasChildren) {
        return;
      }

      const isExpanded = searching || node.id === state.document.rootNodeId || !collapsedNodeIds.has(node.id);
      if (!isExpanded) {
        return;
      }

      for (const childId of node.children) {
        walk(childId, depth + 1);
      }
    };

    walk(state.document.rootNodeId, 0);
    return rows;
  }, [collapsedNodeIds, debouncedNodeTreeSearch, outlineDiagnosticsCountByNodeId, state.bindingDefinitions, state.document.name, state.document.nodes, state.document.rootNodeId, visibleTreeNodeIds]);

  return {
    nodeTreeSearch,
    setNodeTreeSearch,
    handleToggleNodeCollapse,
    handleExpandAllNodes,
    handleCollapseAllNodes,
    outlineRows,
    outlineExpandedById,
    visibleTreeNodeIds,
  };
};
