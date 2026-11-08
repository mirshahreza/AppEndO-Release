import * as React from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import type { InspectorArrayEditorColumn } from '../../../domain/component-designer/inspectorRegistry';
import { AppButton } from '../../../shared/ui/AppButton';
import { AppSurfaceBox } from '../../../shared/ui/AppSurfaceBox';
import { UiInput } from '../../../shared/ui';
import { ICON_ACTION_CANCEL_CLASS, ICON_ACTION_DELETE_CLASS } from '../../../shared/ui/surfaceClasses';
import { UiColorField } from '../../../components/ui/UiColorField';
import { preventInspectorDetailsToggle } from './inspectorDetailsGuard';
import { InspectorMicroLabel, InspectorSectionValueBadge } from './inspectorFieldPrimitives';
import { INSPECTOR_TEXT_XS, NESTED_LAYER_DIVIDER_CLASS } from './inspectorDesignTokens';

export type { InspectorArrayEditorColumn, InspectorArrayEditorColumnType } from '../../../domain/component-designer/inspectorRegistry';

/** Row buffer — every cell is kept as text while editing; typed on persist (see {@link serializeRows}). */
type ArrayRow = Record<string, string>;

const normalizeRows = (value: unknown[] | undefined, columns: InspectorArrayEditorColumn[]): ArrayRow[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => {
    const source = (entry && typeof entry === 'object' && !Array.isArray(entry))
      ? entry as Record<string, unknown>
      : {};
    const row: ArrayRow = {};
    for (const column of columns) {
      const raw = source[column.key];
      row[column.key] = raw === undefined || raw === null ? '' : String(raw);
    }
    return row;
  });
};

const createEmptyRow = (columns: InspectorArrayEditorColumn[]): ArrayRow =>
  Object.fromEntries(columns.map((column) => [column.key, ''] as const));

/**
 * Rebuilds the typed JSON array this component's `value` prop expects. Number columns coerce
 * a non-empty draft with `Number(...)`; when that isn't finite the raw text is kept so no
 * keystroke is silently dropped (the consuming runtime already tolerates non-finite numeric
 * fields by filtering the entry out, matching what an invalid hand-typed JSON number did before).
 * Empty number cells are omitted from the row entirely (JSON.stringify drops `undefined` keys).
 */
const serializeRows = (rows: ArrayRow[], columns: InspectorArrayEditorColumn[]): unknown[] =>
  rows.map((row) => {
    const record: Record<string, unknown> = {};
    for (const column of columns) {
      const raw = (row[column.key] ?? '').trim();
      if (column.type === 'number') {
        if (raw.length === 0) {
          continue;
        }
        const numeric = Number(raw);
        record[column.key] = Number.isFinite(numeric) ? numeric : raw;
      } else {
        record[column.key] = raw;
      }
    }
    return record;
  });

export type InspectorJsonArrayListFieldProps = {
  label?: string;
  columns: InspectorArrayEditorColumn[];
  value: unknown[] | undefined;
  onChange: (next: unknown[] | undefined) => void;
  /** Singular noun for the Add button / per-row heading, e.g. "threshold", "pin". Defaults to "item". */
  itemLabel?: string;
  emptyStateText?: string;
};

/**
 * Generic, schema-driven repeating row editor for array-of-fixed-shape-object fields
 * (gauge thresholds, map pins/regions, Gantt dependencies/milestones, …). Renders one card per
 * array item with a typed input per column (text / number / color swatch+hex), add/remove, and
 * up/down reordering — the same structural pattern as `InspectorContentRecordsField`, generalized
 * beyond string-only record shapes so numeric and color columns round-trip as real JSON types.
 */
export const InspectorJsonArrayListField: React.FC<InspectorJsonArrayListFieldProps> = ({
  label,
  columns,
  value,
  onChange,
  itemLabel = 'item',
  emptyStateText,
}) => {
  const [rows, setRows] = React.useState<ArrayRow[]>(() => normalizeRows(value, columns));
  const skipSyncRef = React.useRef(false);

  React.useEffect(() => {
    if (skipSyncRef.current) {
      skipSyncRef.current = false;
      return;
    }
    setRows(normalizeRows(value, columns));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, columns]);

  const persist = React.useCallback((nextRows: ArrayRow[]) => {
    skipSyncRef.current = true;
    setRows(nextRows);
    const serialized = serializeRows(nextRows, columns);
    onChange(serialized.length > 0 ? serialized : undefined);
  }, [columns, onChange]);

  const updateCell = (index: number, columnKey: string, cellValue: string) => {
    persist(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, [columnKey]: cellValue } : row)));
  };

  const addRow = () => {
    persist([...rows, createEmptyRow(columns)]);
  };

  const removeRow = (index: number) => {
    persist(rows.filter((_, rowIndex) => rowIndex !== index));
  };

  const moveRow = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= rows.length) {
      return;
    }
    const nextRows = [...rows];
    const [moved] = nextRows.splice(index, 1);
    if (!moved) {
      return;
    }
    nextRows.splice(targetIndex, 0, moved);
    persist(nextRows);
  };

  const body = (
    <div className="space-y-2" {...preventInspectorDetailsToggle}>
      {rows.length === 0 ? (
        <p className={`rounded-md border border-dashed border-slate-300 bg-white px-3 py-4 text-center ${INSPECTOR_TEXT_XS} text-slate-500`}>
          {emptyStateText ?? `No ${itemLabel}s yet.`}
        </p>
      ) : null}

      {rows.map((row, index) => (
        <div
          key={`array-row-${index}`}
          className={`flex flex-col gap-2 rounded-lg ${NESTED_LAYER_DIVIDER_CLASS} bg-slate-50/50 p-2.5 shadow-sm`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className={`truncate ${INSPECTOR_TEXT_XS} font-semibold text-slate-600`}>
              {itemLabel} {index + 1}
            </span>
            <div className="flex shrink-0 items-center gap-1">
              <AppButton
                type="button"
                size="icon-sm"
                className={ICON_ACTION_CANCEL_CLASS}
                aria-label={`Move ${itemLabel} ${index + 1} up`}
                disabled={index === 0}
                onClick={() => moveRow(index, -1)}
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </AppButton>
              <AppButton
                type="button"
                size="icon-sm"
                className={ICON_ACTION_CANCEL_CLASS}
                aria-label={`Move ${itemLabel} ${index + 1} down`}
                disabled={index === rows.length - 1}
                onClick={() => moveRow(index, 1)}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </AppButton>
              <AppButton
                type="button"
                size="icon-sm"
                className={ICON_ACTION_DELETE_CLASS}
                aria-label={`Remove ${itemLabel} ${index + 1}`}
                onClick={() => removeRow(index)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </AppButton>
            </div>
          </div>

          <div className={columns.length > 1 ? 'grid grid-cols-2 gap-2' : undefined}>
            {columns.map((column) => (
              <div key={column.key} className="flex flex-col gap-[2px]">
                <InspectorMicroLabel>{column.label}</InspectorMicroLabel>
                {column.type === 'color' ? (
                  <UiColorField
                    value={row[column.key] ?? ''}
                    placeholder={column.placeholder ?? '#RRGGBB'}
                    ariaLabel={`${itemLabel} ${index + 1} ${column.label}`}
                    onChange={(nextValue) => updateCell(index, column.key, nextValue)}
                  />
                ) : (
                  <UiInput
                    size="sm"
                    nested
                    type={column.type === 'number' ? 'number' : 'text'}
                    className="w-full bg-white text-slate-700"
                    autoDir={false}
                    placeholder={column.placeholder}
                    value={row[column.key] ?? ''}
                    ariaLabel={`${itemLabel} ${index + 1} ${column.label}`}
                    onChange={(event) => updateCell(index, column.key, event.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <AppButton type="button" size="sm" intent="secondary" onClick={addRow}>
        <Plus className="h-3.5 w-3.5" />
        Add {itemLabel}
      </AppButton>
    </div>
  );

  if (!label) {
    return body;
  }

  return (
    <AppSurfaceBox
      tone="cyan"
      title={label}
      layout="panel"
      collapsible
      defaultOpen
      headerExtra={(
        <InspectorSectionValueBadge
          count={rows.length}
          label={`${rows.length} ${itemLabel}${rows.length === 1 ? '' : 's'}`}
          active={rows.length > 0}
        />
      )}
    >
      {body}
    </AppSurfaceBox>
  );
};
