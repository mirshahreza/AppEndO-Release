import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { NativeButton, UiInput } from '../../../shared/ui';
import { GRID_COLUMN_MIN_WIDTH } from '../../../shared/lib/appTableGridColumnLayout';
import type { EdgeModelColumn } from '../../../shared/api/contracts/data-api';
import { isFloatColumn, isIntegerColumn } from '../../../shared/api/contracts/data-api/datasheetCoerce';
import type { DatasheetDraftRow, DatasheetFocusCell } from '../hooks/useEdgeModelDatasheetInstance';

const SURFACE_CLASS = '!bg-white hover:!bg-white data-[hover=true]:!bg-white';
const CELL_CLASS = `overflow-hidden border border-[#d7dee6] p-0 align-middle ${SURFACE_CLASS}`;
const HEADER_CLASS = `relative border border-[#d7dee6] px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-700 ${SURFACE_CLASS}`;
const DATASHEET_COLUMN_MIN_WIDTH = Math.max(GRID_COLUMN_MIN_WIDTH, 80);
const DATASHEET_DELETE_COLUMN_WIDTH = 32;

const defaultColumnWidth = (column: EdgeModelColumn): number => {
  const fromName = Math.min(240, Math.max(96, column.name.length * 9 + 28));
  if (isIntegerColumn(column) || isFloatColumn(column)) {
    return Math.min(fromName, 120);
  }
  return fromName;
};
const INPUT_CLASS = cn(
  '!h-7 !min-h-7 w-full min-w-0 !rounded-none !border-0 px-1.5 text-[11px] font-semibold text-slate-800 !shadow-none',
  'focus:outline-none focus:!ring-1 focus:!ring-inset focus:!ring-indigo-300',
  'disabled:cursor-not-allowed disabled:!opacity-100 disabled:!text-slate-800',
  SURFACE_CLASS,
);

type EdgeModelDatasheetGridProps = {
  columns: EdgeModelColumn[];
  rows: DatasheetDraftRow[];
  pkFields: string[];
  readOnly: boolean;
  fieldErrors: Record<string, Record<string, string>>;
  focusCell: DatasheetFocusCell | null;
  savingClientId: string | null;
  onClearFocusCell: () => void;
  onUpdateCell: (clientId: string, field: string, value: string) => void;
  onLeaveRow: (clientId: string) => void;
  onSkipSave: (clientId: string) => void;
  onRemoveRow: (clientId: string) => void;
  scratchClientId: string | null;
};

export const EdgeModelDatasheetGrid: React.FC<EdgeModelDatasheetGridProps> = ({
  columns,
  rows,
  pkFields,
  readOnly,
  fieldErrors,
  focusCell,
  savingClientId,
  onClearFocusCell,
  onUpdateCell,
  onLeaveRow,
  onSkipSave,
  onRemoveRow,
  scratchClientId,
}) => {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const resizeRef = useRef<{ field: string; startX: number; startWidth: number } | null>(null);

  const widthFor = useCallback((column: EdgeModelColumn): number => (
    columnWidths[column.field] ?? defaultColumnWidth(column)
  ), [columnWidths]);

  const tableWidth = useMemo(() => {
    const dataWidth = columns.reduce((sum, column) => sum + widthFor(column), 0);
    return dataWidth + (readOnly ? 0 : DATASHEET_DELETE_COLUMN_WIDTH);
  }, [columns, readOnly, widthFor]);

  const handleResizeStart = useCallback((field: string, event: React.PointerEvent<HTMLSpanElement>) => {
    const headerCell = event.currentTarget.closest('th');
    const handle = event.currentTarget;
    if (!headerCell) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    handle.setPointerCapture(event.pointerId);
    const rtl = getComputedStyle(headerCell).direction === 'rtl';
    resizeRef.current = {
      field,
      startX: event.clientX,
      startWidth: headerCell.getBoundingClientRect().width,
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const state = resizeRef.current;
      if (!state) {
        return;
      }
      const delta = moveEvent.clientX - state.startX;
      const nextWidth = Math.max(
        DATASHEET_COLUMN_MIN_WIDTH,
        Math.round(state.startWidth + (rtl ? -delta : delta)),
      );
      setColumnWidths((current) => (
        current[state.field] === nextWidth
          ? current
          : { ...current, [state.field]: nextWidth }
      ));
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      handle.releasePointerCapture(upEvent.pointerId);
      resizeRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, []);

  useEffect(() => {
    if (!focusCell) {
      return;
    }
    const host = document.querySelector(
      `[data-datasheet-cell="${focusCell.clientId}:${focusCell.field}"]`,
    );
    const node = host instanceof HTMLElement ? host.querySelector('input') : null;
    if (node instanceof HTMLInputElement) {
      node.focus();
      node.select();
    }
    onClearFocusCell();
  }, [focusCell, onClearFocusCell]);

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table
        className="border-collapse table-fixed text-left"
        style={{ width: tableWidth }}
      >
        <colgroup>
          {columns.map((column) => (
            <col key={column.field} style={{ width: widthFor(column) }} />
          ))}
          {!readOnly ? <col style={{ width: DATASHEET_DELETE_COLUMN_WIDTH }} /> : null}
        </colgroup>
        <thead className="sticky top-0 z-[1] bg-slate-50">
          <tr>
            {columns.map((column) => (
              <th key={column.field} className={HEADER_CLASS}>
                <span className="block truncate pe-1.5">
                  {column.name}
                  {column.isPrimaryKey ? ' *' : ''}
                </span>
                <span
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={`Resize ${column.name} column`}
                  className="absolute inset-y-0 end-0 z-10 w-1.5 cursor-col-resize touch-none select-none hover:bg-indigo-200/80"
                  onPointerDown={(event) => handleResizeStart(column.field, event)}
                />
              </th>
            ))}
            {!readOnly ? <th className={cn(HEADER_CLASS, 'w-8')} /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const saving = savingClientId === row.clientId;
            return (
              <tr
                key={row.clientId}
                aria-busy={saving || undefined}
                className={saving ? 'opacity-70' : undefined}
                onBlur={(event) => {
                  const next = event.relatedTarget as Node | null;
                  if (next && event.currentTarget.contains(next)) {
                    return;
                  }
                  onLeaveRow(row.clientId);
                }}
              >
                {columns.map((column) => {
                  const locked = readOnly || (!row.isNew && pkFields.includes(column.field));
                  const value = row.values[column.field];
                  const errorMessage = fieldErrors[row.clientId]?.[column.field];
                  const numeric = isIntegerColumn(column) || isFloatColumn(column);
                  return (
                    <td
                      key={column.field}
                      className={CELL_CLASS}
                      data-datasheet-cell={`${row.clientId}:${column.field}`}
                    >
                      <UiInput
                        size="sm"
                        value={value == null ? '' : String(value)}
                        disabled={locked}
                        isInvalid={Boolean(errorMessage)}
                        errorMessage={errorMessage}
                        inputMode={numeric ? 'numeric' : undefined}
                        className={cn(
                          INPUT_CLASS,
                          errorMessage && '!ring-1 !ring-inset !ring-rose-400',
                        )}
                        ariaLabel={`${column.name} value`}
                        onChange={(event) => onUpdateCell(row.clientId, column.field, event.target.value)}
                      />
                    </td>
                  );
                })}
                {!readOnly ? (
                  <td className={cn(CELL_CLASS, 'w-8 text-center')}>
                    {row.clientId === scratchClientId ? null : (
                      <NativeButton
                        type="button"
                        aria-label="Delete row"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-300 hover:bg-rose-50 hover:text-rose-600"
                        onPointerDown={(event) => {
                          if (event.button !== 0) {
                            return;
                          }
                          onSkipSave(row.clientId);
                        }}
                        onClick={() => onRemoveRow(row.clientId)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </NativeButton>
                    )}
                  </td>
                ) : null}
              </tr>
            );
          })}
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-6 text-center text-[11px] text-slate-500" colSpan={columns.length + (readOnly ? 0 : 1)}>
                No rows in this window.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
};
