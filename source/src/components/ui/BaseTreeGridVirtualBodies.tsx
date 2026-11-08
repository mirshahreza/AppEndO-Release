import React, { useLayoutEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  GRID_VIRTUAL_OVERSCAN,
  TREE_GRID_ROW_ESTIMATE_PX,
} from '../../shared/lib/gridVirtualizationConstants';

export function findTreeGridScrollParent(start: HTMLElement | null): HTMLElement | null {
  let node: HTMLElement | null = start;
  while (node) {
    const { overflowY } = window.getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

export function useTreeGridScrollParent(scrollAnchorRef: React.RefObject<HTMLDivElement | null>) {
  return React.useCallback(
    () => findTreeGridScrollParent(scrollAnchorRef.current?.parentElement ?? scrollAnchorRef.current),
    [scrollAnchorRef],
  );
}

type TreeGridVirtualPaddingProps = {
  colSpan: number;
  /** Spacer above the visible window — render before virtual rows. */
  paddingTop?: number;
  /** Spacer below the visible window — render after virtual rows. */
  paddingBottom?: number;
};

export function TreeGridVirtualTablePadding({
  colSpan,
  paddingTop = 0,
  paddingBottom = 0,
}: TreeGridVirtualPaddingProps) {
  return (
    <>
      {paddingTop > 0 ? (
        <tr aria-hidden="true">
          <td colSpan={colSpan} style={{ height: paddingTop, padding: 0, border: 0 }} />
        </tr>
      ) : null}
      {paddingBottom > 0 ? (
        <tr aria-hidden="true">
          <td colSpan={colSpan} style={{ height: paddingBottom, padding: 0, border: 0 }} />
        </tr>
      ) : null}
    </>
  );
}

type UseTreeGridRowVirtualizerOptions = {
  rowCount: number;
  enabled: boolean;
  getScrollElement: () => HTMLElement | null;
  /** Stable primitive that changes when row layout / expansion should be re-measured. */
  remeasureToken: string | number;
};

export function useTreeGridRowVirtualizer({
  rowCount,
  enabled,
  getScrollElement,
  remeasureToken,
}: UseTreeGridRowVirtualizerOptions) {
  const rowVirtualizer = useVirtualizer({
    count: enabled ? rowCount : 0,
    getScrollElement: () => (enabled ? getScrollElement() : null),
    estimateSize: () => TREE_GRID_ROW_ESTIMATE_PX,
    overscan: GRID_VIRTUAL_OVERSCAN,
    measureElement: (element) => (
      element?.getBoundingClientRect().height ?? TREE_GRID_ROW_ESTIMATE_PX
    ),
  });

  useLayoutEffect(() => {
    if (!enabled) return;
    rowVirtualizer.measure();
    // Remeasure on row/expansion changes only (virtualizer identity omitted intentionally).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mirror AppTableGridVirtualColumnBody
  }, [enabled, remeasureToken, rowCount]);

  const virtualRows = enabled ? rowVirtualizer.getVirtualItems() : [];
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom = virtualRows.length > 0
    ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
    : 0;

  return {
    rowVirtualizer,
    virtualRows,
    paddingTop,
    paddingBottom,
  };
}

export function shouldVirtualizeTreeGridRows(
  _rowCount: number,
  _dragActive: boolean,
  _moveDisabled = false,
) {
  // Row virtualization stays off for tree grids: crossing the row threshold when branches
  // expand used to switch to a split header table and misalign columns (e.g. Base Info Active).
  // Render the full flattened tree in one table; sticky header + colgroup keep columns aligned.
  return false;
}

type TreeGridVirtualHybridPaddingProps = {
  /** Spacer above the visible window — render before virtual rows. */
  paddingTop?: number;
  /** Spacer below the visible window — render after virtual rows. */
  paddingBottom?: number;
};

export function TreeGridVirtualHybridPadding({
  paddingTop = 0,
  paddingBottom = 0,
}: TreeGridVirtualHybridPaddingProps) {
  return (
    <>
      {paddingTop > 0 ? <div aria-hidden="true" style={{ height: paddingTop }} /> : null}
      {paddingBottom > 0 ? <div aria-hidden="true" style={{ height: paddingBottom }} /> : null}
    </>
  );
}
