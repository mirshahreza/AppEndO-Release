import React from 'react';
import { Clock, Eye, ScrollText } from 'lucide-react';
import type { RecordEventPublicRow } from '../../shared/api/contracts/record-events';
import type { AppTableGridColumnDef } from '../../shared/lib/appTableGridQuery';
import { gridActionsColumnWidth, resolveGridActionSlotCount } from '../../shared/lib/gridRowActions';
import { AppGridRowActions, type GridRowActionItem } from '../../shared/ui';
import {
  formatRecordEventOccurredAt,
  recordEventActorStackedLabel,
  recordEventReasonStackedLabel,
} from '../../shared/lib/formatRecordEventValue';
import { RecordEventStackedLabelCell } from '../../shared/ui/recordEventHistoryGridColumns';
import { formatRecordEventValue } from './formatRecordEventValue';

export type RecordEventGridHandlers = {
  onOpenDetail: (item: RecordEventPublicRow) => void;
  onViewHttpLog: (requestId: string) => void;
  entityTitles?: Record<string, string>;
};

const chipClass = 'inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700';

const outcomeClass: Record<string, string> = {
  success: 'bg-emerald-50 text-emerald-700',
  denied: 'bg-rose-50 text-rose-700',
  failed: 'bg-amber-50 text-amber-800',
};

export const recordEventRowActions = (
  item: RecordEventPublicRow,
  handlers: RecordEventGridHandlers,
): GridRowActionItem[] => {
  const actions: GridRowActionItem[] = [
    {
      id: 'view',
      label: 'View details',
      icon: <Eye className="h-3.5 w-3.5" />,
      intent: 'view',
      onClick: () => handlers.onOpenDetail(item),
    },
  ];
  if (item.requestId) {
    actions.push({
      id: 'http-log',
      label: 'View HTTP log',
      icon: <ScrollText className="h-3.5 w-3.5" />,
      intent: 'utility',
      onClick: () => handlers.onViewHttpLog(item.requestId as string),
    });
  }
  return actions;
};

export function createRecordEventGridColumns(
  handlers: RecordEventGridHandlers,
): AppTableGridColumnDef<RecordEventPublicRow>[] {
  return [
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
      sort: { mode: 'server' },
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
      sort: { mode: 'server' },
      filter: false,
    },
    {
      id: 'subjectKind',
      label: 'Model',
      headerClassName: 'text-start',
      cellClassName: 'py-1.5 font-mono text-xs text-slate-700 whitespace-nowrap text-start',
      card: { role: 'field', label: 'Model' },
      renderCell: (item) => {
        const label = handlers.entityTitles?.[item.subjectKind] ?? item.subjectKind;
        return <span title={item.subjectKind}>{label}</span>;
      },
      getSortValue: (item) => item.subjectKind,
      sort: { mode: 'server' },
      filter: false,
    },
    {
      id: 'subjectId',
      label: 'Record',
      headerClassName: 'text-start',
      cellClassName: 'py-1.5 font-mono text-xs text-slate-700 whitespace-nowrap text-start',
      card: { role: 'field', label: 'Record' },
      hideBelow: 'md',
      renderCell: (item) => item.subjectId,
      getSortValue: (item) => item.subjectId,
      sort: { mode: 'server' },
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
      sort: { mode: 'server' },
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
      sort: { mode: 'server' },
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
      sort: { mode: 'server' },
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
    {
      id: 'actions',
      label: '',
      layout: { hideable: false, resizable: false },
      headerClassName: 'text-start',
      cellClassName: 'text-start',
      width: gridActionsColumnWidth(resolveGridActionSlotCount(2, 2)),
      card: { role: 'actions' },
      renderCell: (item) => (
        <AppGridRowActions actions={recordEventRowActions(item, handlers)} maxVisible={2} align="start" />
      ),
      sort: false,
      filter: false,
    },
  ];
}
