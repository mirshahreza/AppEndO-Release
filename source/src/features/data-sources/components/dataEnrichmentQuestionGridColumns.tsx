import React from 'react';
import { Ban, Eye, MessageSquareReply } from 'lucide-react';
import type { DbEnrichmentQuestion, DbEnrichmentQuestionKind } from '../../../shared/api/contracts/db-enrichment';
import { AppButton } from '../../../shared/ui/AppButton';
import { AppGridRowActions, type GridRowActionItem } from '../../../shared/ui/AppGridRowActions';
import type { AppTableGridColumnDef } from '../../../shared/lib/appTableGridQuery';
import { gridActionsColumnWidth } from '../../../shared/lib/gridRowActions';

export type EnrichmentQuestionSortField = 'objectName' | 'kind' | 'createdAt';

export const ENRICHMENT_QUESTION_SORT_OPTIONS: ReadonlyArray<{ value: EnrichmentQuestionSortField; label: string }> = [
  { value: 'createdAt', label: 'Created' },
  { value: 'objectName', label: 'Object' },
  { value: 'kind', label: 'Kind' },
];

export const ENRICHMENT_QUESTION_KIND_LABEL: Record<DbEnrichmentQuestionKind, string> = {
  column_meaning: 'Column meaning',
  value_glossary: 'Value glossary',
  relation_intent: 'Relation',
  table_purpose: 'Table purpose',
};

const STATUS_BADGE_CLASS: Record<DbEnrichmentQuestion['status'], string> = {
  open: 'border-amber-200 bg-amber-50 text-amber-800',
  answered: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  dismissed: 'border-slate-200 bg-slate-100 text-slate-600',
};

const ACTIONS_COLUMN_WIDTH = gridActionsColumnWidth(1);

export type EnrichmentQuestionGridHandlers = {
  onAnswer: (question: DbEnrichmentQuestion) => void;
  onView: (question: DbEnrichmentQuestion) => void;
  onDismiss: (question: DbEnrichmentQuestion) => void;
};

const hasInlineAnswerActions = (row: DbEnrichmentQuestion): boolean => (
  row.status === 'open' && !row.answer?.trim()
);

export function createEnrichmentQuestionRowActions(
  row: DbEnrichmentQuestion,
  handlers: EnrichmentQuestionGridHandlers,
): GridRowActionItem[] {
  if (hasInlineAnswerActions(row)) {
    return [];
  }

  return [
    {
      id: 'view',
      label: 'View',
      icon: <Eye className="h-3.5 w-3.5" />,
      intent: 'view',
      onClick: () => handlers.onView(row),
    },
  ];
}

export function createEnrichmentQuestionGridColumns(
  handlers: EnrichmentQuestionGridHandlers,
): AppTableGridColumnDef<DbEnrichmentQuestion>[] {
  return [
    {
      id: 'question',
      label: 'Question',
      wrap: true,
      cellClassName: 'align-top',
      card: { role: 'title' },
      sort: false,
      renderCell: (row) => (
        <span className="text-xs font-medium leading-5 text-slate-800">{row.question}</span>
      ),
    },
    {
      id: 'objectName',
      label: 'Object',
      width: 180,
      card: { role: 'subtitle' },
      sort: { mode: 'client' },
      getSortValue: (row) => row.objectName,
      renderCell: (row) => (
        <span className="font-mono text-xs text-slate-600" title={row.objectType}>
          {row.objectName}
        </span>
      ),
    },
    {
      id: 'columnName',
      label: 'Column',
      width: 140,
      card: { role: 'field', label: 'Column' },
      renderCell: (row) => (
        <span className="font-mono text-xs text-slate-600">{row.columnName ?? '—'}</span>
      ),
    },
    {
      id: 'kind',
      label: 'Kind',
      width: 140,
      card: { role: 'field', label: 'Kind' },
      sort: { mode: 'client' },
      getSortValue: (row) => row.kind,
      renderCell: (row) => (
        <span className="text-xs text-slate-600">{ENRICHMENT_QUESTION_KIND_LABEL[row.kind]}</span>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      width: 110,
      cellClassName: 'text-center',
      headerClassName: 'text-center [&>div]:justify-center',
      card: { role: 'field', label: 'Status' },
      sort: false,
      renderCell: (row) => (
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_BADGE_CLASS[row.status]}`}>
          {row.status}
        </span>
      ),
    },
    {
      id: 'answer',
      label: 'Answer',
      wrap: true,
      card: { role: 'field', label: 'Answer' },
      renderCell: (row) => {
        if (hasInlineAnswerActions(row)) {
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <AppButton
                type="button"
                intent="secondary"
                size="sm"
                aria-label="Answer"
                onClick={(event) => {
                  event.stopPropagation();
                  handlers.onAnswer(row);
                }}
              >
                <MessageSquareReply className="h-3.5 w-3.5" />
                Answer
              </AppButton>
              <AppButton
                type="button"
                intent="destructive-soft"
                size="sm"
                aria-label="Dismiss"
                onClick={(event) => {
                  event.stopPropagation();
                  handlers.onDismiss(row);
                }}
              >
                <Ban className="h-3.5 w-3.5" />
                Dismiss
              </AppButton>
            </div>
          );
        }

        return (
          <span className="text-xs leading-5 text-slate-600">{row.answer ?? '—'}</span>
        );
      },
    },
    {
      id: 'actions',
      label: '',
      width: ACTIONS_COLUMN_WIDTH,
      layout: { hideable: false },
      filter: false,
      sort: false,
      card: { role: 'actions' },
      renderCell: (row) => (
        <AppGridRowActions actions={createEnrichmentQuestionRowActions(row, handlers)} />
      ),
    },
  ];
}
