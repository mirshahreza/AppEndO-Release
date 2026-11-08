import React, { useMemo, type UIEventHandler } from 'react';
import type { ExecuteDataSourceQueryResult } from '../../../shared/api/contracts/data-sources/executeQuery';
import { formatDataSourceExplainPlan } from '../../../shared/lib/formatDataSourceExplainPlan';
import { AppTableGrid } from '../../../shared/ui';
import type { AppTableGridColumnDef } from '../../../shared/lib/appTableGridQuery';
import { DataSourceExplainPlanView } from './DataSourceExplainPlanView';

const isRecordRow = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

/** Derives grid columns from the first 20 result rows — column set is unknown ahead of time. */
export const buildDataSourceQueryResultColumns = (
  rows: Record<string, unknown>[],
): AppTableGridColumnDef<Record<string, unknown>>[] => {
  const keys = new Set<string>();
  for (const row of rows.slice(0, 20)) {
    for (const key of Object.keys(row)) {
      keys.add(key);
    }
  }

  return Array.from(keys).sort((left, right) => left.localeCompare(right)).map((key) => ({
    id: key,
    label: key,
    sort: false,
    filter: false,
    getSortValue: (row) => {
      const value = row[key];
      if (value === null || value === undefined) {
        return '';
      }
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return String(value);
    },
    renderCell: (row) => {
      const value = row[key];
      if (value === null || value === undefined) {
        return <span className="text-slate-400">—</span>;
      }
      if (typeof value === 'object') {
        return (
          <span className="block max-w-full truncate font-mono text-[11px] text-slate-700">
            {JSON.stringify(value)}
          </span>
        );
      }
      return <span className="block max-w-full truncate text-[11px] text-slate-800">{String(value)}</span>;
    },
  }));
};

export type DataSourceQueryResultViewProps = {
  result: ExecuteDataSourceQueryResult | null;
  error: string | null;
  isSubmitting: boolean;
  idleMessage?: string;
  onScroll?: UIEventHandler<HTMLDivElement>;
};

export const DataSourceQueryResultView: React.FC<DataSourceQueryResultViewProps> = ({
  result,
  error,
  isSubmitting,
  idleMessage = 'Run a query to see results here.',
  onScroll,
}) => {
  const gridRows = useMemo(() => {
    if (!result?.data?.length) {
      return [];
    }
    if (!result.data.every(isRecordRow)) {
      return [];
    }
    return result.data;
  }, [result]);

  const gridColumns = useMemo(
    () => buildDataSourceQueryResultColumns(gridRows),
    [gridRows],
  );

  const explainPlan = useMemo(
    () => (gridRows.length > 0 ? formatDataSourceExplainPlan(gridRows) : null),
    [gridRows],
  );

  if (isSubmitting) {
    return <p className="p-3 text-[11px] text-slate-500">Running…</p>;
  }

  if (error) {
    return (
      <pre className="m-3 whitespace-pre-wrap break-words rounded border border-rose-200 bg-rose-50 p-2 font-mono text-[11px] text-rose-700">
        {error}
      </pre>
    );
  }

  if (!result) {
    if (!idleMessage) {
      return null;
    }
    return <p className="p-3 text-[11px] text-slate-400">{idleMessage}</p>;
  }

  if (explainPlan && explainPlan.length > 0) {
    return <DataSourceExplainPlanView items={explainPlan} truncated={result.truncated} />;
  }

  if (gridRows.length > 0 && gridColumns.length > 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {result.truncated ? (
          <p className="shrink-0 px-3 py-1.5 text-[10px] text-amber-600">Results were truncated to the platform row/size limit.</p>
        ) : null}
        <AppTableGrid
          presentation="auto"
          columns={gridColumns}
          rows={gridRows}
          getRowKey={(row) => JSON.stringify(row)}
          isEmpty={false}
          emptyMessage="No rows returned."
          onScroll={onScroll}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {result.truncated ? (
        <p className="shrink-0 px-3 py-1.5 text-[10px] text-amber-600">Results were truncated to the platform row/size limit.</p>
      ) : null}
      <pre
        className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-slate-800"
        onScroll={onScroll}
      >
        {result.data.length === 0 ? 'No rows returned.' : JSON.stringify(result.data, null, 2)}
      </pre>
    </div>
  );
};
