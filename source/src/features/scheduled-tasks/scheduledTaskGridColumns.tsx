import React from 'react';
import { Check, Loader2, Pencil, Play, Trash2, X } from 'lucide-react';
import type { TranslationFn } from '../../core/culture/TranslationRuntime';
import { columnCommonKey } from '../../core/culture/translations/cultureKeyHelpers';
import type { AppTableGridColumnDef } from '../../shared/lib/appTableGridQuery';
import { ActionTooltip } from '../../shared/ui/ActionTooltip';
import type { ScheduledTaskGridRow } from '../../shared/api/contracts/scheduler/types';
import { formatDisplayDateYmd } from '../../shared/lib/gridDateFormat';
import {
  ACTION_BUTTON_BASE_CLASS,
  ACTION_COLUMN_WIDTH,
} from './constants';

const formatDateTime = (value: string | null) => {
  if (!value) return <span className="text-slate-300">-</span>;
  return <span className="font-mono text-slate-600">{formatDisplayDateYmd(value)}</span>;
};

export type ScheduledTaskGridActions = {
  onEdit: (task: ScheduledTaskGridRow) => void;
  onRunNow: (task: ScheduledTaskGridRow) => void;
  onDelete: (task: ScheduledTaskGridRow) => void;
  runningTaskId?: string | null;
};

export const createScheduledTaskGridColumns = (
  actions: ScheduledTaskGridActions,
  t: TranslationFn,
): AppTableGridColumnDef<ScheduledTaskGridRow>[] => [
  {
    id: 'name',
    label: t(columnCommonKey('name')),
    card: { role: 'title' },
    sort: { mode: 'client' },
    filter: { mode: 'client', type: 'text' },
    getSortValue: (row) => row.name,
    getFilterValue: (row) => row.name,
    renderCell: (row) => (
      <div className="flex flex-col">
        <span className="font-medium text-slate-800">{row.name}</span>
        {row.functionMissing ? (
          <span className="text-xs text-amber-600">{t('grid.hint.functionMissing')}</span>
        ) : null}
      </div>
    ),
  },
  {
    id: 'functionId',
    label: t(columnCommonKey('function')),
    card: { role: 'subtitle' },
    sort: { mode: 'client' },
    filter: { mode: 'client', type: 'text' },
    getSortValue: (row) => row.functionId,
    getFilterValue: (row) => row.functionId,
    renderCell: (row) => <span className="font-mono text-xs text-slate-600">{row.functionId}</span>,
  },
  {
    id: 'cron',
    label: t(columnCommonKey('cron')),
    card: { role: 'field', label: t(columnCommonKey('cron')) },
    sort: { mode: 'client' },
    filter: { mode: 'client', type: 'text' },
    getSortValue: (row) => row.cron,
    getFilterValue: (row) => row.cron,
    renderCell: (row) => <span className="font-mono text-xs text-slate-700">{row.cron}</span>,
  },
  {
    id: 'enabled',
    label: t(columnCommonKey('enabled')),
    card: { role: 'field', label: t(columnCommonKey('enabled')) },
    sort: { mode: 'client' },
    filter: false,
    getSortValue: (row) => (row.enabled ? 1 : 0),
    renderCell: (row) => (
      row.enabled
        ? <Check className="h-4 w-4 text-emerald-700" aria-label={t('grid.boolean.enabled')} />
        : <X className="h-4 w-4 text-rose-700" aria-label={t('grid.boolean.disabled')} />
    ),
  },
  {
    id: 'lastRunAt',
    label: t(columnCommonKey('lastRun')),
    card: { role: 'meta', label: t(columnCommonKey('lastRun')), priority: 10 },
    hideBelow: 'lg',
    sort: { mode: 'client' },
    filter: false,
    getSortValue: (row) => row.lastRunAt || '',
    renderCell: (row) => (
      <div className="flex flex-col items-start gap-0.5">
        {formatDateTime(row.lastRunAt)}
        {row.lastRunStatus ? (
          <span className="text-[11px] text-slate-500">{row.lastRunStatus}</span>
        ) : null}
      </div>
    ),
  },
  {
    id: 'nextRunAt',
    label: t(columnCommonKey('nextRun')),
    card: { role: 'meta', label: t(columnCommonKey('nextRun')), priority: 20 },
    hideBelow: 'lg',
    sort: { mode: 'client' },
    filter: false,
    getSortValue: (row) => row.nextRunAt || '',
    renderCell: (row) => formatDateTime(row.nextRunAt),
  },
  {
    id: 'actions',
    label: '',
    headerClassName: 'text-end',
    cellClassName: 'text-end',
    width: ACTION_COLUMN_WIDTH,
    sort: false,
    filter: false,
    card: { role: 'actions' },
    renderCell: (row) => {
      const isRunning = actions.runningTaskId === row.id;
      const isRunDisabled = Boolean(actions.runningTaskId);

      return (
        <div className="flex items-center justify-end">
          <ActionTooltip content={t('actions.runNow')}>
            <button
              type="button"
              onClick={() => actions.onRunNow(row)}
              disabled={isRunDisabled}
              className={`${ACTION_BUTTON_BASE_CLASS} ${
                isRunDisabled && !isRunning
                  ? 'text-slate-400'
                  : 'text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50'
              }`}
              aria-label={t('actions.runNow')}
            >
              {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            </button>
          </ActionTooltip>
          <span className="mx-[3px] h-3 border-s border-slate-200" aria-hidden="true" />
          <ActionTooltip content={t('actions.edit')}>
            <button
              type="button"
              onClick={() => actions.onEdit(row)}
              className={`${ACTION_BUTTON_BASE_CLASS} text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50`}
              aria-label={t('actions.edit')}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </ActionTooltip>
          <span className="mx-[3px] h-3 border-s border-slate-200" aria-hidden="true" />
          <ActionTooltip content={t('actions.delete')}>
            <button
              type="button"
              onClick={() => actions.onDelete(row)}
              className={`${ACTION_BUTTON_BASE_CLASS} text-rose-600 hover:text-rose-700 hover:bg-rose-50`}
              aria-label={t('actions.delete')}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </ActionTooltip>
        </div>
      );
    },
  },
];
