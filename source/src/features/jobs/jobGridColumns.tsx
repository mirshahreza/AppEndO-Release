import React from 'react';
import { Ban, RotateCcw } from 'lucide-react';
import type { TranslationFn } from '../../core/culture/TranslationRuntime';
import { columnCommonKey } from '../../core/culture/translations/cultureKeyHelpers';
import { formatJobStatusLabel } from '../operations/operationsI18n';
import type { AppTableGridColumnDef } from '../../shared/lib/appTableGridQuery';
import type { JobGridRow } from '../../shared/api/contracts/jobs/types';
import { AppButton } from '../../shared/ui/AppButton';
import { APP_TABLE_GRID_AUDIT_COLUMN_WIDTH } from '../../shared/ui/surfaceClasses';
import {
  canCancelJob,
  canRetryJob,
  formatJobDate,
  isJobActive,
} from '../../shared/lib/jobPayload';

const ACTION_BUTTON_BASE_CLASS = 'h-7 w-7 inline-flex items-center justify-center rounded-md transition-colors';

const statusClassName = (status: string) => {
  switch (status) {
    case 'pending':
      return 'text-amber-700 bg-amber-50 border-amber-200';
    case 'running':
      return 'text-cyan-700 bg-cyan-50 border-cyan-200';
    case 'completed':
      return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    case 'failed':
      return 'text-rose-700 bg-rose-50 border-rose-200';
    case 'cancelled':
      return 'text-slate-600 bg-slate-100 border-slate-200';
    default:
      return 'text-slate-600 bg-slate-100 border-slate-200';
  }
};

const ProgressCell: React.FC<{ row: JobGridRow }> = ({ row }) => {
  const progress = Math.max(0, Math.min(100, Number(row.progress) || 0));
  const active = isJobActive(row.status);

  return (
    <div className="flex min-w-[120px] flex-col gap-1">
      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
        <span>{progress}%</span>
        {row.progress_message ? <span className="truncate">{row.progress_message}</span> : null}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${active ? 'bg-cyan-500' : 'bg-slate-400'}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export type JobGridActions = {
  onCancel: (job: JobGridRow) => void;
  onRetry: (job: JobGridRow) => void;
  pendingActionJobId?: number | null;
};

export const createJobGridColumns = (
  actions: JobGridActions,
  t: TranslationFn,
): AppTableGridColumnDef<JobGridRow>[] => [
  {
    id: 'id',
    label: t(columnCommonKey('id')),
    sort: { mode: 'client' },
    filter: false,
    card: { role: 'hidden' },
    getSortValue: (row) => row.id,
    renderCell: (row) => <span className="font-mono text-xs text-slate-600">#{row.id}</span>,
  },
  {
    id: 'title',
    label: t(columnCommonKey('title')),
    card: { role: 'title' },
    sort: { mode: 'client' },
    filter: { mode: 'client', type: 'text' },
    getSortValue: (row) => row.title,
    getFilterValue: (row) => `${row.title} ${row.functionId}`,
    renderCell: (row) => (
      <div className="flex flex-col">
        <span className="font-medium text-slate-800">{row.title}</span>
        <span className="font-mono text-[11px] text-slate-500">{row.functionId}</span>
      </div>
    ),
  },
  {
    id: 'status',
    label: t(columnCommonKey('status')),
    card: { role: 'subtitle' },
    sort: { mode: 'client' },
    filter: { mode: 'client', type: 'text' },
    getSortValue: (row) => row.status,
    getFilterValue: (row) => row.status,
    renderCell: (row) => (
      <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold capitalize ${statusClassName(row.status)}`}>
        {formatJobStatusLabel(t, row.status)}
      </span>
    ),
  },
  {
    id: 'progress',
    label: t(columnCommonKey('progress')),
    card: { role: 'field', label: t(columnCommonKey('progress')) },
    sort: { mode: 'client' },
    filter: false,
    getSortValue: (row) => row.progress,
    renderCell: (row) => <ProgressCell row={row} />,
  },
  {
    id: 'sourceLabel',
    label: t(columnCommonKey('source')),
    card: { role: 'field', label: t(columnCommonKey('source')) },
    sort: { mode: 'client' },
    filter: { mode: 'client', type: 'text' },
    getSortValue: (row) => row.sourceLabel,
    getFilterValue: (row) => row.sourceLabel,
    renderCell: (row) => <span className="text-xs text-slate-600">{row.sourceLabel}</span>,
  },
  {
    id: 'started_at',
    label: t(columnCommonKey('started')),
    card: { role: 'field', label: t(columnCommonKey('started')) },
    sort: { mode: 'client' },
    filter: false,
    getSortValue: (row) => row.started_at || '',
    renderCell: (row) => <span className="text-slate-600">{formatJobDate(row.started_at)}</span>,
  },
  {
    id: 'finished_at',
    label: t(columnCommonKey('finished')),
    card: { role: 'field', label: t(columnCommonKey('finished')) },
    sort: { mode: 'client' },
    filter: false,
    getSortValue: (row) => row.finished_at || '',
    renderCell: (row) => <span className="text-slate-600">{formatJobDate(row.finished_at)}</span>,
  },
  {
    id: 'created_at',
    label: t(columnCommonKey('created')),
    sort: { mode: 'client' },
    filter: false,
    width: APP_TABLE_GRID_AUDIT_COLUMN_WIDTH,
    card: { role: 'meta', label: t(columnCommonKey('created')), priority: 10 },
    hideBelow: 'lg',
    getSortValue: (row) => row.created_at,
    renderCell: (row) => <span className="text-slate-600">{formatJobDate(row.created_at)}</span>,
  },
  {
    id: 'actions',
    label: '',
    sort: false,
    filter: false,
    card: { role: 'actions' },
    renderCell: (row) => {
      const canCancel = canCancelJob(row.status);
      const canRetry = canRetryJob(row.status);
      const isPendingAction = actions.pendingActionJobId === row.id;

      return (
        <div className="flex items-center justify-start gap-[7px]">
          <AppButton
            size="icon-sm"
            className={`${ACTION_BUTTON_BASE_CLASS} ${
              canCancel
                ? 'text-rose-600 hover:bg-rose-50 hover:text-rose-700'
                : 'text-slate-400'
            }`}
            aria-label={t('actions.cancelJob')}
            title={t('actions.cancelJob')}
            onClick={() => actions.onCancel(row)}
            disabled={!canCancel || isPendingAction}
          >
            <Ban className="h-4 w-4" />
          </AppButton>
          <AppButton
            size="icon-sm"
            className={`${ACTION_BUTTON_BASE_CLASS} ${
              canRetry
                ? 'text-cyan-600 hover:bg-cyan-50 hover:text-cyan-700'
                : 'text-slate-400'
            }`}
            aria-label={t('actions.retryJob')}
            title={t('actions.retryJob')}
            onClick={() => actions.onRetry(row)}
            disabled={!canRetry || isPendingAction}
          >
            <RotateCcw className="h-4 w-4" />
          </AppButton>
        </div>
      );
    },
  },
];
