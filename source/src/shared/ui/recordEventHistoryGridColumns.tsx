import React from 'react';
import { Clock, RotateCcw } from 'lucide-react';
import type { RecordEventPublicRow } from '../api/contracts/record-events';
import {
  canRestoreRecordEvent,
  formatRecordEventOccurredAt,
  formatRecordEventValue,
  recordEventActorStackedLabel,
  recordEventReasonStackedLabel,
  type RecordEventStackedLabel,
} from '../lib/formatRecordEventValue';
import type { AppTableGridColumnDef } from '../lib/appTableGridQuery';
import { gridActionsColumnWidth, resolveGridActionSlotCount } from '../lib/gridRowActions';
import { AppGridRowActions, type GridRowActionItem } from './AppGridRowActions';

export type RecordSubjectHistoryGridHandlers = {
  onRestore?: (item: RecordEventPublicRow) => void;
};

const chipClass = 'inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700';

export const RecordEventStackedLabelCell: React.FC<{ view: RecordEventStackedLabel }> = ({ view }) => (
  <div
    className="min-w-0 leading-tight"
    title={[view.title, view.subtitle].filter(Boolean).join(' · ')}
  >
    <p className="truncate text-xs font-medium text-slate-700">{view.title}</p>
    {view.subtitle ? <p className="truncate text-[11px] text-slate-500">{view.subtitle}</p> : null}
  </div>
);

const outcomeClass: Record<string, string> = {
  success: 'bg-emerald-50 text-emerald-700',
  denied: 'bg-rose-50 text-rose-700',
  failed: 'bg-amber-50 text-amber-800',
};

export const recordSubjectHistoryRowActions = (
  item: RecordEventPublicRow,
  handlers: RecordSubjectHistoryGridHandlers,
): GridRowActionItem[] => {
  if (!handlers.onRestore) return [];
  return [{
    id: 'restore',
    label: 'Restore previous value',
    icon: <RotateCcw className="h-3.5 w-3.5" />,
    intent: 'edit',
    disabled: !canRestoreRecordEvent(item),
    onClick: () => handlers.onRestore?.(item),
  }];
};

export function createRecordSubjectHistoryGridColumns(
  handlers: RecordSubjectHistoryGridHandlers,
): AppTableGridColumnDef<RecordEventPublicRow>[] {
  const columns: AppTableGridColumnDef<RecordEventPublicRow>[] = [
    {
      id: 'occurredAt',
      label: 'Time',
      headerClassName: 'text-start',
      cellClassName: 'py-1.5 font-mono text-[11px] text-slate-500 whitespace-nowrap text-start',
      card: { role: 'title' },
      renderCell: (item) => (
        <span className="inline-flex items-center gap-1">
          {formatRecordEventOccurredAt(item.occurredAt)}
          {typeof item.clockSkewMinutes === 'number' && item.clockSkewMinutes > 5 ? (
            <Clock className="h-3 w-3 text-amber-700" aria-label="Device clock differs from the server" />
          ) : null}
        </span>
      ),
      getSortValue: (item) => item.occurredAt,
      sort: { mode: 'client' },
      filter: false,
    },
    {
      id: 'eventKind',
      label: 'Kind',
      headerClassName: 'text-start',
      cellClassName: 'py-1.5 text-start',
      card: { role: 'subtitle' },
      renderCell: (item) => (
        <span className={chipClass}>
          {item.projection === 'auth' ? 'Sign-in' : item.eventKind}
        </span>
      ),
      getSortValue: (item) => item.eventKind,
      sort: { mode: 'client' },
      filter: false,
    },
    {
      id: 'field',
      label: 'Field',
      headerClassName: 'text-start',
      cellClassName: 'py-1.5 font-mono text-xs text-slate-500 whitespace-nowrap text-start',
      card: { role: 'field', label: 'Field' },
      renderCell: (item) => item.field ?? '—',
      getSortValue: (item) => item.field ?? '',
      sort: { mode: 'client' },
      filter: false,
    },
    {
      id: 'change',
      label: 'Change',
      headerClassName: 'text-start',
      cellClassName: 'py-1.5 text-xs text-slate-600 whitespace-nowrap max-w-[280px] truncate text-start',
      card: { role: 'field', label: 'Change' },
      renderCell: (item) => {
        const text = `${formatRecordEventValue(item.fromValue)} → ${formatRecordEventValue(item.toValue)}`;
        return <span title={text}>{text}</span>;
      },
      getSortValue: (item) => formatRecordEventValue(item.toValue),
      sort: false,
      filter: false,
    },
    {
      id: 'outcome',
      label: 'Outcome',
      headerClassName: 'text-start',
      cellClassName: 'py-1.5 text-start',
      card: { role: 'meta', label: 'Outcome' },
      hideBelow: 'md',
      renderCell: (item) => (
        <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${outcomeClass[item.outcome] ?? chipClass}`}>
          {item.outcome}
        </span>
      ),
      getSortValue: (item) => item.outcome,
      sort: { mode: 'client' },
      filter: false,
    },
    {
      id: 'actorUserId',
      label: 'Actor',
      headerClassName: 'text-start',
      cellClassName: 'py-1.5 text-start',
      wrap: true,
      card: { role: 'field', label: 'Actor' },
      hideBelow: 'lg',
      renderCell: (item) => <RecordEventStackedLabelCell view={recordEventActorStackedLabel(item)} />,
      getSortValue: (item) => {
        const view = recordEventActorStackedLabel(item);
        return [view.title, view.subtitle].filter(Boolean).join(' ');
      },
      sort: { mode: 'client' },
      filter: false,
    },
    {
      id: 'reason',
      label: 'Reason',
      headerClassName: 'text-start',
      cellClassName: 'py-1.5 max-w-[220px] text-start',
      wrap: true,
      card: { role: 'field', label: 'Reason' },
      hideBelow: 'lg',
      renderCell: (item) => <RecordEventStackedLabelCell view={recordEventReasonStackedLabel(item)} />,
      getSortValue: (item) => {
        const view = recordEventReasonStackedLabel(item);
        return [view.title, view.subtitle].filter(Boolean).join(' ');
      },
      sort: false,
      filter: false,
    },
  ];
  if (handlers.onRestore) {
    columns.push({
      id: 'actions',
      label: '',
      layout: { hideable: false, resizable: false },
      headerClassName: 'text-start',
      cellClassName: 'text-start',
      width: gridActionsColumnWidth(resolveGridActionSlotCount(1, 1)),
      card: { role: 'actions' },
      renderCell: (item) => {
        const actions = recordSubjectHistoryRowActions(item, handlers);
        if (actions.length === 0) return null;
        return <AppGridRowActions actions={actions} maxVisible={1} align="start" />;
      },
      sort: false,
      filter: false,
    });
  }
  return columns;
}
