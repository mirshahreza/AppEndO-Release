import React from 'react';
import type { TranslationFn } from '../../core/culture/TranslationRuntime';
import { columnCommonKey } from '../../core/culture/translations/cultureKeyHelpers';
import type { FeedbackTicketDto } from '../../shared/api/contracts/feedback/types';
import type { AppTableGridColumnDef } from '../../shared/lib/appTableGridQuery';
import { formatDisplayDateYmd } from '../../shared/lib/gridDateFormat';
import { resolveFeedbackSubjectLabel } from './feedbackSubjectLabel';

const STATUS_LABEL_KEYS: Record<string, string> = {
  NEW: 'feedback.status.new',
  TRIAGED: 'feedback.status.triaged',
  IN_PROGRESS: 'feedback.status.inProgress',
  RESOLVED: 'feedback.status.resolved',
  WONT_FIX: 'feedback.status.wontFix',
  DUPLICATE: 'feedback.status.duplicate',
};

const formatGridDate = (value: string | null): string => formatDisplayDateYmd(value, '—');

export function createFeedbackInboxGridColumns(t: TranslationFn): AppTableGridColumnDef<FeedbackTicketDto>[] {
  return [
    {
      id: 'title',
      label: t(columnCommonKey('title')),
      headerClassName: 'text-start',
      cellClassName: 'text-start font-medium text-slate-800',
      card: { role: 'title' },
      renderCell: (item) => (
        <span className="block max-w-[min(100%,20rem)] truncate" title={item.title}>
          {item.title}
        </span>
      ),
      sort: false,
      filter: false,
    },
    {
      id: 'submitter',
      label: t('feedback.inbox.column.submitter'),
      width: 120,
      headerClassName: 'text-start',
      cellClassName: 'text-start text-slate-600',
      card: { role: 'field', label: t('feedback.inbox.column.submitter') },
      renderCell: (item) => item.submitterDisplayName ?? '—',
      sort: false,
      filter: false,
    },
    {
      id: 'subject',
      label: t('feedback.my.column.subject'),
      width: 140,
      headerClassName: 'text-start',
      cellClassName: 'text-start text-slate-600',
      card: { role: 'field', label: t('feedback.my.column.subject') },
      renderCell: (item) => resolveFeedbackSubjectLabel(t, item.subjectId, item.subjectLabel),
      sort: false,
      filter: false,
    },
    {
      id: 'status',
      label: t('feedback.my.column.status'),
      width: 120,
      headerClassName: 'text-start',
      cellClassName: 'text-start text-slate-600',
      card: { role: 'field', label: t('feedback.my.column.status') },
      renderCell: (item) => t(STATUS_LABEL_KEYS[item.status] ?? 'feedback.status.new'),
      sort: false,
      filter: false,
    },
    {
      id: 'updated',
      label: t('feedback.my.column.updated'),
      width: 112,
      headerClassName: 'text-start',
      cellClassName: 'text-start font-mono text-xs text-slate-500',
      card: { role: 'field', label: t('feedback.my.column.updated') },
      renderCell: (item) => formatGridDate(item.lastMessageAt ?? item.submittedAt),
      sort: false,
      filter: false,
    },
  ];
}
