import type { CSSProperties } from 'react';
import type { AppTableGridColumnDef } from './appTableGridQuery';
import {
  resolveColumnLayoutOptions,
  resolveColumnWidthPx,
  type GridColumnLayoutState,
  EMPTY_COLUMN_LAYOUT,
} from './appTableGridColumnLayout';

export type GridColumnPinSide = 'left' | 'right';

const DEFAULT_PIN_WIDTH_PX = 140;
const PIN_Z_INDEX_BASE = 20;

const resolveWidthPx = <TRow,>(
  column: AppTableGridColumnDef<TRow>,
  layout: GridColumnLayoutState,
): number => resolveColumnWidthPx(column, layout) ?? (
  typeof column.width === 'number'
    ? column.width
    : typeof column.width === 'string'
      ? (Number.parseFloat(column.width) || DEFAULT_PIN_WIDTH_PX)
      : DEFAULT_PIN_WIDTH_PX
);

/**
 * Compute sticky pin offsets for visible columns. Offsets accumulate toward inline-start for
 * `pinned: 'left'` and toward inline-end for `pinned: 'right'` so multiple frozen columns stack.
 * Uses `insetInlineStart` / `insetInlineEnd` so pins stay on the culture start/end edge in RTL grids.
 */
export const resolvePinnedColumnStyles = <TRow,>(
  columns: ReadonlyArray<AppTableGridColumnDef<TRow>>,
  layout: GridColumnLayoutState = EMPTY_COLUMN_LAYOUT,
): Map<string, CSSProperties> => {
  const styles = new Map<string, CSSProperties>();
  const leftPinned: AppTableGridColumnDef<TRow>[] = [];
  const rightPinned: AppTableGridColumnDef<TRow>[] = [];

  for (const column of columns) {
    const options = resolveColumnLayoutOptions(column.layout);
    if (options.pinned === 'left') {
      leftPinned.push(column);
    } else if (options.pinned === 'right') {
      rightPinned.push(column);
    }
  }

  let leftOffset = 0;
  leftPinned.forEach((column, index) => {
    const width = resolveWidthPx(column, layout);
    styles.set(column.id, {
      position: 'sticky',
      insetInlineStart: leftOffset,
      zIndex: PIN_Z_INDEX_BASE + leftPinned.length - index,
      background: 'var(--app-table-grid-pin-bg, #ffffff)',
    });
    leftOffset += width;
  });

  let rightOffset = 0;
  for (let index = rightPinned.length - 1; index >= 0; index -= 1) {
    const column = rightPinned[index]!;
    const width = resolveWidthPx(column, layout);
    styles.set(column.id, {
      position: 'sticky',
      insetInlineEnd: rightOffset,
      zIndex: PIN_Z_INDEX_BASE + rightPinned.length - index,
      background: 'var(--app-table-grid-pin-bg, #ffffff)',
    });
    rightOffset += width;
  }

  return styles;
};

export const mergePinnedCellStyle = (
  base: CSSProperties | undefined,
  pinned: CSSProperties | undefined,
): CSSProperties | undefined => {
  if (!base && !pinned) {
    return undefined;
  }
  return { ...base, ...pinned };
};
