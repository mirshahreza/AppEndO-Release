import React, { useLayoutEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { EdgeModelColumn } from '../../../shared/api/contracts/data-api';
import { cn } from '../../../lib/utils';
import { renderBooleanIcon } from '../../../shared/lib/gridCellRenderers';
import { ActionTooltip, NativeButton, UiInput } from '../../../shared/ui';
import { sanitizeEdgeColumnNameInput } from '../lib/edgeModelColumnUtils';
import { DatasheetCellSelect } from './DatasheetCellSelect';
import { EDGE_SEQUELIZE_TYPE_OPTIONS } from '../lib/edgeSequelizeTypes';

const SURFACE_CLASS = '!bg-white hover:!bg-white data-[hover=true]:!bg-white';
const CELL_CLASS = `border border-[#d7dee6] p-0 align-middle ${SURFACE_CLASS}`;
const HEADER_CLASS = `border border-[#d7dee6] px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-700 ${SURFACE_CLASS}`;
const INPUT_CLASS = cn(
  '!h-7 !min-h-7 w-full min-w-0 !rounded-none !border-0 px-1.5 text-[11px] font-semibold text-slate-800 !shadow-none',
  'focus:outline-none focus:!ring-1 focus:!ring-inset focus:!ring-indigo-300',
  // Locked base columns stay readable — beat HeroUI/browser disabled fading.
  'disabled:cursor-not-allowed disabled:!opacity-100 disabled:!text-slate-800',
  'disabled:[-webkit-text-fill-color:theme(colors.slate.800)]',
  SURFACE_CLASS,
);

const DELETE_BUTTON_CLASS = cn(
  'inline-flex h-6 w-6 items-center justify-center rounded-md border border-transparent',
  'bg-transparent text-slate-300 shadow-none transition-colors',
  'hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/80',
  'disabled:cursor-not-allowed disabled:opacity-40',
);

const FOCUS_RETRY_FRAMES = 12;

const findNameInput = (host: HTMLElement | null): HTMLInputElement | null => {
  if (!host) {
    return null;
  }
  const input = host.querySelector('input');
  return input instanceof HTMLInputElement ? input : null;
};

type TextCommitCellProps = {
  value: string;
  disabled?: boolean;
  className?: string;
  columnIndex: number;
  autoFocus?: boolean;
  /** Bumps when a new focus request targets this cell. */
  focusNonce?: number;
  /** When true, empty trimmed values are committed (clears optional fields). */
  allowEmpty?: boolean;
  /** Optional live input sanitizer (e.g. column identifiers). */
  sanitizeInput?: (value: string) => string;
  onCommit: (value: string) => void;
  /** Fired after commit when Enter is pressed (e.g. add next row). */
  onEnter?: () => void;
  /** Called once the name input successfully received focus. */
  onAutoFocused?: () => void;
};

const TextCommitCell: React.FC<TextCommitCellProps> = ({
  value,
  disabled = false,
  className,
  columnIndex,
  autoFocus = false,
  focusNonce = 0,
  allowEmpty = false,
  sanitizeInput,
  onCommit,
  onEnter,
  onAutoFocused,
}) => {
  const [draft, setDraft] = useState(value ?? '');
  const hostRef = useRef<HTMLDivElement>(null);
  const onAutoFocusedRef = useRef(onAutoFocused);
  onAutoFocusedRef.current = onAutoFocused;

  useLayoutEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  useLayoutEffect(() => {
    if (!autoFocus || disabled) {
      return;
    }

    let cancelled = false;
    let frame = 0;
    let rafId = 0;

    const tryFocus = () => {
      if (cancelled) {
        return;
      }

      const input = findNameInput(hostRef.current);
      if (input && !input.disabled) {
        input.focus();
        input.select();
        input.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        onAutoFocusedRef.current?.();
        return;
      }

      frame += 1;
      if (frame < FOCUS_RETRY_FRAMES) {
        rafId = window.requestAnimationFrame(tryFocus);
      }
    };

    tryFocus();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
    };
  }, [autoFocus, disabled, columnIndex, focusNonce]);

  const commit = () => {
    const sanitized = sanitizeInput ? sanitizeInput(draft ?? '') : (draft ?? '');
    const trimmed = sanitized.trim();
    if (trimmed !== (value ?? '') && (trimmed || allowEmpty)) {
      onCommit(trimmed);
      return;
    }

    setDraft(value ?? '');
  };

  return (
    <div
      ref={hostRef}
      data-designer-column-index={columnIndex}
      className="w-full min-w-0"
    >
      <UiInput
        aiAssist={false}
        autoDir={false}
        type="text"
        value={draft}
        disabled={disabled}
        autoFocus={autoFocus}
        className={cn(INPUT_CLASS, className)}
        onChange={(event) => {
          const nextValue = event.target.value;
          setDraft(sanitizeInput ? sanitizeInput(nextValue) : nextValue);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
            // Release this cell before the next row mounts so focus can move.
            event.currentTarget.blur();
            const addColumn = onEnter;
            window.requestAnimationFrame(() => {
              addColumn?.();
            });
            return;
          }
          if (event.key === 'Escape') {
            setDraft(value);
            event.currentTarget.blur();
          }
        }}
      />
    </div>
  );
};

export type EdgeModelDesignerDatasheetProps = {
  columns: EdgeModelColumn[];
  /** Live outbound FK targets keyed by local column name (`table.column`). */
  foreignKeyTargets?: ReadonlyMap<string, string>;
  nativeTypeOptions: string[];
  readOnly: boolean;
  /** When true for a column, physical DB shape (name/type/delete) is locked. */
  isStructuralColumnLocked?: (columnName: string) => boolean;
  isLoading: boolean;
  focusColumnIndex: number | null;
  /** Increments on each focus request so the same row can be re-focused. */
  focusNonce?: number;
  onFocusColumnHandled: () => void;
  onUpdateColumn: (columnIndex: number, patch: Partial<EdgeModelColumn>) => void;
  onRemoveColumn: (columnIndex: number) => void;
  /** Enter in the column-name cell adds a blank field and focuses it. */
  onAddBlankColumn?: () => void;
};

export const EdgeModelDesignerDatasheet: React.FC<EdgeModelDesignerDatasheetProps> = ({
  columns,
  foreignKeyTargets,
  nativeTypeOptions,
  readOnly,
  isStructuralColumnLocked,
  isLoading,
  focusColumnIndex,
  focusNonce = 0,
  onFocusColumnHandled,
  onUpdateColumn,
  onRemoveColumn,
  onAddBlankColumn,
}) => {
  if (isLoading) {
    return (
      <div className={`flex flex-1 items-center justify-center text-xs text-slate-500 ${SURFACE_CLASS}`}>
        Loading table model…
      </div>
    );
  }

  return (
    <div className={`edge-model-datasheet flex h-full min-h-0 flex-col overflow-hidden ${SURFACE_CLASS}`}>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className={`w-full min-w-[36rem] border-collapse text-[11px] ${SURFACE_CLASS}`}>
          <thead className="sticky top-0 z-[1]">
            <tr>
              <th className={`${HEADER_CLASS} w-[9.5rem] text-start`}>Column</th>
              <th className={`${HEADER_CLASS} w-[8.5rem] text-start`}>Native</th>
              <th className={`${HEADER_CLASS} w-[7rem] text-start`}>Runtime</th>
              <th className={`${HEADER_CLASS} w-10 text-center`}>Null</th>
              <th className={`${HEADER_CLASS} w-10 text-center`}>PK</th>
              <th className={`${HEADER_CLASS} w-[7.5rem] text-start`}>FK</th>
              <th className={`${HEADER_CLASS} w-9`} aria-label="Actions" />
            </tr>
          </thead>
          <tbody className={SURFACE_CLASS}>
            {columns.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="border border-[#d7dee6] px-3 py-6 text-center text-slate-400"
                >
                  No columns yet. Add a column to get started.
                </td>
              </tr>
            ) : columns.map((column, rowIndex) => {
              const columnLabel = column.name.trim() || `column ${rowIndex + 1}`;
              const structuralLocked = readOnly || Boolean(isStructuralColumnLocked?.(column.name));
              const deleteLocked = structuralLocked || column.isPrimaryKey;
              const shouldFocusName = focusColumnIndex === rowIndex;
              const liveFkTarget = foreignKeyTargets?.get(column.name) ?? null;
              const isForeignKey = Boolean(liveFkTarget) || column.isForeignKey;
              const deleteTitle = column.isPrimaryKey
                ? 'Primary key columns cannot be removed.'
                : (structuralLocked
                  ? 'Platform schema columns cannot be removed.'
                  : 'Remove from model');

              return (
                <tr
                  key={`row-${rowIndex}`}
                  className={`group/datasheet-row ${SURFACE_CLASS}`}
                >
                  <td className={CELL_CLASS}>
                    <TextCommitCell
                      value={column.name}
                      disabled={structuralLocked}
                      columnIndex={rowIndex}
                      autoFocus={shouldFocusName}
                      focusNonce={shouldFocusName ? focusNonce : 0}
                      sanitizeInput={sanitizeEdgeColumnNameInput}
                      onCommit={(nextValue) => onUpdateColumn(rowIndex, { name: nextValue })}
                      onEnter={!readOnly ? onAddBlankColumn : undefined}
                      onAutoFocused={shouldFocusName ? onFocusColumnHandled : undefined}
                    />
                  </td>
                  <td className={CELL_CLASS}>
                    <DatasheetCellSelect
                      value={column.dataType}
                      options={nativeTypeOptions}
                      disabled={structuralLocked}
                      ariaLabel={`Native type for ${columnLabel}`}
                      onChange={(value) => onUpdateColumn(rowIndex, { dataType: value })}
                    />
                  </td>
                  <td className={CELL_CLASS}>
                    <DatasheetCellSelect
                      value={column.sequelizeType}
                      options={[...EDGE_SEQUELIZE_TYPE_OPTIONS]}
                      disabled={structuralLocked}
                      ariaLabel={`Runtime type for ${columnLabel}`}
                      onChange={(value) => onUpdateColumn(rowIndex, { sequelizeType: value })}
                    />
                  </td>
                  <td className={`${CELL_CLASS} text-center`}>
                    <div className="flex h-7 items-center justify-center">
                      {renderBooleanIcon(column.allowNull)}
                    </div>
                  </td>
                  <td className={`${CELL_CLASS} text-center`}>
                    <div className="flex h-7 items-center justify-center">
                      {renderBooleanIcon(column.isPrimaryKey)}
                    </div>
                  </td>
                  <td className={CELL_CLASS}>
                    <div className="flex h-7 min-w-0 items-center px-1.5">
                      {liveFkTarget ? (
                        <ActionTooltip content={`References ${liveFkTarget}`}>
                          <span className="truncate font-mono text-[10px] font-semibold text-indigo-700">
                            {liveFkTarget}
                          </span>
                        </ActionTooltip>
                      ) : isForeignKey ? (
                        <ActionTooltip content="Foreign key">
                          <span className="truncate font-mono text-[10px] font-semibold text-indigo-700">
                            FK
                          </span>
                        </ActionTooltip>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </div>
                  </td>
                  <td className={`${CELL_CLASS} text-center`}>
                    <NativeButton
                      type="button"
                      className={DELETE_BUTTON_CLASS}
                      disabled={deleteLocked}
                      aria-label={`Remove ${columnLabel} from model`}
                      title={deleteTitle}
                      onClick={() => onRemoveColumn(rowIndex)}
                    >
                      <Trash2 className="pointer-events-none h-3.5 w-3.5" />
                    </NativeButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
