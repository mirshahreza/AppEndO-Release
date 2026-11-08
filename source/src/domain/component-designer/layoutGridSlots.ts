import {
  LAYOUT_COLUMN_SLOT_CLASSNAME,
  LAYOUT_COLUMNS_DEFAULT_CHILD_COUNT,
  LAYOUT_COLUMNS_PALETTE_ITEM_ID,
  LAYOUT_GRID_ROWS_PROP,
} from './layoutPaletteConstants';
import type { DesignerNode } from './types';
import {
  parseLayoutGridColumnWidths,
  resolveGridColumnCountFromTracks,
  resolveLayoutGridDirection,
  LAYOUT_GRID_COLUMN_WIDTHS_PROP,
} from './layoutGridColumnWidths';

export const LAYOUT_GRID_2_PALETTE_ITEM_ID = 'layout.grid-2';
export const LAYOUT_GRID_3_PALETTE_ITEM_ID = 'layout.grid-3';

export const LAYOUT_GRID_PALETTE_ITEM_IDS = new Set<string>([
  LAYOUT_COLUMNS_PALETTE_ITEM_ID,
  LAYOUT_GRID_2_PALETTE_ITEM_ID,
  LAYOUT_GRID_3_PALETTE_ITEM_ID,
]);

const LAYOUT_GRID_DEFAULT_COLUMN_COUNTS: Record<string, number> = {
  [LAYOUT_GRID_2_PALETTE_ITEM_ID]: 2,
  [LAYOUT_GRID_3_PALETTE_ITEM_ID]: 3,
  [LAYOUT_COLUMNS_PALETTE_ITEM_ID]: LAYOUT_COLUMNS_DEFAULT_CHILD_COUNT,
};

export const isLayoutGridPaletteItemId = (itemId: string | null | undefined): itemId is string =>
  typeof itemId === 'string' && LAYOUT_GRID_PALETTE_ITEM_IDS.has(itemId);

export const getLayoutGridDefaultColumnCount = (itemId: string): number =>
  LAYOUT_GRID_DEFAULT_COLUMN_COUNTS[itemId] ?? 0;

export const parseGridColsUtilityCount = (utility: unknown): number | null => {
  if (typeof utility !== 'string' || utility.trim().length === 0) {
    return null;
  }

  const match = utility.trim().match(/^(?:[a-z0-9-]+:)?grid-cols-(\d+)$/i);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

export const resolveGridColumnCountFromClassName = (className: string): number | null => {
  const normalized = className.trim();
  if (!normalized) {
    return null;
  }

  const matches = normalized.match(/(?:^|\s)(?:[a-z0-9-]+:)?grid-cols-(\d+)(?=\s|$)/gi);
  if (!matches || matches.length === 0) {
    return null;
  }

  const lastMatch = matches[matches.length - 1];
  const parsed = Number(lastMatch.replace(/[^0-9]/g, ''));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

export const getNodePaletteItemId = (node: DesignerNode): string | null => {
  const paletteItemId = node.props._designerPaletteItemId;
  return typeof paletteItemId === 'string' && paletteItemId.length > 0 ? paletteItemId : null;
};

export const isLayoutColumnSlotNode = (node: DesignerNode): boolean => {
  if (node.props._designerLayoutSlot === true) {
    return true;
  }

  const className = typeof node.props.className === 'string' ? node.props.className : '';
  return className.includes('border-dashed') && className.includes('min-h-[50px]');
};

export const resolveLayoutGridColumnCount = (node: DesignerNode): number | null => {
  const direction = resolveLayoutGridDirection(node.props);
  const fromWidths = parseLayoutGridColumnWidths(node.props[LAYOUT_GRID_COLUMN_WIDTHS_PROP]);
  if (fromWidths) {
    return fromWidths.length;
  }

  if (direction === 'column') {
    const fromTwGridCols = parseGridColsUtilityCount(node.props.twGridCols);
    if (fromTwGridCols !== null) {
      return fromTwGridCols;
    }
  }

  const className = typeof node.props.className === 'string' ? node.props.className : '';
  const fromTracks = resolveGridColumnCountFromTracks(className);
  if (fromTracks !== null && direction !== 'column') {
    return fromTracks;
  }

  const fromTwGridCols = parseGridColsUtilityCount(node.props.twGridCols);
  if (fromTwGridCols !== null) {
    return fromTwGridCols;
  }

  const fromClassName = resolveGridColumnCountFromClassName(className);
  if (fromClassName !== null && direction !== 'column') {
    return fromClassName;
  }

  const paletteItemId = getNodePaletteItemId(node);
  if (paletteItemId && isLayoutGridPaletteItemId(paletteItemId)) {
    return getLayoutGridDefaultColumnCount(paletteItemId);
  }

  return null;
};

export const resolveLayoutGridRowCount = (node: DesignerNode): number => {
  const raw = Number(node.props[LAYOUT_GRID_ROWS_PROP]);
  if (Number.isFinite(raw) && raw >= 1) {
    return Math.floor(raw);
  }

  const cols = resolveLayoutGridColumnCount(node) ?? 1;
  const childCount = node.children.length;
  if (cols > 0 && childCount > cols) {
    return Math.max(1, Math.ceil(childCount / cols));
  }

  return 1;
};

export const resolveLayoutGridSlotTargetCount = (node: DesignerNode): number | null => {
  const cols = resolveLayoutGridColumnCount(node);
  if (cols === null || cols <= 0) {
    return null;
  }
  const raw = Number(node.props[LAYOUT_GRID_ROWS_PROP]);
  const rows = Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
  return cols * rows;
};

export const createLayoutColumnSlotNode = (parentId: string, order: number, idFactory: () => string): DesignerNode => ({
  id: idFactory(),
  type: 'container',
  parentId,
  order,
  props: {
    className: LAYOUT_COLUMN_SLOT_CLASSNAME,
    _designerLayoutSlot: true,
  },
  layout: {},
  binding: {},
  children: [],
});

const isSlotEmpty = (nodes: Record<string, DesignerNode>, slotId: string): boolean => {
  const slot = nodes[slotId];
  return Boolean(slot && slot.children.length === 0);
};

export const syncLayoutGridSlotChildren = (
  nodes: Record<string, DesignerNode>,
  parentId: string,
): Record<string, DesignerNode> => {
  const parent = nodes[parentId];
  if (!parent) {
    return nodes;
  }

  const paletteItemId = getNodePaletteItemId(parent);
  if (!paletteItemId || !isLayoutGridPaletteItemId(paletteItemId)) {
    return nodes;
  }

  const targetCount = resolveLayoutGridSlotTargetCount(parent);
  if (targetCount === null || targetCount <= 0) {
    return nodes;
  }

  let nextNodes = { ...nodes };
  let parentNode = { ...parent };
  let slotIds = parentNode.children.filter((childId) => {
    const child = nextNodes[childId];
    return child && isLayoutColumnSlotNode(child);
  });

  const nonSlotChildIds = parentNode.children.filter((childId) => !slotIds.includes(childId));

  while (slotIds.length < targetCount) {
    const slotNode = createLayoutColumnSlotNode(
      parentId,
      parentNode.children.length + slotIds.length,
      () => `layout-column-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    );
    nextNodes[slotNode.id] = slotNode;
    slotIds = [...slotIds, slotNode.id];
  }

  while (slotIds.length > targetCount) {
    const lastSlotId = slotIds[slotIds.length - 1];
    if (!isSlotEmpty(nextNodes, lastSlotId)) {
      break;
    }

    slotIds = slotIds.slice(0, -1);
    const { [lastSlotId]: _removed, ...rest } = nextNodes;
    nextNodes = rest;
  }

  const nextChildren = [...slotIds, ...nonSlotChildIds];
  nextNodes[parentId] = {
    ...parentNode,
    children: nextChildren,
  };

  return nextNodes;
};
