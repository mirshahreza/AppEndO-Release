import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DatasheetApiError,
  useCommitEdgeModelDatasheetRowMutation,
  useDeleteEdgeModelDatasheetRowMutation,
  useEdgeModelDatasheetQuery,
} from '../../../shared/api/queries/data-api-datasheet';
import { firstDatasheetRowError } from '../../../shared/api/contracts/data-api/datasheetCoerce';
import type { EdgeModelColumn } from '../../../shared/api/contracts/data-api';
import type { EdgeModelDatasheetLaunchContext } from './useEdgeModelDatasheetManager';

const resolvePkFields = (columns: EdgeModelColumn[], primaryKey: string | string[]): string[] => {
  const names = Array.isArray(primaryKey) ? primaryKey : [primaryKey];
  return names.map((name) => columns.find((column) => column.name === name)?.field ?? name);
};

export type DatasheetDraftRow = {
  clientId: string;
  isNew: boolean;
  original: Record<string, unknown> | null;
  values: Record<string, unknown>;
};

export type DatasheetFocusCell = {
  clientId: string;
  field: string;
};

const newClientId = (): string => `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const cloneValues = (row: Record<string, unknown>): Record<string, unknown> => ({ ...row });

const cellText = (value: unknown): string => (value == null ? '' : String(value));

const rowKey = (values: Record<string, unknown>, pkFields: string[]): Record<string, unknown> | null => {
  const key: Record<string, unknown> = {};
  for (const field of pkFields) {
    if (values[field] == null || values[field] === '') {
      return null;
    }
    key[field] = values[field];
  }
  return key;
};

const isBlankRow = (row: DatasheetDraftRow, columns: EdgeModelColumn[]): boolean => (
  columns.every((column) => cellText(row.values[column.field]).trim() === '')
);

const isRowDirty = (row: DatasheetDraftRow, columns: EdgeModelColumn[]): boolean => {
  if (row.isNew) {
    return !isBlankRow(row, columns);
  }
  if (!row.original) {
    return true;
  }
  return columns.some((column) => cellText(row.values[column.field]) !== cellText(row.original?.[column.field]));
};

const makeBlankRow = (columns: EdgeModelColumn[]): DatasheetDraftRow => {
  const values: Record<string, unknown> = {};
  for (const column of columns) {
    values[column.field] = '';
  }
  return { clientId: newClientId(), isNew: true, original: null, values };
};

const hasTrailingBlank = (list: DatasheetDraftRow[], columns: EdgeModelColumn[]): boolean => {
  const last = list[list.length - 1];
  return Boolean(last?.isNew && isBlankRow(last, columns));
};

const withTrailingBlank = (
  list: DatasheetDraftRow[],
  columns: EdgeModelColumn[],
  locked: boolean,
): DatasheetDraftRow[] => {
  if (locked || columns.length === 0 || hasTrailingBlank(list, columns)) {
    return list;
  }
  return [...list, makeBlankRow(columns)];
};

export function useEdgeModelDatasheetInstance(context: EdgeModelDatasheetLaunchContext) {
  const [sql, setSql] = useState('');
  const [draftSql, setDraftSql] = useState('');
  const [rows, setRows] = useState<DatasheetDraftRow[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, Record<string, string>>>({});
  const [focusCell, setFocusCell] = useState<DatasheetFocusCell | null>(null);
  const [savingClientId, setSavingClientId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const skipSaveRef = useRef<string | null>(null);
  const savingRef = useRef(new Set<string>());
  const lastSelectSqlRef = useRef('');

  const query = useEdgeModelDatasheetQuery(context.modelId, sql);
  const commitMutation = useCommitEdgeModelDatasheetRowMutation();
  const deleteMutation = useDeleteEdgeModelDatasheetRowMutation();

  useEffect(() => {
    if (!query.data) {
      return;
    }
    const locked = Boolean(query.data.readOnly || context.row.isControlPlaneLocked);
    const loaded = query.data.rows.map((row, index) => ({
      clientId: `loaded-${index}`,
      isNew: false,
      original: cloneValues(row),
      values: cloneValues(row),
    }));
    setRows(withTrailingBlank(loaded, query.data.columns, locked));
    setFieldErrors({});
    setFocusCell(null);
    if (query.data.selectSql && query.data.selectSql !== lastSelectSqlRef.current) {
      lastSelectSqlRef.current = query.data.selectSql;
      setDraftSql(query.data.selectSql);
    }
  }, [query.dataUpdatedAt, query.data]);

  const pkFields = useMemo(() => {
    if (!query.data) {
      return [] as string[];
    }
    return resolvePkFields(query.data.columns, query.data.primaryKey);
  }, [query.data]);

  const columns = query.data?.columns ?? [];
  const readOnly = Boolean(query.data?.readOnly || context.row.isControlPlaneLocked);

  const setFieldError = (clientId: string, field: string, message: string) => {
    setFieldErrors((current) => ({
      ...current,
      [clientId]: { ...current[clientId], [field]: message },
    }));
    setFocusCell({ clientId, field });
  };

  const clearRowErrors = (clientId: string) => {
    setFieldErrors((current) => {
      if (!current[clientId]) {
        return current;
      }
      const next = { ...current };
      delete next[clientId];
      return next;
    });
  };

  const saveRow = useCallback(async (clientId: string): Promise<boolean> => {
    if (readOnly) {
      return true;
    }
    if (skipSaveRef.current === clientId) {
      skipSaveRef.current = null;
      return true;
    }
    const row = rowsRef.current.find((item) => item.clientId === clientId);
    if (!row) {
      return true;
    }
    if (row.isNew && isBlankRow(row, columns)) {
      return true;
    }
    if (!isRowDirty(row, columns)) {
      return true;
    }
    if (savingRef.current.has(clientId)) {
      return false;
    }

    const error = firstDatasheetRowError(columns, row.values, {
      omitEmptyPrimaryKey: row.isNew,
      omitPrimaryKey: !row.isNew,
    });
    if (error) {
      setFieldError(clientId, error.field, error.message);
      return false;
    }

    savingRef.current.add(clientId);
    setSavingClientId(clientId);
    try {
      const saved = await commitMutation.mutateAsync({
        modelId: context.modelId,
        isNew: row.isNew,
        key: row.isNew ? null : rowKey(row.original ?? row.values, pkFields),
        values: row.values,
      });
      setRows((current) => {
        const next = current.map((item) => (
          item.clientId === clientId
            ? {
                ...item,
                isNew: false,
                original: cloneValues(saved),
                values: cloneValues(saved),
              }
            : item
        ));
        return row.isNew ? withTrailingBlank(next, columns, readOnly) : next;
      });
      clearRowErrors(clientId);
      return true;
    } catch (caught) {
      const field = caught instanceof DatasheetApiError ? caught.field : undefined;
      const message = caught instanceof Error ? caught.message : 'Failed to save row.';
      const fallbackField = columns.find((column) => !pkFields.includes(column.field))?.field
        ?? columns[0]?.field;
      if (field || fallbackField) {
        setFieldError(clientId, field ?? fallbackField ?? '', message);
      }
      return false;
    } finally {
      savingRef.current.delete(clientId);
      setSavingClientId((current) => (current === clientId ? null : current));
    }
  }, [columns, commitMutation, context.modelId, pkFields, readOnly]);

  const updateCell = (clientId: string, field: string, value: string) => {
    setRows((current) => current.map((row) => (
      row.clientId === clientId
        ? { ...row, values: { ...row.values, [field]: value } }
        : row
    )));
    setFieldErrors((current) => {
      if (!current[clientId]?.[field]) {
        return current;
      }
      const nextRow = { ...current[clientId] };
      delete nextRow[field];
      const next = { ...current };
      if (Object.keys(nextRow).length === 0) {
        delete next[clientId];
      } else {
        next[clientId] = nextRow;
      }
      return next;
    });
  };

  const markSkipSave = (clientId: string) => {
    skipSaveRef.current = clientId;
  };

  const requestDelete = (clientId: string) => {
    const last = rowsRef.current[rowsRef.current.length - 1];
    if (last?.clientId === clientId && last.isNew && isBlankRow(last, columns)) {
      return;
    }
    skipSaveRef.current = clientId;
    setPendingDeleteId(clientId);
  };

  const cancelDelete = () => {
    setPendingDeleteId(null);
  };

  const confirmDelete = async () => {
    const clientId = pendingDeleteId;
    if (!clientId) {
      return;
    }
    const row = rowsRef.current.find((item) => item.clientId === clientId);
    if (!row) {
      setPendingDeleteId(null);
      return;
    }
    if (!row.isNew) {
      const key = rowKey(row.original ?? row.values, pkFields);
      if (!key) {
        setFieldError(clientId, pkFields[0] ?? columns[0]?.field ?? '', 'Primary key is required to delete.');
        setPendingDeleteId(null);
        return;
      }
      try {
        await deleteMutation.mutateAsync({ modelId: context.modelId, key });
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'Failed to delete row.';
        const field = caught instanceof DatasheetApiError ? caught.field : undefined;
        setFieldError(clientId, field ?? pkFields[0] ?? columns[0]?.field ?? '', message);
        setPendingDeleteId(null);
        return;
      }
    }
    setRows((current) => withTrailingBlank(
      current.filter((item) => item.clientId !== clientId),
      columns,
      readOnly,
    ));
    clearRowErrors(clientId);
    setPendingDeleteId(null);
  };

  const flushThen = async (next: () => void) => {
    for (const row of rowsRef.current) {
      if (!isRowDirty(row, columns)) {
        continue;
      }
      const ok = await saveRow(row.clientId);
      if (!ok) {
        return;
      }
    }
    next();
  };

  const clearFocusCell = useCallback(() => {
    setFocusCell(null);
  }, []);

  const commitSql = () => {
    void flushThen(() => {
      setSql(draftSql);
    });
  };

  const scratchClientId = useMemo(() => {
    if (readOnly) {
      return null;
    }
    const last = rows[rows.length - 1];
    if (last?.isNew && isBlankRow(last, columns)) {
      return last.clientId;
    }
    return null;
  }, [columns, readOnly, rows]);
  const pendingDeleteRow = rows.find((row) => row.clientId === pendingDeleteId) ?? null;
  const sqlError = query.isError
    ? (query.error instanceof Error ? query.error.message : 'Failed to load rows.')
    : null;

  return {
    query,
    draftSql,
    setDraftSql,
    commitSql,
    sqlError,
    rows,
    readOnly,
    pkFields,
    columns,
    fieldErrors,
    focusCell,
    clearFocusCell,
    savingClientId,
    updateCell,
    saveRow,
    markSkipSave,
    requestDelete,
    cancelDelete,
    confirmDelete,
    pendingDeleteRow,
    scratchClientId,
    isDeleting: deleteMutation.isPending,
  };
}
