import React from 'react';
import type { AppTableGridColumnDef } from '../../../shared/lib/appTableGridQuery';
import type { GridRowActionItem } from '../../../shared/ui/AppGridRowActions';
import { AppTableGrid } from '../../../shared/ui/AppTableGrid';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { GridRowCountFooter } from '../../../shared/ui/GridRowCountFooter';
import { QueryErrorPanel } from '../../../shared/ui/QueryErrorPanel';
import type { LibraryGridRow } from '../types';

export type LibrariesTableGridProps = {
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  onRetry?: () => void;
  isRetrying?: boolean;
  columns: ReadonlyArray<AppTableGridColumnDef<LibraryGridRow>>;
  getCardRowActions?: (row: LibraryGridRow) => readonly GridRowActionItem[];
  rows: LibraryGridRow[];
  rowCount: number;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
};

export const LibrariesTableGrid: React.FC<LibrariesTableGridProps> = ({
  isLoading,
  isError,
  error,
  onRetry,
  isRetrying = false,
  columns,
  getCardRowActions,
  rows,
  rowCount,
  onScroll,
}) => (
  <AppTableGrid
    presentation="auto"
    persistListKey={APP_LIST_PREFERENCE_KEYS.libraries}
    columns={columns}
    rows={rows}
    getRowKey={(row) => row.name}
    getCardRowActions={getCardRowActions}
    onScroll={onScroll}
    compact={{ tablet: { cardsPerRow: 2 } }}
    isLoading={isLoading}
    loadingMessage="Loading libraries..."
    errorContent={
      isError && error ? (
        <QueryErrorPanel message="Failed to load libraries." detail={error} onRetry={onRetry} isRetrying={isRetrying} />
      ) : undefined
    }
    isEmpty={!isLoading && !(isError && error) && rows.length === 0}
    emptyMessage="No libraries found."
    footer={<GridRowCountFooter count={rowCount} />}
  />
);
