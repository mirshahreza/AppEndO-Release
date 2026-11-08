import * as React from 'react';
import { isContainerNode } from '../../../../domain/component-designer/catalog';
import {
  resolveOutlineNodeDisplay,
  resolveOutlinePrimaryLabel,
  type OutlineNodeDisplay,
} from '../../../../domain/component-designer/outlineNodeDisplay';
import type {
  DesignerBindingDefinitions,
  DesignerDocument,
  DesignerNode,
} from '../../../../domain/component-designer/types';
import { computeVisibleTreeNodeIds } from '../../hooks/designerUtils';
import { useDebouncedValue } from '../../lib/useDebouncedValue';

export type LiveDesignerOutlineRow = {
  id: string;
  parentId: string | null;
  depth: number;
  hasChildren: boolean;
  isRoot: boolean;
  display: OutlineNodeDisplay;
  treeLabel: string;
};

export function useLiveDesignerOutline(
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
) {
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search, 160);
  const [collapsedNodeIds, setCollapsedNodeIds] = React.useState<ReadonlySet<string>>(() => new Set());
  const documentIdRef = React.useRef(document.id);

  React.useEffect(() => {
    if (documentIdRef.current === document.id) {
      return;
    }
    documentIdRef.current = document.id;
    setSearch('');
    setCollapsedNodeIds(new Set());
  }, [document.id]);

  const visibleNodeIds = React.useMemo(
    () => computeVisibleTreeNodeIds(
      document.nodes,
      document.rootNodeId,
      debouncedSearch,
      bindingDefinitions,
    ),
    [bindingDefinitions, debouncedSearch, document.nodes, document.rootNodeId],
  );

  const rows = React.useMemo<LiveDesignerOutlineRow[]>(() => {
    const next: LiveDesignerOutlineRow[] = [];
    const searching = debouncedSearch.trim().length > 0;

    const walk = (nodeId: string, depth: number) => {
      const node = document.nodes[nodeId];
      if (!node) {
        return;
      }

      const isRoot = nodeId === document.rootNodeId;
      if (!isRoot && visibleNodeIds !== null && !visibleNodeIds.has(nodeId)) {
        return;
      }

      const hasChildren = isContainerNode(node) && node.children.length > 0;
      const display = resolveOutlineNodeDisplay(node, bindingDefinitions);
      next.push({
        id: node.id,
        parentId: node.parentId,
        depth,
        hasChildren,
        isRoot,
        display,
        treeLabel: isRoot
          ? (document.name?.trim() || 'Layout')
          : resolveOutlinePrimaryLabel(node, bindingDefinitions),
      });

      if (!hasChildren) {
        return;
      }

      const expanded = searching || isRoot || !collapsedNodeIds.has(node.id);
      if (!expanded) {
        return;
      }

      for (const childId of node.children) {
        walk(childId, depth + 1);
      }
    };

    walk(document.rootNodeId, 0);
    return next;
  }, [bindingDefinitions, collapsedNodeIds, debouncedSearch, document, visibleNodeIds]);

  const expandedById = React.useMemo(() => {
    const searching = debouncedSearch.trim().length > 0;
    const map: Record<string, boolean> = {};
    for (const node of Object.values(document.nodes) as DesignerNode[]) {
      if (!isContainerNode(node) || node.children.length === 0) {
        continue;
      }
      map[node.id] = node.id === document.rootNodeId || searching || !collapsedNodeIds.has(node.id);
    }
    return map;
  }, [collapsedNodeIds, debouncedSearch, document.nodes, document.rootNodeId]);

  const toggleCollapsed = React.useCallback((nodeId: string) => {
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

  const expandAll = React.useCallback(() => {
    setCollapsedNodeIds(new Set());
  }, []);

  const collapseAll = React.useCallback(() => {
    const containerIds = new Set<string>();
    for (const node of Object.values(document.nodes) as DesignerNode[]) {
      if (isContainerNode(node) && node.id !== document.rootNodeId && node.children.length > 0) {
        containerIds.add(node.id);
      }
    }
    setCollapsedNodeIds(containerIds);
  }, [document.nodes, document.rootNodeId]);

  return {
    search,
    setSearch,
    rows,
    expandedById,
    toggleCollapsed,
    expandAll,
    collapseAll,
  };
}
