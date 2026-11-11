import React from 'react';
import { Check, Eye, Trash2 } from 'lucide-react';
import type { TranslationFn } from '@/src/core/culture/TranslationRuntime';
import { columnCommonKey } from '@/src/core/culture/translations/cultureKeyHelpers';
import type { AiChatSessionAdminSummary } from '@/src/shared/api/contracts/ai/chatHistoryTypes';
import type { AppTableGridColumnDef } from '@/src/shared/lib/appTableGridQuery';
import { ActionTooltip } from '@/src/shared/ui/ActionTooltip';
import { APP_TABLE_GRID_AUDIT_COLUMN_WIDTH } from '@/src/shared/ui/surfaceClasses';
import { ACTION_BUTTON_BASE_CLASS, ACTION_COLUMN_WIDTH } from './constants';
import { formatChatSessionTokenCount, formatChatSessionTokenTotals, formatDateYmd } from './utils';

export type ChatHistoryGridColumnHandlers = {
  onView: (session: AiChatSessionAdminSummary) => void;
  onDelete: (sessionId: number) => void;
};

export function createChatHistoryGridColumns(
  handlers: ChatHistoryGridColumnHandlers,
  t: TranslationFn,
): AppTableGridColumnDef<AiChatSessionAdminSummary>[] {
  return [
    {
      id: 'id',
      label: t(columnCommonKey('rowNumber')),
      width: 56,
      headerClassName: 'text-start',
      cellClassName: 'text-start font-mono text-slate-400',
      renderCell: (session) => session.id,
      sort: false,
      filter: false,
      card: { role: 'hidden' },
    },
    {
      id: 'title',
      label: t(columnCommonKey('title')),
      headerClassName: 'text-start',
      cellClassName: 'text-start font-medium text-slate-800',
      card: { role: 'title' },
      renderCell: (session) => (
        <span className="block max-w-[320px] truncate" title={session.title}>
          {session.title}
        </span>
      ),
      sort: false,
      filter: false,
    },
    {
      id: 'username',
      label: t(columnCommonKey('user')),
      headerClassName: 'text-start',
      cellClassName: 'text-start text-slate-600',
      card: { role: 'subtitle' },
      renderCell: (session) => session.username,
      sort: false,
      filter: false,
    },
    {
      id: 'model_id',
      label: t(columnCommonKey('model')),
      headerClassName: 'text-start',
      cellClassName: 'text-start font-mono text-xs text-slate-500',
      card: { role: 'field', label: t(columnCommonKey('model')) },
      renderCell: (session) => session.modelId ?? <span className="text-slate-300">-</span>,
      sort: false,
      filter: false,
    },
    {
      id: 'message_count',
      label: t(columnCommonKey('messages')),
      headerClassName: 'text-start',
      cellClassName: 'text-start font-mono text-slate-600',
      width: 88,
      card: { role: 'field', label: t(columnCommonKey('messages')) },
      renderCell: (session) => session.messageCount,
      sort: false,
      filter: false,
    },
    {
      id: 'token_usage',
      label: t(columnCommonKey('tokenUsage')),
      headerClassName: 'text-start',
      cellClassName: 'text-start font-mono text-xs text-slate-500',
      width: 148,
      card: { role: 'field', label: t(columnCommonKey('tokenUsage')) },
      renderCell: (session) => formatChatSessionTokenTotals(session),
      sort: false,
      filter: false,
    },
    {
      id: 'tokens_in',
      label: t(columnCommonKey('tokensIn')),
      headerClassName: 'text-start',
      cellClassName: 'text-start font-mono text-xs text-slate-500',
      width: 88,
      hideBelow: 'xl',
      card: { role: 'hidden' },
      renderCell: (session) => formatChatSessionTokenCount(session.totalInputTokens),
      sort: false,
      filter: false,
    },
    {
      id: 'tokens_out',
      label: t(columnCommonKey('tokensOut')),
      headerClassName: 'text-start',
      cellClassName: 'text-start font-mono text-xs text-slate-500',
      width: 88,
      hideBelow: 'xl',
      card: { role: 'hidden' },
      renderCell: (session) => formatChatSessionTokenCount(session.totalOutputTokens),
      sort: false,
      filter: false,
    },
    {
      id: 'user_deleted',
      label: t(columnCommonKey('userDeleted')),
      headerClassName: 'text-start',
      cellClassName: 'text-start',
      width: 96,
      card: { role: 'field', label: t(columnCommonKey('userDeleted')) },
      renderCell: (session) => (
        session.userDeleted ? (
          <Check
            className="h-4 w-4 text-slate-400"
            aria-label={t('grid.hint.chatHistory.deletedByUser')}
            title={t('grid.hint.chatHistory.deletedByUser')}
          />
        ) : null
      ),
      sort: false,
      filter: false,
    },
    {
      id: 'created_at',
      label: t(columnCommonKey('created')),
      headerClassName: 'text-start',
      cellClassName: 'text-start font-mono text-slate-400',
      width: APP_TABLE_GRID_AUDIT_COLUMN_WIDTH,
      card: { role: 'meta', label: t(columnCommonKey('created')), priority: 10 },
      hideBelow: 'lg',
      renderCell: (session) => formatDateYmd(session.createdAt),
      sort: false,
      filter: false,
    },
    {
      id: 'updated_at',
      label: t(columnCommonKey('updated')),
      headerClassName: 'text-start',
      cellClassName: 'text-start font-mono text-slate-400',
      width: APP_TABLE_GRID_AUDIT_COLUMN_WIDTH,
      card: { role: 'meta', label: t(columnCommonKey('updated')), priority: 20 },
      hideBelow: 'lg',
      renderCell: (session) => formatDateYmd(session.updatedAt),
      sort: false,
      filter: false,
    },
    {
      id: 'actions',
      label: '',
      headerClassName: 'text-end',
      cellClassName: 'text-end',
      width: ACTION_COLUMN_WIDTH,
      card: { role: 'actions' },
      renderCell: (session) => (
        <div className="flex items-center justify-end">
          <ActionTooltip content={t('actions.view')}>
            <button
              type="button"
              onClick={() => handlers.onView(session)}
              className={`${ACTION_BUTTON_BASE_CLASS} text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50`}
              aria-label={t('actions.viewChatSession')}
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
          </ActionTooltip>
          <span className="mx-[3px] h-3 border-s border-slate-200" aria-hidden="true" />
          <ActionTooltip content={t('actions.delete')}>
            <button
              type="button"
              onClick={() => handlers.onDelete(session.id)}
              className={`${ACTION_BUTTON_BASE_CLASS} text-rose-600 hover:text-rose-700 hover:bg-rose-50`}
              aria-label={t('actions.deleteChatSession')}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </ActionTooltip>
        </div>
      ),
      sort: false,
      filter: false,
    },
  ];
}
