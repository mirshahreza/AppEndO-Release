import type {
  DashboardLayoutBlockId,
  DashboardWidgetId,
  DashboardWidgetSizes,
} from '../../shared/lib/userDashboardLayout';
import {
  clampDashboardWidgetStart,
  isDashboardWidgetSpan,
  isDashboardWidgetStart,
} from '../../shared/lib/userDashboardLayout';

export type DashboardWidgetLayoutSpan = 'full' | 'wide' | 'half' | 'narrow' | 'compact';

/** 12-column Home grid: full 12 · wide 8 · half 6 · narrow 4 · compact 3. */
export const DASHBOARD_LAYOUT_COLUMNS = 12;

export const DASHBOARD_SPAN_UNITS: Record<DashboardWidgetLayoutSpan, number> = {
  full: 12,
  wide: 8,
  half: 6,
  narrow: 4,
  compact: 3,
};

/**
 * Default width when the operator has not resized the tile yet.
 * Compact chips stay small; lists and plans take the wider bands.
 */
export const DASHBOARD_WIDGET_LAYOUT_SPAN: Record<DashboardLayoutBlockId, DashboardWidgetLayoutSpan> = {
  kpi: 'half',
  insights: 'half',
  'my-inbox': 'half',
  feedback: 'half',
  health: 'half',
  'quick-actions': 'half',
  'my-links': 'half',
  'my-shortcuts': 'half',
};

export const DASHBOARD_COL_SPAN_CLASS: Record<number, string> = {
  3: 'lg:col-span-3',
  4: 'lg:col-span-4',
  5: 'lg:col-span-5',
  6: 'lg:col-span-6',
  7: 'lg:col-span-7',
  8: 'lg:col-span-8',
  9: 'lg:col-span-9',
  10: 'lg:col-span-10',
  11: 'lg:col-span-11',
  12: 'lg:col-span-12',
};

export const DASHBOARD_WIDGET_MIN_HEIGHT_CLASS: Record<DashboardWidgetLayoutSpan, string> = {
  full: 'min-h-[10rem]',
  wide: 'min-h-[16rem]',
  half: 'min-h-[14rem]',
  narrow: 'min-h-[12rem]',
  compact: 'min-h-[7rem]',
};

export const DASHBOARD_UNIFORM_BAND_CLASS = 'grid grid-cols-1 items-start lg:grid-cols-12';

export const resolveDashboardWidgetLayoutSpanFromUnits = (
  units: number,
): DashboardWidgetLayoutSpan => {
  if (units >= 12) {
    return 'full';
  }
  if (units >= 8) {
    return 'wide';
  }
  if (units >= 6) {
    return 'half';
  }
  if (units >= 4) {
    return 'narrow';
  }
  return 'compact';
};

export const resolveDashboardWidgetLayoutSpan = (
  blockId: DashboardWidgetId,
  sizes?: DashboardWidgetSizes,
  fallbackUnits?: number,
): DashboardWidgetLayoutSpan => {
  const stored = sizes?.[blockId]?.span;
  if (isDashboardWidgetSpan(stored)) {
    return resolveDashboardWidgetLayoutSpanFromUnits(stored);
  }
  if (fallbackUnits != null) {
    return resolveDashboardWidgetLayoutSpanFromUnits(fallbackUnits);
  }
  if (isLegacyDashboardWidgetId(blockId)) {
    return DASHBOARD_WIDGET_LAYOUT_SPAN[blockId];
  }
  return 'half';
};

function isLegacyDashboardWidgetId(blockId: DashboardWidgetId): blockId is DashboardLayoutBlockId {
  return blockId in DASHBOARD_WIDGET_LAYOUT_SPAN;
}

export const resolveDashboardSpanUnits = (
  blockId: DashboardWidgetId,
  sizes?: DashboardWidgetSizes,
  fallbackUnits?: number,
): number => {
  const stored = sizes?.[blockId]?.span;
  if (isDashboardWidgetSpan(stored)) {
    return stored;
  }
  if (fallbackUnits != null) {
    return fallbackUnits;
  }
  if (isLegacyDashboardWidgetId(blockId)) {
    return DASHBOARD_SPAN_UNITS[DASHBOARD_WIDGET_LAYOUT_SPAN[blockId]];
  }
  return DASHBOARD_SPAN_UNITS.half;
};

export const resolveDashboardWidgetStart = (
  blockId: DashboardWidgetId,
  sizes: DashboardWidgetSizes | undefined,
  span: number,
): number | undefined => {
  const stored = sizes?.[blockId]?.start;
  if (!isDashboardWidgetStart(stored)) {
    return undefined;
  }
  return clampDashboardWidgetStart(stored, span);
};

export const resolveDashboardWidgetColSpanClass = (
  blockId: DashboardWidgetId,
  sizes?: DashboardWidgetSizes,
  fallbackUnits?: number,
): string => DASHBOARD_COL_SPAN_CLASS[resolveDashboardSpanUnits(blockId, sizes, fallbackUnits)] ?? 'lg:col-span-6';

export const resolveDashboardWidgetMinHeightClass = (
  blockId: DashboardWidgetId,
  sizes?: DashboardWidgetSizes,
  fallbackUnits?: number,
): string => DASHBOARD_WIDGET_MIN_HEIGHT_CLASS[resolveDashboardWidgetLayoutSpan(blockId, sizes, fallbackUnits)];

export type DashboardUniformLayoutRow = {
  type: 'band';
  ids: DashboardWidgetId[];
};

export const packDashboardUniformBands = (
  ids: DashboardWidgetId[],
  sizes?: DashboardWidgetSizes,
  fallbackSpanById?: Partial<Record<string, number>>,
): DashboardUniformLayoutRow[] => {
  const rows: DashboardUniformLayoutRow[] = [];
  let current: DashboardWidgetId[] = [];
  let used = 0;

  const flush = () => {
    if (current.length === 0) {
      return;
    }
    rows.push({ type: 'band', ids: current });
    current = [];
    used = 0;
  };

  for (const id of ids) {
    const units = resolveDashboardSpanUnits(id, sizes, fallbackSpanById?.[id]);
    if (used > 0 && used + units > DASHBOARD_LAYOUT_COLUMNS) {
      flush();
    }
    current.push(id);
    used += units;
    if (used >= DASHBOARD_LAYOUT_COLUMNS) {
      flush();
    }
  }

  flush();
  return rows;
};

export const buildDashboardUniformLayoutRows = (
  widgetOrder: DashboardWidgetId[],
  sizes?: DashboardWidgetSizes,
  fallbackSpanById?: Partial<Record<string, number>>,
): DashboardUniformLayoutRow[] => packDashboardUniformBands(widgetOrder, sizes, fallbackSpanById);
