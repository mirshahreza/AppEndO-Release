import type { CSSProperties } from 'react';
import type { AppTableGridColumnDef } from './appTableGridQuery';

export const GRID_COLUMN_MIN_WIDTH = 48;

export function parseGridColumnWidthPx(width: number | string | undefined): number | undefined {
  if (typeof width === 'number') {
    return Number.isFinite(width) ? width : undefined;
  }
  if (typeof width === 'string') {
    const parsed = Number.parseFloat(width);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function resolveColumnMinWidthPx<TRow>(column: AppTableGridColumnDef<TRow>): number {
  const authored = parseGridColumnWidthPx(column.minWidth);
  return Math.max(GRID_COLUMN_MIN_WIDTH, authored ?? GRID_COLUMN_MIN_WIDTH);
}

export function buildAppTableGridColumnWidthStyle<TRow>(
  column: AppTableGridColumnDef<TRow>,
  layout?: GridColumnLayoutState,
): CSSProperties | undefined {
  const effectiveWidth = layout ? resolveColumnWidth(column, layout) : column.width;

  if (effectiveWidth == null && column.minWidth == null) {
    return undefined;
  }

  const style: CSSProperties = {};
  if (effectiveWidth != null) {
    style.width = effectiveWidth;
  }
  if (column.minWidth != null) {
    style.minWidth = column.minWidth;
  } else if (effectiveWidth != null) {
    style.minWidth = effectiveWidth;
  }
  if (column.maxWidth != null) {
    style.maxWidth = column.maxWidth;
  }
  return style;
}

export type GridColumnPinSide = 'left' | 'right';

export type GridColumnLayoutOptions = {
  hideable?: boolean;
  resizable?: boolean;
  reorderable?: boolean;
  /** Freeze column to the start/end of the horizontal scroll container. */
  pinned?: GridColumnPinSide;
};

export type GridColumnLayoutState = {
  order: string[];
  hidden: string[];
  widths: Record<string, number>;
};

export type GridColumnLayoutChangeMeta = {
  source: 'visibility' | 'reorder' | 'resize' | 'reset' | 'autoFit';
  columnId?: string;
};

export const EMPTY_COLUMN_LAYOUT: GridColumnLayoutState = {
  order: [],
  hidden: [],
  widths: {},
};

export function resolveColumnLayoutOptions(
  layout: AppTableGridColumnDef<unknown>['layout'],
): GridColumnLayoutOptions {
  if (layout === false) {
    return { hideable: false, resizable: false, reorderable: false };
  }
  return {
    hideable: layout?.hideable ?? true,
    resizable: layout?.resizable ?? true,
    reorderable: layout?.reorderable ?? true,
    ...(layout && typeof layout === 'object' && (layout.pinned === 'left' || layout.pinned === 'right')
      ? { pinned: layout.pinned }
      : {}),
  };
}

export function isColumnLayoutManaged(column: AppTableGridColumnDef<unknown>): boolean {
  return column.layout !== false;
}

export function createDefaultColumnLayout<TRow>(
  columns: ReadonlyArray<AppTableGridColumnDef<TRow>>,
): GridColumnLayoutState {
  return {
    order: columns.filter(isColumnLayoutManaged).map((column) => column.id),
    hidden: [],
    widths: {},
  };
}

export function buildColumnLayoutDefinitionSignature<TRow>(
  columns: ReadonlyArray<AppTableGridColumnDef<TRow>>,
): string {
  const layoutOptions = columns.map((column) => {
    const options = resolveColumnLayoutOptions(column.layout);
    return `${column.id}:${options.hideable ? 1 : 0}:${options.resizable ? 1 : 0}:${options.reorderable ? 1 : 0}`;
  }).join('\0');
  const definitionOrder = columns.map((column) => column.id).join(',');
  return `${layoutOptions}|${definitionOrder}`;
}

/** When column hide/reorder is off, keep only persisted resize widths — not stored order/hidden. */
export function mergeStoredColumnLayoutWidths<TRow>(
  stored: GridColumnLayoutState | null | undefined,
  columns: ReadonlyArray<AppTableGridColumnDef<TRow>>,
): GridColumnLayoutState {
  const defaultLayout = createDefaultColumnLayout(columns);
  if (!stored) {
    return defaultLayout;
  }
  return sanitizeColumnLayout(
    {
      order: defaultLayout.order,
      hidden: defaultLayout.hidden,
      widths: stored.widths,
    },
    columns,
  );
}

export function sanitizeColumnLayout<TRow>(
  layout: GridColumnLayoutState,
  columns: ReadonlyArray<AppTableGridColumnDef<TRow>>,
): GridColumnLayoutState {
  const managedColumns = columns.filter(isColumnLayoutManaged);
  const managedIds = new Set(managedColumns.map((column) => column.id));
  const nonHideableIds = new Set(
    managedColumns
      .filter((column) => !resolveColumnLayoutOptions(column.layout).hideable)
      .map((column) => column.id),
  );

  const order: string[] = [];
  for (const columnId of layout.order) {
    if (managedIds.has(columnId) && !order.includes(columnId)) {
      order.push(columnId);
    }
  }
  for (const column of managedColumns) {
    if (!order.includes(column.id)) {
      const defIndex = managedColumns.findIndex((entry) => entry.id === column.id);
      let insertAt = order.length;

      for (let index = defIndex + 1; index < managedColumns.length; index += 1) {
        const nextOrderIndex = order.indexOf(managedColumns[index].id);
        if (nextOrderIndex >= 0) {
          insertAt = nextOrderIndex;
          break;
        }
      }

      order.splice(insertAt, 0, column.id);
    }
  }

  let hidden = layout.hidden.filter(
    (columnId) => managedIds.has(columnId) && !nonHideableIds.has(columnId),
  );

  const visibleManagedCount = order.filter((columnId) => !hidden.includes(columnId)).length;
  if (visibleManagedCount === 0 && order.length > 0) {
    const fallbackColumnId = order.find((columnId) => nonHideableIds.has(columnId)) ?? order[0];
    hidden = hidden.filter((columnId) => columnId !== fallbackColumnId);
  }

  const widths: Record<string, number> = {};
  for (const [columnId, width] of Object.entries(layout.widths)) {
    if (!managedIds.has(columnId)) {
      continue;
    }
    const column = managedColumns.find((entry) => entry.id === columnId);
    if (column && !resolveColumnLayoutOptions(column.layout).resizable) {
      continue;
    }
    const minWidthPx = column ? resolveColumnMinWidthPx(column) : GRID_COLUMN_MIN_WIDTH;
    if (Number.isFinite(width) && width >= minWidthPx) {
      widths[columnId] = Math.round(width);
    }
  }

  return { order, hidden, widths };
}

export function resolveColumnWidth<TRow>(
  column: AppTableGridColumnDef<TRow>,
  layout: GridColumnLayoutState,
): number | string | undefined {
  const override = layout.widths[column.id];
  if (override != null) {
    return override;
  }
  return column.width;
}

export function resolveColumnWidthPx<TRow>(
  column: AppTableGridColumnDef<TRow>,
  layout: GridColumnLayoutState,
): number | undefined {
  return parseGridColumnWidthPx(resolveColumnWidth(column, layout));
}

export function applyColumnWidths<TRow>(
  columns: ReadonlyArray<AppTableGridColumnDef<TRow>>,
  layout: GridColumnLayoutState,
): AppTableGridColumnDef<TRow>[] {
  const sanitized = sanitizeColumnLayout(layout, columns);
  return columns.map((column) => {
    if (!isColumnLayoutManaged(column) || !resolveColumnLayoutOptions(column.layout).resizable) {
      return column;
    }
    return {
      ...column,
      width: resolveColumnWidth(column, sanitized),
    };
  });
}

export function applyColumnLayout<TRow>(
  columns: ReadonlyArray<AppTableGridColumnDef<TRow>>,
  layout: GridColumnLayoutState,
): AppTableGridColumnDef<TRow>[] {
  const sanitized = sanitizeColumnLayout(layout, columns);
  const hiddenIds = new Set(sanitized.hidden);
  const columnById = new Map(columns.map((column) => [column.id, column]));

  const visibleManagedQueue = sanitized.order
    .filter((columnId) => !hiddenIds.has(columnId))
    .map((columnId) => columnById.get(columnId))
    .filter((column): column is AppTableGridColumnDef<TRow> => column != null)
    .map((column) => ({
      ...column,
      width: resolveColumnWidth(column, sanitized),
    }));

  let managedIndex = 0;
  const result: AppTableGridColumnDef<TRow>[] = [];

  for (const column of columns) {
    if (!isColumnLayoutManaged(column)) {
      result.push(column);
      continue;
    }
    const nextManaged = visibleManagedQueue[managedIndex];
    if (nextManaged) {
      result.push(nextManaged);
      managedIndex += 1;
    }
  }

  while (managedIndex < visibleManagedQueue.length) {
    result.push(visibleManagedQueue[managedIndex]);
    managedIndex += 1;
  }

  return result;
}

export function getColumnLayoutLabel(column: AppTableGridColumnDef<unknown>): string {
  if (typeof column.label === 'string' && column.label.trim()) {
    return column.label;
  }
  if (column.id === 'actions') {
    return 'Actions';
  }
  return column.id;
}

export function toggleColumnVisibility(
  layout: GridColumnLayoutState,
  columnId: string,
  visible: boolean,
): GridColumnLayoutState {
  const hidden = new Set(layout.hidden);
  if (visible) {
    hidden.delete(columnId);
  } else {
    hidden.add(columnId);
  }
  return { ...layout, hidden: [...hidden] };
}

export function reorderColumn(
  layout: GridColumnLayoutState,
  activeId: string,
  overId: string,
): GridColumnLayoutState {
  if (activeId === overId) {
    return layout;
  }
  const order = [...layout.order];
  const activeIndex = order.indexOf(activeId);
  const overIndex = order.indexOf(overId);
  if (activeIndex < 0 || overIndex < 0) {
    return layout;
  }
  order.splice(activeIndex, 1);
  order.splice(overIndex, 0, activeId);
  return { ...layout, order };
}

export function setColumnWidth(
  layout: GridColumnLayoutState,
  columnId: string,
  width: number,
  minimumWidthPx = GRID_COLUMN_MIN_WIDTH,
): GridColumnLayoutState {
  const nextWidth = Math.max(minimumWidthPx, Math.round(width));
  return {
    ...layout,
    widths: { ...layout.widths, [columnId]: nextWidth },
  };
}

export function resetColumnLayout<TRow>(
  columns: ReadonlyArray<AppTableGridColumnDef<TRow>>,
): GridColumnLayoutState {
  return createDefaultColumnLayout(columns);
}

export function areColumnLayoutsEqual(
  left: GridColumnLayoutState,
  right: GridColumnLayoutState,
): boolean {
  if (left.hidden.length !== right.hidden.length) {
    return false;
  }
  const leftHidden = [...left.hidden].sort();
  const rightHidden = [...right.hidden].sort();
  for (let index = 0; index < leftHidden.length; index += 1) {
    if (leftHidden[index] !== rightHidden[index]) {
      return false;
    }
  }

  if (left.order.length !== right.order.length) {
    return false;
  }
  for (let index = 0; index < left.order.length; index += 1) {
    if (left.order[index] !== right.order[index]) {
      return false;
    }
  }

  const leftWidthKeys = Object.keys(left.widths).sort();
  const rightWidthKeys = Object.keys(right.widths).sort();
  if (leftWidthKeys.length !== rightWidthKeys.length) {
    return false;
  }
  for (let index = 0; index < leftWidthKeys.length; index += 1) {
    const key = leftWidthKeys[index];
    if (key !== rightWidthKeys[index]) {
      return false;
    }
    if (left.widths[key] !== right.widths[key]) {
      return false;
    }
  }

  return true;
}
