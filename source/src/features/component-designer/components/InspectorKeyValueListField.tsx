import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { AppButton } from '../../../shared/ui/AppButton';
import { UiInput } from '../../../shared/ui';
import { ICON_ACTION_BUTTON_SM_CLASS, ICON_ACTION_DELETE_CLASS } from '../../../shared/ui/surfaceClasses';
import { preventInspectorDetailsToggle } from './inspectorDetailsGuard';
import { INSPECTOR_TEXT_2XS, INSPECTOR_TEXT_XS } from './inspectorDesignTokens';

type KeyValueRow = {
  id: string;
  key: string;
  value: string;
};

let rowIdCounter = 0;
const createRowId = (): string => {
  rowIdCounter += 1;
  return `kv-row-${rowIdCounter}-${Math.random().toString(36).slice(2, 7)}`;
};

const createRow = (key = '', value = ''): KeyValueRow => ({ id: createRowId(), key, value });

const isRowFilled = (row: KeyValueRow): boolean => row.key.trim().length > 0;

const recordToRows = (record: Record<string, string> | undefined): KeyValueRow[] => {
  const entries = Object.entries(record ?? {}).map(([key, value]) => createRow(key, value));
  return entries.length > 0 ? entries : [createRow()];
};

/** Keep at least `minTotal` rows and always one blank row after the last filled key. */
const padRows = (rows: KeyValueRow[], minTotal: number): KeyValueRow[] => {
  const filledCount = rows.filter(isRowFilled).length;
  const target = Math.max(minTotal, filledCount + 1);
  if (rows.length >= target) {
    return rows;
  }
  const next = [...rows];
  while (next.length < target) {
    next.push(createRow());
  }
  return next;
};

/**
 * Rows with a non-empty key are kept (empty-string values are valid, e.g. an intentionally
 * blank header). Duplicate keys naturally resolve last-write-wins via `Object.fromEntries`,
 * matching how a plain JS object already behaved under the old raw-JSON textareas.
 */
const rowsToRecord = (rows: KeyValueRow[]): Record<string, string> | undefined => {
  const record = Object.fromEntries(
    rows
      .filter((row) => row.key.trim().length > 0)
      .map((row) => [row.key.trim(), row.value]),
  );
  return Object.keys(record).length > 0 ? record : undefined;
};

const findDuplicateKeys = (rows: KeyValueRow[]): Set<string> => {
  const seen = new Map<string, number>();
  for (const row of rows) {
    const trimmed = row.key.trim();
    if (!trimmed) continue;
    seen.set(trimmed, (seen.get(trimmed) ?? 0) + 1);
  }
  const duplicates = new Set<string>();
  for (const [key, count] of seen) {
    if (count > 1) duplicates.add(key);
  }
  return duplicates;
};

export type InspectorKeyValueListFieldProps = {
  value: Record<string, string> | undefined;
  onChange: (next: Record<string, string> | undefined) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  addLabel?: string;
  /** Accessible-name prefix for row inputs (e.g. "Header", "Query param"). */
  fieldLabel?: string;
  /**
   * When set, hide the Add button and keep this many ready rows.
   * As soon as every row has a key, one extra blank row is appended.
   */
  autoPadRows?: number;
  className?: string;
};

/**
 * Shared visual key/value row editor — Postman-headers / .env-style UX — replacing raw-JSON
 * textareas for `Record<string, string>` backed fields (request headers, query params, dynamic
 * action payload mappings, …). No JSON syntax is ever shown to the user; the record is rebuilt
 * from typed rows on every change and serializes to `undefined` (not `{}`) when empty.
 */
export const InspectorKeyValueListField: React.FC<InspectorKeyValueListFieldProps> = ({
  value,
  onChange,
  keyPlaceholder = 'key',
  valuePlaceholder = 'value',
  addLabel = 'Add',
  fieldLabel = 'Entry',
  autoPadRows,
  className,
}) => {
  const withPad = React.useCallback((nextRows: KeyValueRow[]): KeyValueRow[] => (
    autoPadRows && autoPadRows > 0 ? padRows(nextRows, autoPadRows) : nextRows
  ), [autoPadRows]);

  const [rows, setRows] = React.useState<KeyValueRow[]>(() => withPad(recordToRows(value)));
  const skipSyncRef = React.useRef(false);

  React.useEffect(() => {
    if (skipSyncRef.current) {
      skipSyncRef.current = false;
      return;
    }
    setRows(withPad(recordToRows(value)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, withPad]);

  const persist = React.useCallback((nextRows: KeyValueRow[]) => {
    skipSyncRef.current = true;
    setRows(withPad(nextRows));
    onChange(rowsToRecord(nextRows));
  }, [onChange, withPad]);

  const duplicateKeys = React.useMemo(() => findDuplicateKeys(rows), [rows]);

  const updateRow = (id: string, patch: Partial<Pick<KeyValueRow, 'key' | 'value'>>) => {
    persist(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const removeRow = (id: string) => {
    const nextRows = rows.filter((row) => row.id !== id);
    persist(nextRows.length > 0 ? nextRows : [createRow()]);
  };

  const addRow = () => {
    persist([...rows, createRow()]);
  };

  const hideAddButton = Boolean(autoPadRows && autoPadRows > 0);

  return (
    <div className={`flex flex-col gap-2 ${className ?? ''}`.trim()} {...preventInspectorDetailsToggle}>
      <div className="space-y-1.5">
        {rows.map((row) => {
          const isDuplicate = row.key.trim().length > 0 && duplicateKeys.has(row.key.trim());
          const canRemove = !hideAddButton || isRowFilled(row);
          return (
            <div key={row.id} className="flex flex-col gap-1">
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_28px] items-center gap-2">
                <UiInput
                  size="sm"
                  className="w-full"
                  placeholder={keyPlaceholder}
                  autoDir={false}
                  ariaLabel={`${fieldLabel} key`}
                  value={row.key}
                  onChange={(event) => updateRow(row.id, { key: event.target.value })}
                />
                <UiInput
                  size="sm"
                  className="w-full"
                  placeholder={valuePlaceholder}
                  autoDir={false}
                  ariaLabel={`${fieldLabel} value`}
                  value={row.value}
                  onChange={(event) => updateRow(row.id, { value: event.target.value })}
                />
                {canRemove ? (
                  <AppButton
                    type="button"
                    size="icon-sm"
                    tabStop="skip"
                    className={`${ICON_ACTION_BUTTON_SM_CLASS} ${ICON_ACTION_DELETE_CLASS}`}
                    aria-label={`Remove ${fieldLabel.toLowerCase()} row`}
                    onClick={() => removeRow(row.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </AppButton>
                ) : (
                  <span className="h-5 w-5" aria-hidden="true" />
                )}
              </div>
              {isDuplicate ? (
                <span className={`ps-[4px] ${INSPECTOR_TEXT_2XS} font-medium text-amber-600`}>
                  Duplicate key — last row wins.
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {hideAddButton ? null : (
        <AppButton
          type="button"
          intent="secondary"
          size="sm"
          className={`h-7 w-full px-2 ${INSPECTOR_TEXT_XS}`}
          onClick={addRow}
        >
          <Plus className="mr-1 h-3 w-3" strokeWidth={2} />
          {addLabel}
        </AppButton>
      )}
    </div>
  );
};
