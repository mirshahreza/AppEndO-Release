import React, { useLayoutEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '../../lib/utils';
import type { AppTableGridColumnDef } from '../lib/appTableGridQuery';
import type { AppTableGridChrome } from '../lib/appTableGridShell';
import { isAppTableGridHeroChrome } from '../lib/appTableGridShell';
import {
  GRID_HERO_TABLE_ROW_ESTIMATE_PX,
  GRID_TABLE_ROW_ESTIMATE_PX,
  GRID_VIRTUAL_OVERSCAN,
} from '../lib/gridVirtualizationConstants';
import { AppTableGridRow } from './AppTableGridRow';

type AppTableGridVirtualColumnBodyProps<TRow> = {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  columns: ReadonlyArray<AppTableGridColumnDef<TRow>>;
  displayRows: ReadonlyArray<TRow>;
  getRowKey: (row: TRow) => string | number;
  onRowClick?: (row: TRow) => void;
  getRowClassName?: (row: TRow) => string | undefined;
  pinnedStyles?: ReadonlyMap<string, React.CSSProperties>;
  chrome?: AppTableGridChrome;
};

export function AppTableGridVirtualColumnBody<TRow>({
  scrollRef,
  columns,
  displayRows,
  getRowKey,
  onRowClick,
  getRowClassName,
  pinnedStyles,
  chrome,
}: AppTableGridVirtualColumnBodyProps<TRow>) {
  const rowVirtualizer = useVirtualizer({
    count: displayRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => (
      isAppTableGridHeroChrome(chrome) ? GRID_HERO_TABLE_ROW_ESTIMATE_PX : GRID_TABLE_ROW_ESTIMATE_PX
    ),
    overscan: GRID_VIRTUAL_OVERSCAN,
    measureElement: (element) => element.getBoundingClientRect().height,
  });

  useLayoutEffect(() => {
    rowVirtualizer.measure();
  }, [chrome, columns, displayRows]);

  const virtualRows = rowVirtualizer.getVirtualItems();
  const scrollHeight = scrollRef.current?.clientHeight ?? 0;
  const colSpan = Math.max(columns.length, 1);

  if (displayRows.length > 0 && (virtualRows.length === 0 || scrollHeight < 1)) {
    return (
      <>
        {displayRows.map((row, index) => (
          <AppTableGridRow
            key={getRowKey(row)}
            row={row}
            columns={columns}
            pinnedStyles={pinnedStyles}
            chrome={chrome}
            data-index={index}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn(onRowClick ? 'cursor-pointer' : undefined, getRowClassName?.(row))}
          />
        ))}
      </>
    );
  }
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom = virtualRows.length > 0
    ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
    : 0;

  return (
    <>
      {paddingTop > 0 ? (
        <tr aria-hidden="true">
          <td colSpan={colSpan} style={{ height: paddingTop, padding: 0, border: 0 }} />
        </tr>
      ) : null}
      {virtualRows.map((virtualRow) => {
        const row = displayRows[virtualRow.index];
        return (
          <AppTableGridRow
            key={getRowKey(row)}
            row={row}
            columns={columns}
            pinnedStyles={pinnedStyles}
            chrome={chrome}
            data-index={virtualRow.index}
            ref={rowVirtualizer.measureElement}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn(onRowClick ? 'cursor-pointer' : undefined, getRowClassName?.(row))}
          />
        );
      })}
      {paddingBottom > 0 ? (
        <tr aria-hidden="true">
          <td colSpan={colSpan} style={{ height: paddingBottom, padding: 0, border: 0 }} />
        </tr>
      ) : null}
    </>
  );
}
