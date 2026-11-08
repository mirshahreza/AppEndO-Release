import React, { forwardRef, memo, type CSSProperties } from 'react';
import { cn } from '../../lib/utils';
import { buildAppTableGridColumnWidthStyle } from '../lib/appTableGridColumnLayout';
import type { AppTableGridColumnDef } from '../lib/appTableGridQuery';
import { resolveAppTableGridCellClipAlign } from '../lib/appTableGridColumnAlign';
import { resolveAppTableGridColumnDirectionChrome } from '../lib/appTableGridColumnTextDirection';
import { useAppTableGridCultureDirection } from './AppTableGridCultureDirectionContext';
import { mergePinnedCellStyle } from '../lib/appTableGridPinnedColumns';
import type { AppTableGridChrome } from '../lib/appTableGridShell';
import { isAppTableGridHeroChrome } from '../lib/appTableGridShell';
import {
  APP_TABLE_GRID_BODY_CELL_CLASS,
  APP_TABLE_GRID_CELL_CLIP_CLASS,
  APP_TABLE_GRID_CELL_WRAP_CLASS,
  APP_TABLE_GRID_HERO_BODY_CELL_CLASS,
  APP_TABLE_GRID_LAST_COLUMN_OVERLAY_INSET_CELL_CLASS,
  APP_TABLE_GRID_ROW_CLASS,
  APP_TABLE_GRID_ROW_HOVER_GROUP_CLASS,
} from './surfaceClasses';
import { useAppTableGridScrollChrome } from './AppTableGridScrollChromeContext';

export type AppTableGridRowProps<TRow> = {
  row: TRow;
  columns: ReadonlyArray<AppTableGridColumnDef<TRow>>;
  pinnedStyles?: ReadonlyMap<string, CSSProperties>;
  chrome?: AppTableGridChrome;
} & React.HTMLAttributes<HTMLTableRowElement>;

function AppTableGridRowInner<TRow>(
  {
    row,
    columns,
    pinnedStyles,
    chrome,
    className,
    ...rest
  }: AppTableGridRowProps<TRow>,
  ref: React.ForwardedRef<HTMLTableRowElement>,
) {
  const cultureDirection = useAppTableGridCultureDirection();
  const scrollChrome = useAppTableGridScrollChrome();
  return (
    <tr
      ref={ref}
      className={cn(APP_TABLE_GRID_ROW_CLASS, APP_TABLE_GRID_ROW_HOVER_GROUP_CLASS, className)}
      {...rest}
    >
      {columns.map((column, columnIndex) => {
        const isLastColumn = columnIndex === columns.length - 1;
        const widthStyle = buildAppTableGridColumnWidthStyle(column);
        const conditionalStyle = column.getCellStyle?.(row);
        const style = mergePinnedCellStyle(
          widthStyle || conditionalStyle ? { ...widthStyle, ...conditionalStyle } : undefined,
          pinnedStyles?.get(column.id),
        );
        const mergedStyle = style || conditionalStyle
          ? { ...style, ...conditionalStyle }
          : undefined;
        const CellTag = column.isRowHeader ? 'th' : 'td';
        const directionChrome = resolveAppTableGridColumnDirectionChrome(column, cultureDirection);
        const effectiveCellClassName = directionChrome.cellClassName ?? column.cellClassName;
        return (
          <CellTag
            key={column.id}
            dir={directionChrome.cellDir}
            className={cn(
              isAppTableGridHeroChrome(chrome)
                ? APP_TABLE_GRID_HERO_BODY_CELL_CLASS
                : APP_TABLE_GRID_BODY_CELL_CLASS,
              effectiveCellClassName,
              column.getCellClassName?.(row),
              isLastColumn
                && scrollChrome.lastColumnOverlayInset
                && APP_TABLE_GRID_LAST_COLUMN_OVERLAY_INSET_CELL_CLASS,
            )}
            style={mergedStyle}
            data-column-id={column.id}
            data-pinned={
              column.layout && typeof column.layout === 'object' && column.layout.pinned
                ? column.layout.pinned
                : undefined
            }
            scope={column.isRowHeader ? 'row' : undefined}
          >
            <div className={cn(
              column.wrap ? APP_TABLE_GRID_CELL_WRAP_CLASS : APP_TABLE_GRID_CELL_CLIP_CLASS,
              resolveAppTableGridCellClipAlign(effectiveCellClassName),
            )}>
              {column.renderCell(row)}
            </div>
          </CellTag>
        );
      })}
    </tr>
  );
}

const AppTableGridRowForwardRef = forwardRef(AppTableGridRowInner) as <TRow>(
  props: AppTableGridRowProps<TRow> & { ref?: React.ForwardedRef<HTMLTableRowElement> },
) => React.ReactElement | null;

export const AppTableGridRow = memo(AppTableGridRowForwardRef) as typeof AppTableGridRowForwardRef;
