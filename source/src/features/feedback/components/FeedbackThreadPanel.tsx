import React, { useCallback, useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { useCultureT } from '../../../core/culture/CultureContext';
import type { FeedbackMessageDto, FeedbackTicketDetailDto } from '../../../shared/api/contracts/feedback/types';
import { AppButton, MarkdownPreview, UiTextarea } from '../../../shared/ui';
import { feedbackApi, FeedbackApiError } from '../api/feedbackApi';
import { formatDisplayDateYmd } from '../../../shared/lib/gridDateFormat';
import { cn } from '../../../lib/utils';
import { FeedbackAttachmentBadge, type FeedbackAttachmentBadgeTone } from './FeedbackAttachmentBadge';

type FeedbackThreadPanelProps = {
  ticket: FeedbackTicketDetailDto;
  mode: 'mine' | 'staff';
  onUpdated: (ticket: FeedbackTicketDetailDto) => void;
  allowInternalNotes?: boolean;
  /** When false, reply/compose is handled elsewhere (e.g. inbox toolbar Reply dialog). */
  showReplyComposer?: boolean;
};

const formatDate = (value: string): string => formatDisplayDateYmd(value, '—');

const messageAuthorLabel = (message: FeedbackMessageDto, t: (key: string) => string): string => {
  if (message.kind === 'INTERNAL') return t('feedback.thread.internalNote');
  if (message.kind === 'STAFF') return message.authorDisplayName ?? t('feedback.thread.staff');
  return message.authorDisplayName ?? t('feedback.thread.submitter');
};

const attachmentBadgeTone = (kind: FeedbackMessageDto['kind']): FeedbackAttachmentBadgeTone => {
  if (kind === 'INTERNAL') return 'internal';
  if (kind === 'STAFF') return 'staff';
  return 'default';
};

export const FeedbackThreadPanel: React.FC<FeedbackThreadPanelProps> = ({
  ticket,
  mode,
  onUpdated,
  allowInternalNotes = false,
  showReplyComposer = true,
}) => {
  const t = useCultureT();
  const [reply, setReply] = useState('');
  const [kind, setKind] = useState<'SUBMITTER' | 'STAFF' | 'INTERNAL'>(
    mode === 'mine' ? 'SUBMITTER' : 'STAFF',
  );
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    setReply('');
    setKind(mode === 'mine' ? 'SUBMITTER' : 'STAFF');
    setError(null);
  }, [ticket.id, mode]);

  const sendReply = useCallback(async () => {
    const body = reply.trim();
    if (!body) return;
    setIsSending(true);
    setError(null);
    try {
      const result = mode === 'mine'
        ? await feedbackApi.postMineMessage(ticket.id, { body, kind: 'SUBMITTER' })
        : await feedbackApi.postMessage(ticket.id, { body, kind });
      onUpdated(result.ticket);
      setReply('');
      if (mode === 'mine') {
        await feedbackApi.markMineRead(ticket.id);
      }
    } catch (err) {
      setError(err instanceof FeedbackApiError ? err.message : t('feedback.thread.sendError'));
    } finally {
      setIsSending(false);
    }
  }, [kind, mode, onUpdated, reply, t, ticket.id]);

  const canReply = mode === 'mine'
    ? ticket.status !== 'RESOLVED' && ticket.status !== 'WONT_FIX' && ticket.status !== 'DUPLICATE'
    : true;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
        {ticket.messages.map((message) => (
          <article
            key={message.id}
            className={`rounded-lg border px-3 py-2 text-sm ${
              message.kind === 'INTERNAL'
                ? 'border-amber-200 bg-amber-50'
                : message.kind === 'STAFF'
                  ? 'border-indigo-200 bg-indigo-50/60'
                  : 'border-slate-200 bg-white'
            }`}
          >
            <header className="mb-1 flex items-center justify-between gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{messageAuthorLabel(message, t)}</span>
              <time dateTime={message.createdAt}>{formatDate(message.createdAt)}</time>
            </header>
            <div className="rounded-md border border-slate-200/70 bg-white/60 p-2.5">
              {message.body.trim() ? (
                <MarkdownPreview
                  content={message.body}
                  dir="auto"
                  tone="user"
                  contentClassName="text-sm text-slate-800"
                />
              ) : null}
              {message.attachments.length > 0 ? (
                <div
                  className={cn(
                    message.body.trim() ? 'mt-2 border-t border-slate-200/80 pt-2' : '',
                  )}
                >
                  <div className="flex flex-wrap gap-1.5">
                    {message.attachments.map((file) => (
                      <FeedbackAttachmentBadge
                        key={file.id}
                        fileName={file.fileName}
                        href={`/api/feedback/attachments/${file.id}`}
                        tone={attachmentBadgeTone(message.kind)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {showReplyComposer && canReply ? (
        <div className="border-t border-slate-200 pt-3">
          {allowInternalNotes ? (
            <div className="mb-2 flex gap-2 text-xs">
              <button
                type="button"
                className={`rounded px-2 py-1 font-semibold ${kind === 'STAFF' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                onClick={() => setKind('STAFF')}
              >
                {t('feedback.thread.replyStaff')}
              </button>
              <button
                type="button"
                className={`rounded px-2 py-1 font-semibold ${kind === 'INTERNAL' ? 'bg-amber-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                onClick={() => setKind('INTERNAL')}
              >
                {t('feedback.thread.replyInternal')}
              </button>
            </div>
          ) : null}
          <UiTextarea
            size="sm"
            rows={3}
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            placeholder={t('feedback.thread.placeholder')}
            isInvalid={Boolean(error)}
            errorMessage={error ?? undefined}
            ariaLabel={t('feedback.thread.placeholder')}
          />
          <div className="mt-2 flex justify-end">
            <AppButton type="button" intent="primary" size="sm" disabled={isSending || !reply.trim()} onClick={() => void sendReply()}>
              <Send className="h-3.5 w-3.5" />
              {isSending ? t('feedback.thread.sending') : t('feedback.thread.send')}
            </AppButton>
          </div>
        </div>
      ) : showReplyComposer && !canReply ? (
        <p className="text-xs text-slate-500">{t('feedback.thread.closed')}</p>
      ) : null}
    </div>
  );
};
