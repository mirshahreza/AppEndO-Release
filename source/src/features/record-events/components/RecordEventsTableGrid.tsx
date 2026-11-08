import React from 'react';
import type { GridColumnLayoutChangeMeta, GridColumnLayoutState } from '../../../shared/lib/appTableGridColumnLayout';
import type { AppTableGridColumnDef, GridQueryState } from '../../../shared/lib/appTableGridQuery';
import type { RecordEventPublicRow } from '../../../shared/api/contracts/record-events';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { AppTableGrid } from '../../../shared/ui/AppTableGrid';
import { QueryErrorPanel } from '../../../shared/ui/QueryErrorPanel';
import { useCultureT } from '../../../core/culture/CultureContext';
import { operationsKey } from '../../../core/culture/translations/cultureKeyHelpers';
import { recordEventRowActions, type RecordEventGridHandlers } from '../recordEventGridColumns';

export type RecordEventsTableGridProps = {
  isLoading: boolean;
  isError: boolean;
  loadError: string | null;
  onRetry?: () => void;
  isRetrying?: boolean;
  columns: ReadonlyArray<AppTableGridColumnDef<RecordEventPublicRow>>;
  columnLayout: GridColumnLayoutState;
  handleColumnLayoutChange: (layout: GridColumnLayoutState, meta: GridColumnLayoutChangeMeta) => void;
  rows: RecordEventPublicRow[];
  query: GridQueryState;
  onQueryChange: (query: GridQueryState) => void;
  footer?: React.ReactNode;
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
  handlers: RecordEventGridHandlers;
};

export const RecordEventsTableGrid: React.FC<RecordEventsTableGridProps> = ({
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
  handlers,
}) => {
  const t = useCultureT();
  const emptyMessage = t(operationsKey('recordEvents.empty'));
  const loadingMessage = t(operationsKey('recordEvents.loading'));
  const loadFailed = t(operationsKey('recordEvents.loadFailed'));

  return (
  <AppTableGrid
    presentation="auto"
    size="sm"
    tableClassName="text-slate-700"
    theadClassName="text-xs font-bold text-slate-500 uppercase tracking-wider"
    columns={columns}
    enableColumnLayout
    persistListKey={APP_LIST_PREFERENCE_KEYS.recordEvents}
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
    loadingMessage={loadingMessage}
    errorContent={
      isError && loadError ? (
        <QueryErrorPanel
          message={loadFailed}
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
    getCardRowActions={(row) => recordEventRowActions(row as RecordEventPublicRow, handlers)}
  />
  );
};
