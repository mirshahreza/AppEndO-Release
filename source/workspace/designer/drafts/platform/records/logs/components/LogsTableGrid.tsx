import React from 'react';
import type { GridColumnLayoutChangeMeta, GridColumnLayoutState } from '@/shared/lib/appTableGridColumnLayout';
import type { GridQueryState } from '@/shared/lib/appTableGridQuery';
import type { AppTableGridColumnDef } from '@/shared/lib/appTableGridQuery';
import { AppTableGrid } from '@/shared/ui/AppTableGrid';
import { QueryErrorPanel } from '@/shared/ui/QueryErrorPanel';
import { useCultureT } from '@/core/culture/CultureContext';
import { operationsKey } from '@/core/culture/translations/cultureKeyHelpers';
import type { LogSummaryItem } from '../types';

export type LogsTableGridProps = {
  isLoading: boolean;
  isError: boolean;
  loadError: string | null;
  onRetry?: () => void;
  isRetrying?: boolean;
  columns: ReadonlyArray<AppTableGridColumnDef<LogSummaryItem>>;
  columnLayout: GridColumnLayoutState;
  handleColumnLayoutChange: (layout: GridColumnLayoutState, meta: GridColumnLayoutChangeMeta) => void;
  rows: LogSummaryItem[];
  query: GridQueryState;
  onQueryChange: (query: GridQueryState) => void;
  footer?: React.ReactNode;
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
};

export const LogsTableGrid: React.FC<LogsTableGridProps> = ({
  isLoading,
  isError,
  loadError,
  onRetry,
  isRetrying = false,
  columns,
  columnLayout,
  handleColumnLayoutChange,
  rows,
  query,
  onQueryChange,
  footer,
  onScroll,
}) => {
  const t = useCultureT();
  const emptyMessage = t(operationsKey('logs.empty'));

  return (
    <AppTableGrid
      presentation="auto"
      size="sm"
      tableClassName="text-slate-700"
      theadClassName="text-xs font-bold text-slate-500 uppercase tracking-wider"
      columns={columns}
      enableColumnLayout
      columnLayout={columnLayout}
      onColumnLayoutChange={handleColumnLayoutChange}
      rows={rows}
      getRowKey={(item) => item.id}
      gridQueryMode="server"
      query={query}
      onQueryChange={onQueryChange}
      onScroll={onScroll}
      footer={footer}
      isLoading={isLoading}
      loadingMessage={t(operationsKey('logs.loading'))}
      errorContent={
        isError && loadError ? (
          <QueryErrorPanel
            message={t(operationsKey('logs.loadFailed'))}
            detail={loadError}
            onRetry={onRetry}
            isRetrying={isRetrying}
            className="h-32"
          />
        ) : undefined
      }
      isEmpty={!isLoading && !(isError && loadError) && rows.length === 0}
      emptyMessage={emptyMessage}
      emptyContent={<div className="h-32 flex items-center justify-center text-sm text-slate-500">{emptyMessage}</div>}
    />
  );
};
