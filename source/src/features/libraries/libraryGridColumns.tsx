import React from 'react';
import { ArrowUpCircle, Trash2 } from 'lucide-react';
import { BuiltInBadge, CatalogSystemTagBadge } from '../../shared/ui';
import { AppGridRowActions, type GridRowActionItem } from '../../shared/ui/AppGridRowActions';
import type { AppTableGridColumnDef } from '../../shared/lib/appTableGridQuery';
import { gridActionsColumnWidth } from '../../shared/lib/gridRowActions';
import {
  APP_TABLE_GRID_EMPTY_VALUE,
  APP_TABLE_GRID_EMPTY_VALUE_CLASS,
} from '../../shared/ui/surfaceClasses';
import type { LibraryGridRow } from './types';

const LIBRARY_ACTIONS_COLUMN_WIDTH = gridActionsColumnWidth(2);

const EmptyGridValue: React.FC = () => (
  <span className={APP_TABLE_GRID_EMPTY_VALUE_CLASS}>{APP_TABLE_GRID_EMPTY_VALUE}</span>
);

export type LibraryGridColumnHandlers = {
  onUpgrade: (row: LibraryGridRow) => void;
  onUninstall: (row: LibraryGridRow) => void;
  pendingName: string | null;
};

export function createLibraryCardRowActions(
  row: LibraryGridRow,
  handlers: LibraryGridColumnHandlers,
): GridRowActionItem[] {
  const busy = handlers.pendingName === row.name;
  const locked = row.core || busy;
  return [
    {
      id: 'upgrade',
      label: 'Upgrade',
      icon: <ArrowUpCircle className="h-3.5 w-3.5" />,
      intent: 'edit',
      disabled: locked,
      onClick: () => handlers.onUpgrade(row),
    },
    {
      id: 'uninstall',
      label: 'Uninstall',
      icon: <Trash2 className="h-3.5 w-3.5" />,
      intent: 'delete',
      disabled: locked,
      onClick: () => handlers.onUninstall(row),
    },
  ];
}

export function createLibraryGridColumns(
  handlers: LibraryGridColumnHandlers,
): AppTableGridColumnDef<LibraryGridRow>[] {
  return [
    {
      id: 'name',
      label: 'Name',
      card: { role: 'title' },
      renderCell: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-800">{row.name}</span>
      ),
    },
    {
      id: 'version',
      label: 'Version',
      width: 120,
      renderCell: (row) => (
        row.version ? (
          <span className="font-mono text-xs text-slate-600">{row.version}</span>
        ) : (
          <EmptyGridValue />
        )
      ),
    },
    {
      id: 'kind',
      label: 'Type',
      width: 96,
      cellClassName: 'text-center',
      headerClassName: 'text-center',
      card: { role: 'field', label: 'Type' },
      renderCell: (row) => (row.core ? (
        <BuiltInBadge className="mx-auto min-w-[3.75rem]" />
      ) : (
        <CatalogSystemTagBadge tag="custom" className="mx-auto min-w-[3.75rem]" />
      )),
    },
    {
      id: 'requestedBy',
      label: 'Requested by',
      width: 220,
      renderCell: (row) => (
        row.requestedBy.length > 0 ? (
          <span className="text-xs text-slate-600">{row.requestedBy.join(', ')}</span>
        ) : (
          <EmptyGridValue />
        )
      ),
    },
    {
      id: 'actions',
      label: '',
      width: LIBRARY_ACTIONS_COLUMN_WIDTH,
      sort: false,
      filter: false,
      layout: { hideable: false, resizable: false },
      headerClassName: 'text-end',
      cellClassName: 'text-end',
      card: { role: 'actions' },
      renderCell: (row) => (
        <AppGridRowActions
          align="end"
          actions={createLibraryCardRowActions(row, handlers)}
        />
      ),
    },
  ];
}
