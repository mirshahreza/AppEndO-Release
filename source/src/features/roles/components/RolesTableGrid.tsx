import React from 'react';
import type { AppTableGridColumnDef } from '../../../shared/lib/appTableGridQuery';
import type { GridRowActionItem } from '../../../shared/ui/AppGridRowActions';
import { AppTableGrid } from '../../../shared/ui/AppTableGrid';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { QueryErrorPanel } from '../../../shared/ui/QueryErrorPanel';
import type { RoleRecord } from '../types';

export type RolesTableGridProps = {
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  onRetry?: () => void;
  isRetrying?: boolean;
  columns: ReadonlyArray<AppTableGridColumnDef<RoleRecord>>;
  rows: RoleRecord[];
  getCardRowActions?: (row: RoleRecord) => readonly GridRowActionItem[];
  onScroll?: React.UIEventHandler<HTMLDivElement>;
};

export const RolesTableGrid: React.FC<RolesTableGridProps> = ({
  isLoading,
  isError,
  error,
  onRetry,
  isRetrying = false,
  columns,
  rows,
  getCardRowActions,
  onScroll,
}) => (
  <AppTableGrid
    presentation="auto"
    compact={{ tablet: { cardsPerRow: 2 } }}
    persistListKey={APP_LIST_PREFERENCE_KEYS.roles}
    columns={columns}
    rows={rows}
    getRowKey={(role) => role.id}
    getCardRowActions={getCardRowActions}
    onScroll={onScroll}
    isLoading={isLoading}
    loadingMessage="Loading roles..."
    errorContent={
      isError && error ? (
        <QueryErrorPanel message="Failed to load roles." detail={error} onRetry={onRetry} isRetrying={isRetrying} />
      ) : undefined
    }
    isEmpty={!isLoading && !(isError && error) && rows.length === 0}
    emptyMessage="No roles found."
  />
);
