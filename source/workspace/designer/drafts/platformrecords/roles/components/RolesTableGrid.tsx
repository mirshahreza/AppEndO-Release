import React from 'react';
import type { AppTableGridColumnDef } from '@/src/shared/lib/appTableGridQuery';
import { AppTableGrid } from '@/src/shared/ui/AppTableGrid';
import { GridRowCountFooter } from '@/src/shared/ui/GridRowCountFooter';
import { QueryErrorPanel } from '@/src/shared/ui/QueryErrorPanel';
import type { RoleRecord } from '../types';

export type RolesTableGridProps = {
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  onRetry?: () => void;
  isRetrying?: boolean;
  columns: ReadonlyArray<AppTableGridColumnDef<RoleRecord>>;
  rows: RoleRecord[];
  rowCount: number;
};

export const RolesTableGrid: React.FC<RolesTableGridProps> = ({
  isLoading,
  isError,
  error,
  onRetry,
  isRetrying = false,
  columns,
  rows,
  rowCount,
}) => (
  <AppTableGrid
    presentation="auto"
    columns={columns}
    rows={rows}
    getRowKey={(role) => role.id}
    isLoading={isLoading}
    loadingMessage="Loading roles..."
    errorContent={
      isError && error ? (
        <QueryErrorPanel message="Failed to load roles." detail={error} onRetry={onRetry} isRetrying={isRetrying} />
      ) : undefined
    }
    isEmpty={!isLoading && !(isError && error) && rows.length === 0}
    emptyMessage="No roles found."
    footer={<GridRowCountFooter count={rowCount} />}
  />
);
