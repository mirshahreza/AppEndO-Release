import type { CSSProperties, PointerEvent } from 'react';
import {
  buildAppTableGridColumnWidthStyle,
  resolveColumnMinWidthPx,
  resolveColumnWidthPx,
  setColumnWidth,
  type GridColumnLayoutState,
} from '../../shared/lib/appTableGridColumnLayout';
import type { AppTableGridColumnDef } from '../../shared/lib/appTableGridQuery';
import { measureAppTableGridColumnAutoWidth } from '../../shared/lib/appTableGridColumnAutoWidth';
import {
  resolveAppTableGridColumnDirectionChrome,
  type AppTableGridColumnTextDirection,
} from '../../shared/lib/appTableGridColumnTextDirection';

export const TREE_GRID_ID_COLUMN_ID = '__tree_grid_id__';

export function resolveTreeGridIdColumnDirectionChrome(cultureDirection: 'ltr' | 'rtl') {
  return resolveAppTableGridColumnDirectionChrome({ textDirection: 'culture' }, cultureDirection);
}

export function resolveTreeGridNodeColumnDirectionChrome(cultureDirection: 'ltr' | 'rtl') {
  return resolveAppTableGridColumnDirectionChrome({ textDirection: 'culture' }, cultureDirection);
}

export function resolveTreeGridDataColumnDirectionChrome(
  column: {
    headerClassName?: string;
    className?: string;
    textDirection?: AppTableGridColumnTextDirection;
  },
  cultureDirection: 'ltr' | 'rtl',
) {
  return resolveAppTableGridColumnDirectionChrome({
    textDirection: column.textDirection,
    headerClassName: column.headerClassName,
    cellClassName: column.className,
  }, cultureDirection);
}
export const TREE_GRID_NODE_COLUMN_ID = '__tree_grid_node__';

export function buildTreeGridLayoutColumnDefs(
  input: {
    showIdColumn: boolean;
    nodeColumnHeader: string;
    columns: ReadonlyArray<{ key: string; header: string; resizable?: boolean }>;
  },
): AppTableGridColumnDef<unknown>[] {
  const defs: AppTableGridColumnDef<unknown>[] = [];
  if (input.showIdColumn) {
    defs.push({
      id: TREE_GRID_ID_COLUMN_ID,
      label: 'Id',
      width: 125,
      layout: { hideable: false, resizable: true, reorderable: false },
    });
  }
  defs.push({
    id: TREE_GRID_NODE_COLUMN_ID,
    label: input.nodeColumnHeader,
    layout: { hideable: false, resizable: true, reorderable: false },
  });
  for (const column of input.columns) {
    const isActions = column.key === 'actions';
    defs.push({
      id: column.key,
      label: column.header,
      layout: {
        hideable: false,
        resizable: !isActions && column.resizable !== false,
        reorderable: false,
      },
    });
  }
  return defs;
}

export function treeGridColumnWidthStyle(
  column: AppTableGridColumnDef<unknown>,
  layout: GridColumnLayoutState,
  fallback?: CSSProperties,
): CSSProperties | undefined {
  const widthPx = resolveColumnWidthPx(column, layout);
  if (widthPx != null) {
    const widthStyle = buildAppTableGridColumnWidthStyle(
      { ...column, width: widthPx },
      layout,
    );
    return {
      ...widthStyle,
      width: `${widthPx}px`,
      minWidth: widthStyle?.minWidth != null
        ? (typeof widthStyle.minWidth === 'number' ? `${widthStyle.minWidth}px` : widthStyle.minWidth)
        : `${widthPx}px`,
      maxWidth: `${widthPx}px`,
    };
  }
  const minOnly = buildAppTableGridColumnWidthStyle(column, layout);
  if (minOnly) {
    return minOnly;
  }
  return fallback;
}

export function createTreeGridResizeHandler(input: {
  getLayout: () => GridColumnLayoutState;
  layoutColumns: ReadonlyArray<AppTableGridColumnDef<unknown>>;
  onLayoutChange: (next: GridColumnLayoutState) => void;
}): (columnId: string, event: PointerEvent<HTMLSpanElement>) => void {
  const columnById = new Map(input.layoutColumns.map((column) => [column.id, column]));

  return (columnId, event) => {
    const column = columnById.get(columnId);
    if (!column || column.layout === false || column.layout?.resizable === false) {
      return;
    }

    const headerCell = event.currentTarget.closest('th');
    const resizeHandle = event.currentTarget;
    if (!headerCell) {
      return;
    }

    event.preventDefault();
    resizeHandle.setPointerCapture(event.pointerId);

    const rtl = getComputedStyle(headerCell).direction === 'rtl';
    const startWidth = headerCell.getBoundingClientRect().width;
    const state = { columnId, startX: event.clientX, startWidth };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - state.startX;
      const minWidthPx = resolveColumnMinWidthPx(column);
      const nextWidth = Math.max(
        minWidthPx,
        Math.round(state.startWidth + (rtl ? -delta : delta)),
      );
      input.onLayoutChange(setColumnWidth(input.getLayout(), state.columnId, nextWidth, minWidthPx));
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      resizeHandle.releasePointerCapture(upEvent.pointerId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };
}

export function createTreeGridColumnAutoFitHandler(input: {
  getRoot: () => HTMLElement | null;
  getLayout: () => GridColumnLayoutState;
  layoutColumns: ReadonlyArray<AppTableGridColumnDef<unknown>>;
  onLayoutChange: (next: GridColumnLayoutState) => void;
}): (columnId: string) => void {
  const columnById = new Map(input.layoutColumns.map((column) => [column.id, column]));

  return (columnId) => {
    const column = columnById.get(columnId);
    if (!column || column.layout === false || column.layout?.resizable === false) {
      return;
    }

    const minWidthPx = resolveColumnMinWidthPx(column);
    const nextWidth = measureAppTableGridColumnAutoWidth(input.getRoot(), columnId, minWidthPx);
    if (nextWidth == null) {
      return;
    }

    input.onLayoutChange(setColumnWidth(input.getLayout(), columnId, nextWidth, minWidthPx));
  };
}
