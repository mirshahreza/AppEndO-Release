import { getPaletteItemById } from './catalog';
import {
  createLayoutColumnSlotNode,
  getNodePaletteItemId,
  isLayoutColumnSlotNode,
  isLayoutGridPaletteItemId,
  resolveLayoutGridColumnCount,
  resolveLayoutGridRowCount,
  syncLayoutGridSlotChildren,
} from './layoutGridSlots';
import {
  LAYOUT_DOCK_PANE_PALETTE_ITEM_ID,
  LAYOUT_GRID_MAX_TRACKS,
  LAYOUT_GRID_ROWS_PROP,
  LAYOUT_SPLIT_PANE_MAX_PANES,
  LAYOUT_SPLIT_PANE_PALETTE_ITEM_ID,
} from './layoutPaletteConstants';
import { isVerticalLayoutDock, readLayoutDockEdge } from './layoutDockPane';
import { applyTailwindUtility, syncTailwindPropKeys } from './tailwindClasses';
import type { TailwindInspectorField } from './inspectorRegistry';
import type { DesignerNode, DesignerState } from './types';

export type LayoutTrackAxis = 'row' | 'column';

export type LayoutStructureKind = 'split-pane' | 'grid' | 'flex';

export type LayoutStructureHint = {
  kind: LayoutStructureKind;
  hostNodeId: string;
  hoveredChildId: string | null;
  primaryAxis: LayoutTrackAxis;
  canAddColumn: boolean;
  canAddRow: boolean;
  addColumnLabel: string;
  addRowLabel: string;
  columnCount: number;
  rowCount: number;
};

export type ResolveLayoutStructureHintOptions = {
  /** Walk from a nested piece up to its layout host (canvas hover chrome). */
  includeNestedPieces?: boolean;
};

const GRID_COLS_FIELD: TailwindInspectorField = {
  key: 'twGridCols',
  label: 'Grid Columns',
  type: 'select',
  group: 'tailwind',
  utilityPrefix: 'grid-cols',
  conflictPattern: /^(?:[a-z0-9-]+:)?grid-cols-(?:1|2|3|4|5|6|7|8|9|10|11|12|none|subgrid)$/,
};

const FLEX_ROW_CLASS_PATTERN = /(?:^|\s)flex-row(?:\s|$)/;
const FLEX_COL_CLASS_PATTERN = /(?:^|\s)flex-col(?:\s|$)/;

const createSlotId = (): string =>
  `layout-column-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const insertChildId = (children: string[], childId: string, index: number): string[] => {
  const next = [...children];
  const clamped = Math.max(0, Math.min(index, next.length));
  next.splice(clamped, 0, childId);
  return next;
};

const readClassName = (node: DesignerNode): string =>
  typeof node.props.className === 'string' ? node.props.className : '';

export const isLayoutSplitPaneNode = (node: DesignerNode): boolean =>
  getNodePaletteItemId(node) === LAYOUT_SPLIT_PANE_PALETTE_ITEM_ID;

export const isLayoutFlexPaletteItemId = (itemId: string | null | undefined): boolean => {
  if (!itemId) {
    return false;
  }
  return itemId === 'layout.flex-row'
    || itemId === 'layout.flex-column'
    || itemId === 'layout.stack-compact'
    || itemId === 'layout.stack-relaxed'
    || itemId === 'layout.center'
    || itemId === 'layout.wrapper'
    || itemId === 'layout.scroll'
    || itemId === 'layout.sticky-bar'
    || itemId === 'layout.dock-pane';
};

export const isLayoutStructureHostNode = (node: DesignerNode): boolean => {
  if (isLayoutSplitPaneNode(node)) {
    return true;
  }
  const paletteItemId = getNodePaletteItemId(node);
  return Boolean(
    (paletteItemId && isLayoutGridPaletteItemId(paletteItemId))
    || isLayoutFlexPaletteItemId(paletteItemId),
  );
};

const resolveFlexPrimaryAxis = (node: DesignerNode): LayoutTrackAxis => {
  const itemId = getNodePaletteItemId(node);
  if (itemId === 'layout.flex-row') {
    return 'column';
  }
  if (itemId === LAYOUT_DOCK_PANE_PALETTE_ITEM_ID) {
    return isVerticalLayoutDock(readLayoutDockEdge(node.props.dock)) ? 'column' : 'row';
  }
  if (
    itemId === 'layout.flex-column'
    || itemId === 'layout.stack-compact'
    || itemId === 'layout.stack-relaxed'
  ) {
    return 'row';
  }
  const className = readClassName(node);
  if (FLEX_ROW_CLASS_PATTERN.test(className)) {
    return 'column';
  }
  if (FLEX_COL_CLASS_PATTERN.test(className)) {
    return 'row';
  }
  return 'row';
};

const resolveSplitPrimaryAxis = (node: DesignerNode): LayoutTrackAxis =>
  String(node.props.direction ?? 'horizontal') === 'vertical' ? 'row' : 'column';

export const resolveLayoutStructureHint = (
  nodes: Record<string, DesignerNode>,
  nodeId: string | null | undefined,
  options?: ResolveLayoutStructureHintOptions,
): LayoutStructureHint | null => {
  if (!nodeId) {
    return null;
  }
  const node = nodes[nodeId];
  if (!node) {
    return null;
  }

  let host = node;
  let hoveredChildId: string | null = null;
  if (!isLayoutStructureHostNode(node)) {
    if (isLayoutColumnSlotNode(node) && node.parentId && nodes[node.parentId]) {
      hoveredChildId = node.id;
      host = nodes[node.parentId]!;
    } else if (options?.includeNestedPieces && node.parentId && nodes[node.parentId]) {
      const parent = nodes[node.parentId]!;
      if (isLayoutStructureHostNode(parent)) {
        hoveredChildId = node.id;
        host = parent;
      } else if (isLayoutColumnSlotNode(parent) && parent.parentId && nodes[parent.parentId]) {
        hoveredChildId = parent.id;
        host = nodes[parent.parentId]!;
      }
    }
  }

  const paletteItemId = getNodePaletteItemId(host);
  if (isLayoutSplitPaneNode(host)) {
    const primaryAxis = resolveSplitPrimaryAxis(host);
    const paneCount = host.children.length;
    return {
      kind: 'split-pane',
      hostNodeId: host.id,
      hoveredChildId,
      primaryAxis,
      canAddColumn: primaryAxis === 'column'
        ? paneCount < LAYOUT_SPLIT_PANE_MAX_PANES
        : true,
      canAddRow: primaryAxis === 'row'
        ? paneCount < LAYOUT_SPLIT_PANE_MAX_PANES
        : true,
      addColumnLabel: primaryAxis === 'column' ? 'Add column' : 'Split horizontally',
      addRowLabel: primaryAxis === 'row' ? 'Add row' : 'Split vertically',
      columnCount: primaryAxis === 'column' ? paneCount : 1,
      rowCount: primaryAxis === 'row' ? paneCount : 1,
    };
  }

  if (paletteItemId && isLayoutGridPaletteItemId(paletteItemId)) {
    const columnCount = resolveLayoutGridColumnCount(host) ?? host.children.length;
    const rowCount = resolveLayoutGridRowCount(host);
    return {
      kind: 'grid',
      hostNodeId: host.id,
      hoveredChildId,
      primaryAxis: 'column',
      canAddColumn: columnCount < LAYOUT_GRID_MAX_TRACKS,
      canAddRow: rowCount < LAYOUT_GRID_MAX_TRACKS,
      addColumnLabel: 'Add column',
      addRowLabel: 'Add row',
      columnCount,
      rowCount,
    };
  }

  if (isLayoutFlexPaletteItemId(paletteItemId)) {
    const primaryAxis = resolveFlexPrimaryAxis(host);
    const count = host.children.length;
    return {
      kind: 'flex',
      hostNodeId: host.id,
      hoveredChildId,
      primaryAxis,
      canAddColumn: true,
      canAddRow: true,
      addColumnLabel: 'Add column',
      addRowLabel: 'Add row',
      columnCount: primaryAxis === 'column' ? count : 1,
      rowCount: primaryAxis === 'row' ? count : 1,
    };
  }

  return null;
};

const insertSlot = (
  nodes: Record<string, DesignerNode>,
  parentId: string,
  index: number,
): Record<string, DesignerNode> => {
  const parent = nodes[parentId];
  if (!parent) {
    return nodes;
  }
  const slot = createLayoutColumnSlotNode(parentId, index, createSlotId);
  return {
    ...nodes,
    [slot.id]: slot,
    [parentId]: {
      ...parent,
      children: insertChildId(parent.children, slot.id, index),
    },
  };
};

const insertIndexForChild = (
  host: DesignerNode,
  hoveredChildId: string | null | undefined,
  place: 'before' | 'after',
): number => {
  if (!hoveredChildId) {
    return host.children.length;
  }
  const current = host.children.indexOf(hoveredChildId);
  if (current < 0) {
    return host.children.length;
  }
  return place === 'before' ? current : current + 1;
};

const addSplitPaneAlongAxis = (
  nodes: Record<string, DesignerNode>,
  host: DesignerNode,
  hoveredChildId: string | null,
  place: 'before' | 'after',
): Record<string, DesignerNode> | null => {
  if (host.children.length >= LAYOUT_SPLIT_PANE_MAX_PANES) {
    return null;
  }
  return insertSlot(nodes, host.id, insertIndexForChild(host, hoveredChildId, place));
};

const addNestedOppositeSplit = (
  nodes: Record<string, DesignerNode>,
  host: DesignerNode,
  hoveredChildId: string | null,
  axis: LayoutTrackAxis,
): Record<string, DesignerNode> | null => {
  const parentId = hoveredChildId ?? host.children[0] ?? null;
  if (!parentId || !nodes[parentId]) {
    return null;
  }
  const parent = nodes[parentId]!;
  const item = getPaletteItemById(LAYOUT_SPLIT_PANE_PALETTE_ITEM_ID);
  if (!item) {
    return null;
  }
  const nestedId = `layout-split-pane-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const direction = axis === 'row' ? 'vertical' : 'horizontal';
  const nested: DesignerNode = {
    id: nestedId,
    type: item.nodeType,
    parentId: parent.id,
    order: parent.children.length,
    props: {
      ...item.defaultProps,
      direction,
      _designerPaletteItemId: LAYOUT_SPLIT_PANE_PALETTE_ITEM_ID,
    },
    layout: {},
    binding: {},
    children: [],
  };
  const slotA = createLayoutColumnSlotNode(nestedId, 0, createSlotId);
  const slotB = createLayoutColumnSlotNode(nestedId, 1, createSlotId);
  nested.children = [slotA.id, slotB.id];

  return {
    ...nodes,
    [slotA.id]: slotA,
    [slotB.id]: slotB,
    [nestedId]: nested,
    [parent.id]: {
      ...parent,
      children: [...parent.children, nestedId],
    },
  };
};

const addGridColumn = (host: DesignerNode): DesignerNode => {
  const cols = resolveLayoutGridColumnCount(host) ?? host.children.length;
  if (cols >= LAYOUT_GRID_MAX_TRACKS) {
    return host;
  }
  const nextCols = cols + 1;
  const className = applyTailwindUtility(readClassName(host), GRID_COLS_FIELD, `grid-cols-${nextCols}`);
  return {
    ...host,
    props: {
      ...host.props,
      className,
      ...syncTailwindPropKeys(className),
    },
  };
};

const addGridRow = (host: DesignerNode): DesignerNode => {
  const rows = resolveLayoutGridRowCount(host);
  if (rows >= LAYOUT_GRID_MAX_TRACKS) {
    return host;
  }
  return {
    ...host,
    props: {
      ...host.props,
      [LAYOUT_GRID_ROWS_PROP]: rows + 1,
    },
  };
};

export const addLayoutTrackToNodes = (
  nodes: Record<string, DesignerNode>,
  hostId: string,
  axis: LayoutTrackAxis,
  hoveredChildId?: string | null,
  place: 'before' | 'after' = 'after',
): Record<string, DesignerNode> | null => {
  const host = nodes[hostId];
  if (!host) {
    return null;
  }

  if (isLayoutSplitPaneNode(host)) {
    const primary = resolveSplitPrimaryAxis(host);
    if (axis === primary) {
      return addSplitPaneAlongAxis(nodes, host, hoveredChildId ?? null, place);
    }
    return addNestedOppositeSplit(nodes, host, hoveredChildId ?? null, axis);
  }

  const paletteItemId = getNodePaletteItemId(host);
  if (paletteItemId && isLayoutGridPaletteItemId(paletteItemId)) {
    const nextHost = axis === 'column' ? addGridColumn(host) : addGridRow(host);
    if (nextHost === host) {
      return null;
    }
    const withHost = {
      ...nodes,
      [host.id]: nextHost,
    };
    return syncLayoutGridSlotChildren(withHost, host.id);
  }

  if (isLayoutFlexPaletteItemId(paletteItemId)) {
    const primary = resolveFlexPrimaryAxis(host);
    if (axis === primary) {
      return insertSlot(nodes, host.id, insertIndexForChild(host, hoveredChildId ?? null, place));
    }
    const nestedItemId = axis === 'column' ? 'layout.flex-row' : 'layout.flex-column';
    const parentId = hoveredChildId ?? host.id;
    const parent = nodes[parentId];
    const item = getPaletteItemById(nestedItemId);
    if (!parent || !item) {
      return insertSlot(nodes, host.id, host.children.length);
    }
    if (parentId === host.id) {
      return insertSlot(nodes, host.id, insertIndexForChild(host, null, place));
    }
    const nestedId = `${nestedItemId.replace(/[^a-z0-9]+/gi, '-')}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const nested: DesignerNode = {
      id: nestedId,
      type: item.nodeType,
      parentId: parent.id,
      order: parent.children.length,
      props: {
        ...item.defaultProps,
        _designerPaletteItemId: nestedItemId,
      },
      layout: {},
      binding: {},
      children: [],
    };
    const slot = createLayoutColumnSlotNode(nestedId, 0, createSlotId);
    nested.children = [slot.id];
    return {
      ...nodes,
      [slot.id]: slot,
      [nestedId]: nested,
      [parent.id]: {
        ...parent,
        children: [...parent.children, nestedId],
      },
    };
  }

  return null;
};

export const applyAddLayoutTrack = (
  state: DesignerState,
  nodeId: string,
  axis: LayoutTrackAxis,
  place: 'before' | 'after' = 'after',
): DesignerState => {
  const hint = resolveLayoutStructureHint(state.document.nodes, nodeId);
  if (!hint) {
    return state;
  }
  const nextNodes = addLayoutTrackToNodes(
    state.document.nodes,
    hint.hostNodeId,
    axis,
    hint.hoveredChildId,
    place,
  );
  if (!nextNodes) {
    return state;
  }
  return {
    ...state,
    document: {
      ...state.document,
      nodes: nextNodes,
    },
    selectedNodeId: hint.hostNodeId,
    selectedNodeIds: [hint.hostNodeId],
  };
};
