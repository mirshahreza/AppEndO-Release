import React from 'react';
import { Check, Eye, Timer, X } from 'lucide-react';
import type { TranslationFn } from '../../core/culture/TranslationRuntime';
import { columnCommonKey } from '../../core/culture/translations/cultureKeyHelpers';
import type { AppTableGridColumnDef } from '../../shared/lib/appTableGridQuery';
import { ActionTooltip } from '../../shared/ui/ActionTooltip';
import type { GridRowActionItem } from '../../shared/ui';
import { formatRecordEventOccurredAt } from '../../shared/lib/formatRecordEventValue';
import { ACTION_BUTTON_BASE_CLASS, ACTION_COLUMN_WIDTH, levelBadgeClass } from './constants';
import type { LogSummaryItem } from './types';
import { parseLogParts } from './utils/parseLogParts';

export type LogGridColumnHandlers = {
  onOpenDetail: (id: number) => void;
};

export const logRowActions = (
  item: LogSummaryItem,
  handlers: LogGridColumnHandlers,
): GridRowActionItem[] => [
  {
    id: 'view-details',
    label: 'View details',
    icon: <Eye className="h-3.5 w-3.5" />,
    intent: 'view',
    cardLabeled: true,
    onClick: () => handlers.onOpenDetail(item.id),
  },
];

export function createLogGridColumns(
  handlers: LogGridColumnHandlers,
  t: TranslationFn,
): AppTableGridColumnDef<LogSummaryItem>[] {
  return [
    {
      id: 'level',
      label: 'Level',
      headerClassName: 'text-start',
      cellClassName: 'py-1.5 text-start',
      card: { role: 'meta', priority: -10 },
      renderCell: (item) => (
        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${levelBadgeClass[item.level]}`}>
          {item.level}
        </span>
      ),
      getSortValue: (item) => item.level,
      sort: { mode: 'server' },
      filter: false,
    },
    {
      id: 'actor',
      label: t(columnCommonKey('actor')),
      headerClassName: 'text-start',
      cellClassName: 'py-1.5 text-xs text-slate-700 whitespace-nowrap max-w-[220px] truncate text-start',
      card: { role: 'field', label: t(columnCommonKey('actor')) },
      renderCell: (item) => {
        const safeActor = typeof item.actor === 'string' ? item.actor : '-';
        return <span title={safeActor}>{safeActor}</span>;
      },
      getSortValue: (item) => (item.actor ?? '').toLowerCase(),
      sort: { mode: 'server' },
      filter: false,
    },
    {
      id: 'folder',
      label: t(columnCommonKey('folder')),
      headerClassName: 'text-start',
      cellClassName: 'py-1.5 text-xs text-slate-700 whitespace-nowrap max-w-[220px] truncate text-start',
      card: { role: 'field', label: t(columnCommonKey('folder')) },
      renderCell: (item) => {
        const { folder } = parseLogParts(item.context, item.message);
        return <span title={folder}>{folder}</span>;
      },
      getSortValue: (item) => parseLogParts(item.context, item.message).folder.toLowerCase(),
      sort: { mode: 'server' },
      filter: false,
    },
    {
      id: 'functionName',
      label: t(columnCommonKey('function')),
      headerClassName: 'text-start',
      cellClassName: 'py-1.5 text-xs text-slate-700 whitespace-nowrap max-w-[260px] truncate text-start',
      card: { role: 'subtitle' },
      renderCell: (item) => {
        const { functionName } = parseLogParts(item.context, item.message);
        return <span title={functionName}>{functionName}</span>;
      },
      getSortValue: (item) => parseLogParts(item.context, item.message).functionName.toLowerCase(),
      sort: { mode: 'server' },
      filter: false,
    },
    {
      id: 'key',
      label: t(columnCommonKey('key')),
      headerClassName: 'text-start',
      cellClassName: 'py-1.5 text-xs text-slate-700 whitespace-nowrap max-w-[180px] truncate text-start',
      card: {
        role: 'field',
        label: t(columnCommonKey('key')),
        phoneRole: 'hidden',
        tabletRole: 'hidden',
      },
      renderCell: (item) => {
        const { key } = parseLogParts(item.context, item.message);
        return <span title={key}>{key}</span>;
      },
      getSortValue: (item) => parseLogParts(item.context, item.message).key.toLowerCase(),
      sort: { mode: 'server' },
      filter: false,
    },
    {
      id: 'timestamp',
      label: t(columnCommonKey('time')),
      headerClassName: 'text-start',
      cellClassName: 'py-1.5 font-mono text-[11px] text-slate-500 whitespace-nowrap text-start',
      card: { role: 'title' },
      renderCell: (item) => (
        <span>{formatRecordEventOccurredAt(item.timestamp)}</span>
      ),
      getSortValue: (item) => item.timestamp,
      sort: { mode: 'server' },
      filter: false,
    },
    {
      id: 'durationMs',
      label: (
        <span className="inline-flex items-center text-slate-500" title={t(columnCommonKey('durationMs'))}>
          <Timer className="h-3.5 w-3.5" aria-hidden />
        </span>
      ),
      headerClassName: 'text-start',
      cellClassName: 'py-1.5 font-mono text-[11px] text-slate-500 whitespace-nowrap text-start',
      card: { role: 'meta', label: t(columnCommonKey('duration')), priority: 10 },
      hideBelow: 'lg',
      renderCell: (item) => (
        typeof item.durationMs === 'number' ? `${item.durationMs} ms` : '-'
      ),
      getSortValue: (item) => item.durationMs ?? -1,
      sort: { mode: 'server' },
      filter: false,
    },
    {
      id: 'callSuccess',
      label: t(columnCommonKey('success')),
      headerClassName: 'text-start',
      cellClassName: 'py-1.5 text-xs text-start',
      card: { role: 'field', label: t(columnCommonKey('success')) },
      renderCell: (item) => (
        item.callSuccess === null
          ? <span className="text-slate-400">-</span>
          : item.callSuccess
            ? <span className="inline-flex items-center text-emerald-700" title={t('grid.boolean.yes')}><Check className="w-3.5 h-3.5" /></span>
            : <span className="inline-flex items-center text-rose-700" title={t('grid.boolean.no')}><X className="w-3.5 h-3.5" /></span>
      ),
      getSortValue: (item) => item.callSuccess,
      sort: { mode: 'server' },
      filter: false,
    },
    {
      id: 'context',
      label: t(columnCommonKey('context')),
      headerClassName: 'text-start',
      cellClassName: 'py-1.5 font-semibold text-xs text-start',
      card: { role: 'hidden' },
      renderCell: (item) => item.context || '-',
      getSortValue: (item) => (item.context ?? '').toLowerCase(),
      sort: { mode: 'server' },
      filter: false,
    },
    {
      id: 'detail',
      label: '',
      layout: { hideable: false },
      headerClassName: 'text-start',
      cellClassName: 'text-start',
      width: ACTION_COLUMN_WIDTH,
      card: { role: 'actions' },
      renderCell: (item) => (
        <div className="flex items-center justify-start">
          <ActionTooltip content={t('actions.viewDetails')}>
            <button
              type="button"
              onClick={() => void handlers.onOpenDetail(item.id)}
              className={`${ACTION_BUTTON_BASE_CLASS} text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50`}
              aria-label={t('actions.viewDetails')}
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
          </ActionTooltip>
        </div>
      ),
      sort: false,
      filter: false,
    },
  ];
}
