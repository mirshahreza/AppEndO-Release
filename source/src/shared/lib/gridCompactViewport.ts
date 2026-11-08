import type { AppTableGridColumnDef } from './appTableGridQuery';
import {
  DEFAULT_GRID_CARD_BELOW,
  resolveGridEffectivePresentation,
  type GridCardBelowTier,
  type GridEffectivePresentation,
  type GridPresentationMode,
} from './appTableGridPresentation';
import type { ViewportTier } from './viewportTokens';

/** Compact-viewport layout choice. `keep-table` leaves the grid as a table. */
export type GridCompactLayout = 'keep-table' | 'table-scroll' | 'cards';

export type GridCompactCardsPerRow = 1 | 2 | 3;

export type GridCompactTierOptions = {
  layout?: GridCompactLayout;
  /** Tablet card columns. Phone is always 1. */
  cardsPerRow?: GridCompactCardsPerRow;
  freezeFirstColumn?: boolean;
  collapseExtraFields?: boolean;
  visibleFieldCount?: number;
  showActions?: boolean;
  showMeta?: boolean;
};

export type GridCompactViewportConfig = {
  phone?: GridCompactTierOptions;
  tablet?: GridCompactTierOptions;
};

export type ResolvedGridCompactViewport = {
  layout: GridEffectivePresentation;
  cardsPerRow: GridCompactCardsPerRow;
  freezeFirstColumn: boolean;
  collapseExtraFields: boolean;
  visibleFieldCount: number;
  showActions: boolean;
  showMeta: boolean;
};

const DEFAULT_VISIBLE_FIELD_COUNT = 3;
/** Tablet list cards sit two-up. Phone is always 1. */
const DEFAULT_TABLET_CARDS_PER_ROW: GridCompactCardsPerRow = 2;
/** Desktop/wide card lists use two columns so the viewport is not a single stacked stream. */
const DEFAULT_DESKTOP_CARDS_PER_ROW: GridCompactCardsPerRow = 2;

export function layoutFromCompact(layout: GridCompactLayout | undefined): GridEffectivePresentation | undefined {
  if (!layout) {
    return undefined;
  }
  if (layout === 'keep-table') {
    return 'table';
  }
  return layout;
}

export function sanitizeCardsPerRow(value: unknown, fallback: GridCompactCardsPerRow): GridCompactCardsPerRow {
  if (value === 1 || value === 2 || value === 3) {
    return value;
  }
  if (value === '1' || value === '2' || value === '3') {
    return Number(value) as GridCompactCardsPerRow;
  }
  return fallback;
}

export function sanitizeVisibleFieldCount(value: unknown, fallback = DEFAULT_VISIBLE_FIELD_COUNT): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(12, Math.max(1, Math.round(numeric)));
}

export function partitionCardFields<T>(
  fields: ReadonlyArray<T>,
  collapseExtraFields: boolean,
  visibleFieldCount: number,
): { visible: ReadonlyArray<T>; extra: ReadonlyArray<T> } {
  if (!collapseExtraFields || fields.length <= visibleFieldCount) {
    return { visible: fields, extra: [] };
  }
  return {
    visible: fields.slice(0, visibleFieldCount),
    extra: fields.slice(visibleFieldCount),
  };
}

function isCompactTier(tier: ViewportTier): tier is 'phone' | 'tablet' {
  return tier === 'phone' || tier === 'tablet';
}

export function resolveGridCompactViewport(args: {
  presentation?: GridPresentationMode;
  cardBelow?: GridCardBelowTier;
  compact?: GridCompactViewportConfig;
  viewportTier: ViewportTier;
}): ResolvedGridCompactViewport {
  const presentation = args.presentation ?? 'auto';
  const cardBelow = args.cardBelow ?? DEFAULT_GRID_CARD_BELOW;
  const tierOptions = isCompactTier(args.viewportTier) ? args.compact?.[args.viewportTier] : undefined;
  const layout = layoutFromCompact(tierOptions?.layout)
    ?? resolveGridEffectivePresentation(presentation, args.viewportTier, cardBelow);

  const cardsPerRow = layout !== 'cards'
    ? 1
    : args.viewportTier === 'phone'
      ? 1
      : args.viewportTier === 'tablet'
        ? sanitizeCardsPerRow(tierOptions?.cardsPerRow, DEFAULT_TABLET_CARDS_PER_ROW)
        : sanitizeCardsPerRow(tierOptions?.cardsPerRow, DEFAULT_DESKTOP_CARDS_PER_ROW);

  const freezeFirstColumn = tierOptions?.freezeFirstColumn ?? layout === 'table-scroll';
  const collapseExtraFields = tierOptions?.collapseExtraFields === true;
  const visibleFieldCount = sanitizeVisibleFieldCount(tierOptions?.visibleFieldCount);
  const showActions = tierOptions?.showActions !== false;
  const showMeta = tierOptions?.showMeta !== false;

  return {
    layout,
    cardsPerRow,
    freezeFirstColumn,
    collapseExtraFields,
    visibleFieldCount,
    showActions,
    showMeta,
  };
}

export function freezeLeadingDataColumn<TRow>(
  columns: ReadonlyArray<AppTableGridColumnDef<TRow>>,
  enabled: boolean,
  skipColumnId?: string,
): ReadonlyArray<AppTableGridColumnDef<TRow>> {
  if (!enabled || columns.length === 0) {
    return columns;
  }

  const firstIndex = columns.findIndex((column) => column.id !== skipColumnId);
  if (firstIndex < 0) {
    return columns;
  }

  const first = columns[firstIndex];
  if (first.layout && first.layout !== false && first.layout.pinned === 'left') {
    return columns;
  }

  return columns.map((column, index) => {
    if (index !== firstIndex) {
      return column;
    }
    const layout = column.layout && column.layout !== false ? column.layout : {};
    return {
      ...column,
      layout: {
        ...layout,
        pinned: 'left' as const,
      },
    };
  });
}

function isInheritToken(value: unknown): boolean {
  return value == null || value === '' || value === 'inherit';
}

function parseCompactLayout(value: unknown): GridCompactLayout | undefined {
  if (value === 'keep-table' || value === 'table-scroll' || value === 'cards') {
    return value;
  }
  return undefined;
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (value === true || value === 'true' || value === 'on') {
    return true;
  }
  if (value === false || value === 'false' || value === 'off') {
    return false;
  }
  return undefined;
}

function compactTierFromShared(
  layout: GridCompactLayout | undefined,
  cardsPerRow: GridCompactCardsPerRow | undefined,
  freezeFirstColumn: boolean | undefined,
  collapseExtraFields: boolean | undefined,
  visibleFieldCount: number | undefined,
  showActions: boolean | undefined,
  showMeta: boolean | undefined,
): GridCompactTierOptions | undefined {
  const tier: GridCompactTierOptions = {};
  if (layout) {
    tier.layout = layout;
  }
  if (cardsPerRow) {
    tier.cardsPerRow = cardsPerRow;
  }
  if (freezeFirstColumn !== undefined) {
    tier.freezeFirstColumn = freezeFirstColumn;
  }
  if (collapseExtraFields !== undefined) {
    tier.collapseExtraFields = collapseExtraFields;
  }
  if (visibleFieldCount !== undefined && visibleFieldCount !== DEFAULT_VISIBLE_FIELD_COUNT) {
    tier.visibleFieldCount = visibleFieldCount;
  }
  if (showActions === false) {
    tier.showActions = false;
  }
  if (showMeta === false) {
    tier.showMeta = false;
  }
  return Object.keys(tier).length > 0 ? tier : undefined;
}

/** Parse flat Designer / demo props into the shared compact config. */
export function parseGridCompactFromProps(props: Record<string, unknown>): GridCompactViewportConfig | undefined {
  const phoneLayout = parseCompactLayout(isInheritToken(props.compactPhoneLayout) ? undefined : props.compactPhoneLayout);
  const tabletLayout = parseCompactLayout(isInheritToken(props.compactTabletLayout) ? undefined : props.compactTabletLayout);
  const tabletCardsPerRow = isInheritToken(props.compactTabletCardsPerRow)
    ? undefined
    : sanitizeCardsPerRow(props.compactTabletCardsPerRow, DEFAULT_TABLET_CARDS_PER_ROW);
  const freezeFirstColumn = isInheritToken(props.compactFreezeFirstColumn)
    ? undefined
    : parseOptionalBoolean(props.compactFreezeFirstColumn);
  const collapseExtraFields = isInheritToken(props.compactCollapseExtraFields)
    ? undefined
    : parseOptionalBoolean(props.compactCollapseExtraFields);
  const visibleFieldCount = isInheritToken(props.compactVisibleFieldCount)
    ? undefined
    : sanitizeVisibleFieldCount(props.compactVisibleFieldCount);
  const showActions = isInheritToken(props.compactShowActions)
    ? undefined
    : parseOptionalBoolean(props.compactShowActions);
  const showMeta = isInheritToken(props.compactShowMeta)
    ? undefined
    : parseOptionalBoolean(props.compactShowMeta);

  const phone = compactTierFromShared(
    phoneLayout,
    undefined,
    freezeFirstColumn,
    collapseExtraFields,
    visibleFieldCount,
    showActions,
    showMeta,
  );
  const tablet = compactTierFromShared(
    tabletLayout,
    tabletCardsPerRow,
    freezeFirstColumn,
    collapseExtraFields,
    visibleFieldCount,
    showActions,
    showMeta,
  );

  if (!phone && !tablet) {
    return undefined;
  }
  return { phone, tablet };
}

function serializeTierJsx(tier: GridCompactTierOptions | undefined): string | null {
  if (!tier) {
    return null;
  }
  const parts: string[] = [];
  if (tier.layout) {
    parts.push(`layout: ${JSON.stringify(tier.layout)}`);
  }
  if (tier.cardsPerRow) {
    parts.push(`cardsPerRow: ${tier.cardsPerRow}`);
  }
  if (tier.freezeFirstColumn !== undefined) {
    parts.push(`freezeFirstColumn: ${tier.freezeFirstColumn}`);
  }
  if (tier.collapseExtraFields !== undefined) {
    parts.push(`collapseExtraFields: ${tier.collapseExtraFields}`);
  }
  if (tier.visibleFieldCount !== undefined) {
    parts.push(`visibleFieldCount: ${tier.visibleFieldCount}`);
  }
  if (tier.showActions !== undefined) {
    parts.push(`showActions: ${tier.showActions}`);
  }
  if (tier.showMeta !== undefined) {
    parts.push(`showMeta: ${tier.showMeta}`);
  }
  if (parts.length === 0) {
    return null;
  }
  return `{ ${parts.join(', ')} }`;
}

export function serializeGridCompactJsx(compact: GridCompactViewportConfig | undefined): string | null {
  if (!compact) {
    return null;
  }
  const parts: string[] = [];
  const phone = serializeTierJsx(compact.phone);
  const tablet = serializeTierJsx(compact.tablet);
  if (phone) {
    parts.push(`phone: ${phone}`);
  }
  if (tablet) {
    parts.push(`tablet: ${tablet}`);
  }
  if (parts.length === 0) {
    return null;
  }
  return `{ ${parts.join(', ')} }`;
}

export const GRID_COMPACT_DESIGNER_PROP_KEYS = [
  'compactPhoneLayout',
  'compactTabletLayout',
  'compactTabletCardsPerRow',
  'compactFreezeFirstColumn',
  'compactCollapseExtraFields',
  'compactVisibleFieldCount',
  'compactShowActions',
  'compactShowMeta',
] as const;
