import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AppButton, UiInput } from "../../shared/ui";
import { ICON_ACTION_BUTTON_SM_CLASS, ICON_ACTION_DELETE_CLASS } from "../../shared/ui/surfaceClasses";
import type { HttpWorkshopKeyValue } from "../../shared/api/queries/api-talk";

type Row = HttpWorkshopKeyValue & { rowId: string };

let rowIdCounter = 0;
const nextRowId = (): string => {
  rowIdCounter += 1;
  return `api-talk-kv-${rowIdCounter}`;
};

const toRows = (values: HttpWorkshopKeyValue[] | undefined): Row[] => {
  if (!values || values.length === 0) {
    return [{ rowId: nextRowId(), key: "", value: "", enabled: true }];
  }
  return values.map((item) => ({ ...item, rowId: nextRowId() }));
};

const fromRows = (rows: Row[]): HttpWorkshopKeyValue[] | undefined => {
  const items = rows
    .filter((row) => row.key.trim().length > 0)
    .map(({ key, value, enabled }) => ({ key: key.trim(), value, enabled }));
  return items.length > 0 ? items : undefined;
};

export type ApiTalkKeyValueListFieldProps = {
  value: HttpWorkshopKeyValue[] | undefined;
  onChange: (next: HttpWorkshopKeyValue[] | undefined) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  addLabel?: string;
  fieldLabel?: string;
};

export const ApiTalkKeyValueListField: React.FC<ApiTalkKeyValueListFieldProps> = ({
  value,
  onChange,
  keyPlaceholder = "key",
  valuePlaceholder = "value",
  addLabel = "Add",
  fieldLabel = "Entry",
}) => {
  const [rows, setRows] = useState<Row[]>(() => toRows(value));
  const skipSyncRef = useRef(false);

  useEffect(() => {
    if (skipSyncRef.current) {
      skipSyncRef.current = false;
      return;
    }
    setRows(toRows(value));
  }, [value]);

  const persist = useCallback((nextRows: Row[]) => {
    skipSyncRef.current = true;
    const padded = nextRows.length > 0 ? nextRows : [{ rowId: nextRowId(), key: "", value: "", enabled: true }];
    setRows(padded);
    onChange(fromRows(padded));
  }, [onChange]);

  const duplicateKeys = useMemo(() => {
    const seen = new Map<string, number>();
    for (const row of rows) {
      const key = row.key.trim();
      if (!key) continue;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    return new Set([...seen.entries()].filter(([, count]) => count > 1).map(([key]) => key));
  }, [rows]);

  return (
    <div className="flex flex-col gap-2">
      <div className="space-y-1.5">
        {rows.map((row) => {
          const duplicate = row.key.trim().length > 0 && duplicateKeys.has(row.key.trim());
          return (
            <div key={row.rowId} className="flex flex-col gap-1">
              <div className="grid grid-cols-[28px_minmax(0,1fr)_minmax(0,1.4fr)_28px] items-center gap-2">
                <input
                  type="checkbox"
                  checked={row.enabled}
                  aria-label={`${fieldLabel} enabled`}
                  className="h-3.5 w-3.5 rounded border-slate-300"
                  onChange={(event) => {
                    persist(rows.map((item) => (item.rowId === row.rowId ? { ...item, enabled: event.target.checked } : item)));
                  }}
                />
                <UiInput
                  size="sm"
                  placeholder={keyPlaceholder}
                  autoDir={false}
                  ariaLabel={`${fieldLabel} key`}
                  value={row.key}
                  onChange={(event) => {
                    persist(rows.map((item) => (item.rowId === row.rowId ? { ...item, key: event.target.value } : item)));
                  }}
                />
                <UiInput
                  size="sm"
                  placeholder={valuePlaceholder}
                  autoDir={false}
                  ariaLabel={`${fieldLabel} value`}
                  value={row.value}
                  onChange={(event) => {
                    persist(rows.map((item) => (item.rowId === row.rowId ? { ...item, value: event.target.value } : item)));
                  }}
                />
                <AppButton
                  type="button"
                  size="icon-sm"
                  tabStop="skip"
                  className={`${ICON_ACTION_BUTTON_SM_CLASS} ${ICON_ACTION_DELETE_CLASS}`}
                  aria-label={`Remove ${fieldLabel.toLowerCase()} row`}
                  onClick={() => {
                    const next = rows.filter((item) => item.rowId !== row.rowId);
                    persist(next);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                </AppButton>
              </div>
              {duplicate ? (
                <span className="ps-1 text-[10px] font-medium text-amber-600">Duplicate key — last row wins when enabled.</span>
              ) : null}
            </div>
          );
        })}
      </div>
      <AppButton type="button" intent="secondary" size="sm" className="h-7 w-full px-2 text-xs" onClick={() => persist([...rows, { rowId: nextRowId(), key: "", value: "", enabled: true }])}>
        <Plus className="mr-1 h-3 w-3" strokeWidth={2} />
        {addLabel}
      </AppButton>
    </div>
  );
};
