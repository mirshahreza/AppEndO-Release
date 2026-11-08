import React, { memo } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useCultureT } from '../../core/culture/CultureContext';
import {
  APP_TABLE_GRID_CELL_CLIP_CLASS,
  APP_TABLE_GRID_CELL_PR_CLASS,
  APP_TABLE_GRID_ROW_HOVER_GROUP_CLASS,
} from '../../shared/ui/surfaceClasses';
import { useOptionalCulture } from '../../core/culture/CultureContext';
import { resolveAppTableGridCellClipAlign } from '../../shared/lib/appTableGridColumnAlign';
import type {
  AppTableGridColumnDirectionChrome,
  AppTableGridColumnTextDirection,
} from '../../shared/lib/appTableGridColumnTextDirection';
import { resolveTreeGridDataColumnDirectionChrome } from './baseTreeGridColumnLayout';
import type { TreeDropPosition } from '../../shared/types/tree';
import type { BaseTreeGridRow } from './BaseTreeGrid';
import {
  TREE_GRID_ID_COLUMN_ID,
  TREE_GRID_NODE_COLUMN_ID,
} from './baseTreeGridColumnLayout';

const TREE_INDENT = 20;
const DRAG_INTERACTIVE_SELECTOR = 'button, a, input, select, textarea, [data-no-drag]';

function dropLineInset(depth: number) {
  return depth * TREE_INDENT + 28;
}

function DropHintBadge({
  label,
  tone,
  className,
}: {
  label: string;
  tone: 'sibling' | 'child';
  className?: string;
}) {
  const toneClass = tone === 'child'
    ? 'bg-indigo-100 text-indigo-700 ring-indigo-200/80'
    : 'bg-cyan-100 text-cyan-700 ring-cyan-200/80';

  return (
    <span
      className={cn(
        'pointer-events-none absolute z-30 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1',
        toneClass,
        className,
      )}
    >
      {label}
    </span>
  );
}

type TreeGridColumn<T extends BaseTreeGridRow> = {
  key: string;
  header?: string;
  className?: string;
  headerClassName?: string;
  textDirection?: AppTableGridColumnTextDirection;
  style?: React.CSSProperties;
  renderCell: (row: T) => React.ReactNode;
};

export type BaseTreeGridTableRowProps<T extends BaseTreeGridRow> = {
  row: T;
  virtualIndex?: number;
  measureRef?: (element: HTMLTableRowElement | null) => void;
  showIdColumn: boolean;
  idColumnStyle?: React.CSSProperties;
  idColumnDirectionChrome: AppTableGridColumnDirectionChrome;
  nodeColumnDirectionChrome: AppTableGridColumnDirectionChrome;
  nodeColumnStyle?: React.CSSProperties;
  fieldColumns: Array<TreeGridColumn<T>>;
  actionColumn?: TreeGridColumn<T>;
  hideExpandControls: boolean;
  moveDisabled: boolean;
  isDropping: boolean;
  isExpanded: boolean;
  isLoadingChildren: boolean;
  isDragSource: boolean;
  isDropTarget: boolean;
  dropPosition: TreeDropPosition;
  rowClassName?: (row: T) => string;
  getNodeLabel: (row: T) => React.ReactNode;
  canClickRow: (row: T) => boolean;
  onToggleExpand: (row: T) => void;
  onRowClick?: (row: T) => void;
  onDragStart: (event: React.DragEvent<HTMLTableRowElement>, row: T) => void;
  onDragEnd: () => void;
  onDragOver: (event: React.DragEvent<HTMLTableRowElement>, row: T) => void;
  onDrop: (event: React.DragEvent<HTMLTableRowElement>, row: T) => void;
};

function BaseTreeGridTableRowInner<T extends BaseTreeGridRow>({
  row,
  virtualIndex,
  measureRef,
  showIdColumn,
  idColumnStyle,
  idColumnDirectionChrome,
  nodeColumnDirectionChrome,
  nodeColumnStyle,
  fieldColumns,
  actionColumn,
  hideExpandControls,
  moveDisabled,
  isDropping,
  isExpanded,
  isLoadingChildren,
  isDragSource,
  isDropTarget,
  dropPosition,
  rowClassName,
  getNodeLabel,
  canClickRow,
  onToggleExpand,
  onRowClick,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: BaseTreeGridTableRowProps<T>) {
  const t = useCultureT();
  const cultureDirection = useOptionalCulture()?.direction ?? 'ltr';
  const showDropBefore = isDropTarget && dropPosition === 'before';
  const showDropAfter = isDropTarget && dropPosition === 'after';
  const showDropInside = isDropTarget && dropPosition === 'inside';
  const siblingLineInset = dropLineInset(row.depth);
  const childPreviewInset = dropLineInset(row.depth + 1);

  return (
    <tr
      data-row-id={row.id}
      data-index={virtualIndex}
      ref={measureRef}
      draggable={!moveDisabled && !isDropping}
      onDragStart={(event) => onDragStart(event, row)}
      onDragEnd={onDragEnd}
      onDragOver={(event) => onDragOver(event, row)}
      onDrop={(event) => onDrop(event, row)}
      onClick={(event) => {
        if (!canClickRow(row)) return;
        if ((event.target as HTMLElement).closest(DRAG_INTERACTIVE_SELECTOR)) {
          return;
        }
        onRowClick?.(row);
      }}
      className={cn(
        APP_TABLE_GRID_ROW_HOVER_GROUP_CLASS,
        'relative transition-colors select-none',
        canClickRow(row) ? 'cursor-pointer' : !moveDisabled && !isDropping ? 'cursor-grab active:cursor-grabbing' : '',
        showDropInside ? 'bg-indigo-50/90 ring-2 ring-inset ring-indigo-400/70' : 'hover:bg-slate-50',
        isDragSource ? 'opacity-45' : '',
        rowClassName ? rowClassName(row) : '',
      )}
    >
      {showIdColumn ? (
        <td
          className={cn(
            APP_TABLE_GRID_CELL_PR_CLASS,
            'py-2 font-mono text-[11px] text-slate-500',
            idColumnDirectionChrome.cellClassName,
          )}
          dir={idColumnDirectionChrome.cellDir}
          style={idColumnStyle ?? { width: '125px', minWidth: '125px', maxWidth: '125px' }}
          data-column-id={TREE_GRID_ID_COLUMN_ID}
        >
          {row.id}
        </td>
      ) : null}
      <td
        className={cn(
          APP_TABLE_GRID_CELL_PR_CLASS,
          'relative overflow-visible py-2 text-slate-700',
          nodeColumnDirectionChrome.cellClassName,
        )}
        dir={nodeColumnDirectionChrome.cellDir}
        style={nodeColumnStyle}
        data-column-id={TREE_GRID_NODE_COLUMN_ID}
      >
        {showDropBefore ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20" aria-hidden="true">
            <div
              className="absolute top-0 h-[3px] bg-cyan-500 shadow-[0_0_0_1px_rgba(6,182,212,0.2)]"
              style={{ insetInlineStart: `${Math.max(0, siblingLineInset - 16)}px`, insetInlineEnd: 0 }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-cyan-500 ring-2 ring-white" />
            </div>
            <DropHintBadge label={t('tree.drop.before')} tone="sibling" className="start-2 top-1" />
          </div>
        ) : null}
        {showDropAfter ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20" aria-hidden="true">
            <div
              className="absolute bottom-0 h-[3px] bg-cyan-500 shadow-[0_0_0_1px_rgba(6,182,212,0.2)]"
              style={{ insetInlineStart: `${Math.max(0, siblingLineInset - 16)}px`, insetInlineEnd: 0 }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-cyan-500 ring-2 ring-white" />
            </div>
            <DropHintBadge label={t('tree.drop.after')} tone="sibling" className="start-2 bottom-1" />
          </div>
        ) : null}
        {showDropInside ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-1 z-20" aria-hidden="true">
            <div
              className="absolute bottom-0 h-[2px] rounded-full border border-dashed border-indigo-400/90 bg-indigo-200/70"
              style={{ insetInlineStart: `${childPreviewInset}px`, insetInlineEnd: '12px' }}
            />
            <DropHintBadge label={t('tree.drop.child')} tone="child" className="end-2 top-1/2 -translate-y-1/2" />
          </div>
        ) : null}
        <div className="flex items-center" style={{ paddingInlineStart: `${row.depth * TREE_INDENT}px` }}>
          {!hideExpandControls && row.hasChildren ? (
            <button
              type="button"
              onClick={() => onToggleExpand(row)}
              className="h-6 w-6 inline-flex items-center justify-center rounded text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 cursor-pointer shrink-0 transition-colors"
              title={isExpanded ? 'Collapse' : 'Expand'}
              aria-label={isExpanded ? `Collapse ${row.id}` : `Expand ${row.id}`}
            >
              {isLoadingChildren ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isExpanded ? (
                <span aria-hidden="true" className="text-[17px] font-bold leading-none">-</span>
              ) : (
                <span aria-hidden="true" className="text-[17px] font-bold leading-none">+</span>
              )}
            </button>
          ) : !hideExpandControls ? (
            <span className="h-6 w-6 shrink-0" aria-hidden="true" />
          ) : null}
          <span
            className={cn(
              'ms-1.5 text-xs',
              nodeColumnDirectionChrome.cellClassName,
              row.depth === 0 ? 'font-semibold text-slate-800' : 'text-slate-700',
            )}
            dir={nodeColumnDirectionChrome.cellDir}
          >
            {getNodeLabel(row)}
          </span>
        </div>
      </td>
      {fieldColumns.map((column) => {
        const columnChrome = resolveTreeGridDataColumnDirectionChrome(column, cultureDirection);
        return (
          <td
            key={column.key}
            className={cn(APP_TABLE_GRID_CELL_PR_CLASS, 'py-2 align-middle', columnChrome.cellClassName)}
            dir={columnChrome.cellDir}
            style={column.style}
            data-column-id={column.key}
          >
            <div className={cn(
              APP_TABLE_GRID_CELL_CLIP_CLASS,
              resolveAppTableGridCellClipAlign(columnChrome.cellClassName),
            )}>
              {column.renderCell(row)}
            </div>
          </td>
        );
      })}
      {actionColumn ? (() => {
        const columnChrome = resolveTreeGridDataColumnDirectionChrome(actionColumn, cultureDirection);
        return (
          <td
            key={actionColumn.key}
            className={cn(APP_TABLE_GRID_CELL_PR_CLASS, 'py-2 align-middle', columnChrome.cellClassName)}
            dir={columnChrome.cellDir}
            style={actionColumn.style}
            data-column-id={actionColumn.key}
          >
            <div className={cn(
              APP_TABLE_GRID_CELL_CLIP_CLASS,
              resolveAppTableGridCellClipAlign(columnChrome.cellClassName),
            )}>
              {actionColumn.renderCell(row)}
            </div>
          </td>
        );
      })() : null}
    </tr>
  );
}

const propsEqual = <T extends BaseTreeGridRow>(
  previous: BaseTreeGridTableRowProps<T>,
  next: BaseTreeGridTableRowProps<T>,
) => (
  previous.row === next.row
  && previous.virtualIndex === next.virtualIndex
  && previous.isExpanded === next.isExpanded
  && previous.isLoadingChildren === next.isLoadingChildren
  && previous.isDragSource === next.isDragSource
  && previous.isDropTarget === next.isDropTarget
  && previous.dropPosition === next.dropPosition
  && previous.moveDisabled === next.moveDisabled
  && previous.isDropping === next.isDropping
  && previous.showIdColumn === next.showIdColumn
  && previous.idColumnStyle === next.idColumnStyle
  && previous.idColumnDirectionChrome === next.idColumnDirectionChrome
  && previous.nodeColumnDirectionChrome === next.nodeColumnDirectionChrome
  && previous.nodeColumnStyle === next.nodeColumnStyle
  && previous.hideExpandControls === next.hideExpandControls
  && previous.fieldColumns === next.fieldColumns
  && previous.actionColumn === next.actionColumn
);

export const BaseTreeGridTableRow = memo(
  BaseTreeGridTableRowInner,
  propsEqual,
) as typeof BaseTreeGridTableRowInner;
