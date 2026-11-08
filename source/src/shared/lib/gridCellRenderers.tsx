import React from 'react';
import { Check, X } from 'lucide-react';
import type { AppTableGridColumnDef } from './appTableGridQuery';
import { APP_TABLE_GRID_AUDIT_COLUMN_WIDTH } from '../ui/surfaceClasses';
import { MountGridDateText } from '../../app/platform/MountGridDateText';

export type AuditRow = {
  createdAt?: string;
  createdByUsername?: string | null;
  createdBy?: number | null;
  updatedAt?: string;
  updatedByUsername?: string | null;
  updatedBy?: number | null;
};

export const renderBooleanIcon = (value: boolean | null | undefined) => {
  if (value == null) return <span className="text-slate-300">-</span>;
  return value
    ? <Check className="h-3.5 w-3.5 text-emerald-700" aria-label="Yes" />
    : <X className="h-3.5 w-3.5 text-rose-700" aria-label="No" />;
};

export const renderActorLabel = (username?: string | null, actorId?: number | null) => {
  const label = username || (actorId ? `#${actorId}` : null);
  if (!label) return <span className="text-slate-300">-</span>;
  return <span className="text-slate-600">{label}</span>;
};

export function createAuditColumns<T extends AuditRow>(): AppTableGridColumnDef<T>[] {
  return [
    {
      id: 'created',
      label: 'Created',
      width: APP_TABLE_GRID_AUDIT_COLUMN_WIDTH,
      cellClassName: 'text-[11px] text-slate-600',
      renderCell: (row) => (
        <div className="flex flex-col items-start leading-tight">
          <MountGridDateText value={row.createdAt} />
          <span className="text-[10px] text-slate-400">
            {row.createdByUsername || (row.createdBy ? `#${row.createdBy}` : '-')}
          </span>
        </div>
      ),
      sort: false,
      filter: false,
    },
    {
      id: 'updated',
      label: 'Updated',
      width: APP_TABLE_GRID_AUDIT_COLUMN_WIDTH,
      cellClassName: 'text-[11px] text-slate-600',
      renderCell: (row) => (
        <div className="flex flex-col items-start leading-tight">
          <MountGridDateText value={row.updatedAt} />
          <span className="text-[10px] text-slate-400">
            {row.updatedByUsername || (row.updatedBy ? `#${row.updatedBy}` : '-')}
          </span>
        </div>
      ),
      sort: false,
      filter: false,
    },
  ];
}
