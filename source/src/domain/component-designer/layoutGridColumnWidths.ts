import type { CSSProperties } from 'react';
import { LAYOUT_COLUMNS_DEFAULT_CHILD_COUNT, LAYOUT_COLUMNS_PALETTE_ITEM_ID } from './layoutPaletteConstants';
import { syncTailwindPropKeys } from './tailwindClasses';
import type { DesignerNode } from './types';

export const LAYOUT_GRID_COLUMN_WIDTHS_PROP = 'layoutGridColumnWidths';
export const LAYOUT_GRID_DIRECTION_PROP = 'layoutGridDirection';

export type LayoutGridDirection = 'row' | 'column';

const LAYOUT_GRID_PALETTE_ITEM_IDS = new Set<string>([
  'layout.grid-2',
  'layout.grid-3',
  LAYOUT_COLUMNS_PALETTE_ITEM_ID,
]);

const parseGridColsUtilityCount = (utility: unknown): number | null => {
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

const getNodePaletteItemId = (node: DesignerNode): string | null => {
  const paletteItemId = node.props._designerPaletteItemId;
  return typeof paletteItemId === 'string' && paletteItemId.length > 0 ? paletteItemId : null;
};

const isLayoutGridPaletteItemId = (itemId: string | null | undefined): itemId is string =>
  typeof itemId === 'string' && LAYOUT_GRID_PALETTE_ITEM_IDS.has(itemId);

const getLayoutGridDefaultColumnCount = (itemId: string): number => {
  if (itemId === 'layout.grid-2') {
    return 2;
  }

  if (itemId === 'layout.grid-3') {
    return 3;
  }

  if (itemId === LAYOUT_COLUMNS_PALETTE_ITEM_ID) {
    return LAYOUT_COLUMNS_DEFAULT_CHILD_COUNT;
  }

  return 0;
};

export type LayoutGridColumnWidthUnit = 'px' | '%' | 'fr' | 'auto';

export type LayoutGridColumnWidth = {
  value: string;
  unit: LayoutGridColumnWidthUnit;
};

const GRID_COLS_TOKEN_PATTERN = /^(?:[a-z0-9-]+:)?grid-cols-(?:\d+|none|subgrid|\[[^\]]+\])$/i;
const LAYOUT_MODE_CLASS_PATTERN = /^(?:flex-row|flex-col|flex|inline-flex|grid|inline-grid)$/;

const splitClassTokens = (className: string): string[] => className.trim().split(/\s+/).filter(Boolean);

export const resolveLayoutGridDirection = (props: Record<string, unknown>): LayoutGridDirection =>
  props[LAYOUT_GRID_DIRECTION_PROP] === 'column' ? 'column' : 'row';

const stripLayoutModeClasses = (tokens: string[]): string[] => (
  tokens.filter((token) => !GRID_COLS_TOKEN_PATTERN.test(token) && !LAYOUT_MODE_CLASS_PATTERN.test(token))
);

const ensureLayoutBaseClasses = (tokens: string[], direction: LayoutGridDirection): string[] => {
  const next = [...tokens];
  if (!next.includes('w-full')) {
    next.push('w-full');
  }

  if (direction === 'column') {
    next.push('flex', 'flex-col');
    return next;
  }

  next.push('grid');
  return next;
};

export const applyLayoutGridClassName = (
  className: string,
  direction: LayoutGridDirection,
  widths: LayoutGridColumnWidth[] | null,
  fallbackColumnCount = 2,
): string => {
  const tokens = ensureLayoutBaseClasses(stripLayoutModeClasses(splitClassTokens(className)), direction);

  if (direction === 'column') {
    return tokens.join(' ');
  }

  const effectiveWidths = widths && widths.length > 0
    ? widths
    : createDefaultLayoutGridColumnWidths(Math.max(1, fallbackColumnCount));
  const utility = buildLayoutGridColsUtility(effectiveWidths);
  if (utility) {
    tokens.push(utility);
  }

  return tokens.join(' ');
};

export const createDefaultLayoutGridColumnWidths = (count: number): LayoutGridColumnWidth[] => (
  Array.from({ length: count }, () => ({ value: '1', unit: 'fr' }))
);

export const formatLayoutGridTrack = (width: LayoutGridColumnWidth): string => {
  if (width.unit === 'auto') {
    return 'auto';
  }

  const normalizedValue = width.value.trim();
  if (!normalizedValue) {
    return width.unit === 'fr' ? '1fr' : '';
  }

  return `${normalizedValue}${width.unit}`;
};

export const parseLayoutGridTrack = (track: string): LayoutGridColumnWidth | null => {
  const normalized = track.trim();
  if (!normalized) {
    return null;
  }

  if (normalized === 'auto') {
    return { value: '', unit: 'auto' };
  }

  const match = normalized.match(/^(\d+(?:\.\d+)?)(px|%|fr)$/i);
  if (!match) {
    return null;
  }

  return {
    value: match[1],
    unit: match[2].toLowerCase() as LayoutGridColumnWidthUnit,
  };
};

export const parseLayoutGridColumnWidths = (raw: unknown): LayoutGridColumnWidth[] | null => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return null;
    }

    const widths = parsed
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }

        const candidate = entry as { value?: unknown; unit?: unknown };
        const unit = typeof candidate.unit === 'string' ? candidate.unit.trim().toLowerCase() : '';
        if (unit !== 'px' && unit !== '%' && unit !== 'fr' && unit !== 'auto') {
          return null;
        }

        return {
          value: typeof candidate.value === 'string' ? candidate.value : String(candidate.value ?? ''),
          unit: unit as LayoutGridColumnWidthUnit,
        } satisfies LayoutGridColumnWidth;
      })
      .filter((entry): entry is LayoutGridColumnWidth => entry !== null);

    return widths.length > 0 ? widths : null;
  } catch {
    return null;
  }
};

export const serializeLayoutGridColumnWidths = (widths: LayoutGridColumnWidth[]): string => (
  JSON.stringify(widths)
);

export const areLayoutGridColumnWidthsEqual = (
  left: LayoutGridColumnWidth[],
  right: LayoutGridColumnWidth[],
): boolean => (
  left.length === right.length
  && left.every((entry, index) => {
    const other = right[index];
    return entry.unit === other.unit && entry.value.trim() === other.value.trim();
  })
);

export const isDefaultEqualLayoutGridColumnWidths = (widths: LayoutGridColumnWidth[]): boolean => (
  widths.every((entry) => entry.unit === 'fr' && (entry.value.trim() === '1' || entry.value.trim() === '1.0'))
);

export const buildLayoutGridColsUtility = (widths: LayoutGridColumnWidth[]): string => {
  if (widths.length === 0) {
    return '';
  }

  if (isDefaultEqualLayoutGridColumnWidths(widths) && widths.length <= 12) {
    return `grid-cols-${widths.length}`;
  }

  // Custom tracks are applied via inline gridTemplateColumns — arbitrary grid-cols-[…]
  // classes are not emitted into saved component JSON because Tailwind JIT cannot scan them.
  return '';
};

export const buildLayoutGridTemplateColumnsCss = (widths: LayoutGridColumnWidth[]): string | null => {
  if (widths.length === 0 || isDefaultEqualLayoutGridColumnWidths(widths)) {
    return null;
  }

  const tracks = widths.map(formatLayoutGridTrack).filter((track) => track.length > 0);
  if (tracks.length === 0) {
    return null;
  }

  return tracks.join(' ');
};

export const resolveLayoutGridDomStyle = (node: DesignerNode): CSSProperties | null => {
  const paletteItemId = getNodePaletteItemId(node);
  if (!paletteItemId || !isLayoutGridPaletteItemId(paletteItemId)) {
    return null;
  }

  if (resolveLayoutGridDirection(node.props) === 'column') {
    return null;
  }

  const template = buildLayoutGridTemplateColumnsCss(resolveLayoutGridColumnWidthsForNode(node));
  if (!template) {
    return null;
  }

  return { gridTemplateColumns: template };
};

export const extractGridColsUtilities = (className: string): string[] => (
  splitClassTokens(className).filter((token) => GRID_COLS_TOKEN_PATTERN.test(token))
);

export const parseGridColsUtilityTracks = (utility: string): string[] | null => {
  const normalized = utility.trim();
  const arbitraryMatch = normalized.match(/^(?:[a-z0-9-]+:)?grid-cols-\[([^\]]+)\]$/i);
  if (arbitraryMatch) {
    return arbitraryMatch[1]
      .split(',')
      .map((track) => track.trim())
      .filter((track) => track.length > 0);
  }

  const numericMatch = normalized.match(/^(?:[a-z0-9-]+:)?grid-cols-(\d+)$/i);
  if (numericMatch) {
    const count = Number(numericMatch[1]);
    if (!Number.isFinite(count) || count <= 0) {
      return null;
    }

    return Array.from({ length: count }, () => '1fr');
  }

  return null;
};

export const resolveGridColumnCountFromTracks = (className: string): number | null => {
  const utilities = extractGridColsUtilities(className);
  if (utilities.length === 0) {
    return null;
  }

  const unprefixed = utilities.find((utility) => !utility.includes(':'));
  const utility = unprefixed ?? utilities[utilities.length - 1];
  const tracks = parseGridColsUtilityTracks(utility);
  return tracks && tracks.length > 0 ? tracks.length : null;
};

export const parseLayoutGridColumnWidthsFromClassName = (className: string): LayoutGridColumnWidth[] | null => {
  const utilities = extractGridColsUtilities(className);
  if (utilities.length === 0) {
    return null;
  }

  const unprefixed = utilities.find((utility) => !utility.includes(':'));
  const utility = unprefixed ?? utilities[utilities.length - 1];
  const tracks = parseGridColsUtilityTracks(utility);
  if (!tracks || tracks.length === 0) {
    return null;
  }

  const widths = tracks
    .map(parseLayoutGridTrack)
    .filter((entry): entry is LayoutGridColumnWidth => entry !== null);

  return widths.length > 0 ? widths : null;
};

export const applyLayoutGridTracksToClassName = (
  className: string,
  widths: LayoutGridColumnWidth[] | null,
  direction: LayoutGridDirection = 'row',
  fallbackColumnCount = 2,
): string => applyLayoutGridClassName(className, direction, widths, fallbackColumnCount);

export const resizeLayoutGridColumnWidths = (
  current: LayoutGridColumnWidth[] | null,
  count: number,
): LayoutGridColumnWidth[] => {
  if (count <= 0) {
    return [];
  }

  const defaults = createDefaultLayoutGridColumnWidths(count);
  if (!current || current.length === 0) {
    return defaults;
  }

  const next = current.slice(0, count);
  while (next.length < count) {
    next.push({ value: '1', unit: 'fr' });
  }

  return next;
};

export const resolveLayoutGridColumnWidthsForNode = (node: DesignerNode): LayoutGridColumnWidth[] => {
  const fromProp = parseLayoutGridColumnWidths(node.props[LAYOUT_GRID_COLUMN_WIDTHS_PROP]);
  if (fromProp) {
    return fromProp;
  }

  const className = typeof node.props.className === 'string' ? node.props.className : '';
  const fromClassName = parseLayoutGridColumnWidthsFromClassName(className);
  if (fromClassName) {
    return fromClassName;
  }

  const paletteItemId = getNodePaletteItemId(node);
  const count = resolveGridColumnCountFromTracks(className)
    ?? parseGridColsUtilityCount(node.props.twGridCols)
    ?? (paletteItemId ? getLayoutGridDefaultColumnCount(paletteItemId) : 0)
    ?? 2;

  return createDefaultLayoutGridColumnWidths(Math.max(1, count));
};

export const syncLayoutGridNodeColumnSizing = (
  node: DesignerNode,
  changedKey: string,
): DesignerNode => {
  const paletteItemId = getNodePaletteItemId(node);
  if (!paletteItemId || !isLayoutGridPaletteItemId(paletteItemId)) {
    return node;
  }

  const fallbackColumnCount = getLayoutGridDefaultColumnCount(paletteItemId) || 2;
  let props = { ...node.props };
  const direction = resolveLayoutGridDirection(props);

  const resolveSlotCount = (className: string): number => {
    const tailwindFromClassName = syncTailwindPropKeys(className);
    const fromClassName = direction === 'column'
      ? parseGridColsUtilityCount(tailwindFromClassName.twGridCols)
        ?? parseGridColsUtilityCount(className)
      : resolveGridColumnCountFromTracks(className)
        ?? parseGridColsUtilityCount(tailwindFromClassName.twGridCols)
        ?? parseGridColsUtilityCount(className);

    if (fromClassName && fromClassName > 0) {
      return fromClassName;
    }

    const fromWidths = parseLayoutGridColumnWidths(props[LAYOUT_GRID_COLUMN_WIDTHS_PROP]);
    if (fromWidths && fromWidths.length > 0) {
      return fromWidths.length;
    }

    return fallbackColumnCount;
  };

  const commitLayout = (
    className: string,
    widths: LayoutGridColumnWidth[] | null,
    nextDirection: LayoutGridDirection,
  ): DesignerNode => {
    const nextClassName = applyLayoutGridClassName(className, nextDirection, widths, fallbackColumnCount);
    const tailwindProps = syncTailwindPropKeys(nextClassName);
    const slotCount = widths?.length ?? fallbackColumnCount;

    return {
      ...node,
      props: {
        ...props,
        className: nextClassName,
        ...tailwindProps,
        [LAYOUT_GRID_DIRECTION_PROP]: nextDirection,
        ...(nextDirection === 'column' && slotCount > 0
          ? { twGridCols: `grid-cols-${slotCount}` }
          : {}),
      },
    };
  };

  if (changedKey === LAYOUT_GRID_DIRECTION_PROP) {
    const className = typeof props.className === 'string' ? props.className : '';
    const widths = parseLayoutGridColumnWidths(props[LAYOUT_GRID_COLUMN_WIDTHS_PROP])
      ?? parseLayoutGridColumnWidthsFromClassName(className)
      ?? createDefaultLayoutGridColumnWidths(resolveSlotCount(className));
    return commitLayout(className, widths, direction);
  }

  if (changedKey === LAYOUT_GRID_COLUMN_WIDTHS_PROP) {
    const widths = parseLayoutGridColumnWidths(props[LAYOUT_GRID_COLUMN_WIDTHS_PROP]);
    if (!widths || direction === 'column') {
      return node;
    }

    const className = typeof props.className === 'string' ? props.className : '';
    return commitLayout(className, widths, direction);
  }

  if (changedKey === 'className') {
    const className = typeof props.className === 'string' ? props.className : '';
    const nextCount = resolveSlotCount(className);

    if (!nextCount || nextCount <= 0) {
      return node;
    }

    const currentWidths = parseLayoutGridColumnWidths(props[LAYOUT_GRID_COLUMN_WIDTHS_PROP])
      ?? parseLayoutGridColumnWidthsFromClassName(className);
    const nextWidths = resizeLayoutGridColumnWidths(currentWidths, nextCount);
    props[LAYOUT_GRID_COLUMN_WIDTHS_PROP] = serializeLayoutGridColumnWidths(nextWidths);
    return commitLayout(className, nextWidths, direction);
  }

  return node;
};
