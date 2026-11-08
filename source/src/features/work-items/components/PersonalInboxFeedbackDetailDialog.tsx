import React, { useEffect, useState } from 'react';
import { CreateEditModalShell, MarkdownPreview, QueryErrorPanel } from '../../../shared/ui';
import { apiFetch } from '../../../shared/api/authSession';
import type { FeedbackTicketDetailDto } from '../../../shared/api/contracts/feedback/types';
import { getFeedbackSessionKey } from '../../../shared/lib/feedbackSessionKey';
import { useCultureT } from '../../../core/culture/CultureContext';
import { resolveCultureLabel } from '../../../core/culture/cultureShellKeys';

export type PersonalInboxFeedbackDetailDialogProps = {
  ticketId: number | null;
  /** When true, load via `/api/feedback/mine/:id` instead of staff `/api/feedback/:id`. */
  mine: boolean;
  onClose: () => void;
};

export const PersonalInboxFeedbackDetailDialog: React.FC<PersonalInboxFeedbackDetailDialogProps> = ({
  ticketId,
  mine,
  onClose,
}) => {
  const t = useCultureT();
  const [ticket, setTicket] = useState<FeedbackTicketDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ticketId == null || ticketId <= 0) {
      setTicket(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    const path = mine ? `/api/feedback/mine/${ticketId}` : `/api/feedback/${ticketId}`;
    void apiFetch(path, { headers: { 'x-feedback-session': getFeedbackSessionKey() } })
      .then(async (response) => {
        const body = await response.json() as { success?: boolean; ticket?: FeedbackTicketDetailDto; error?: string };
        if (!response.ok || !body.ticket) {
          throw new Error(body.error ?? 'Failed to load feedback.');
        }
        if (!cancelled) {
          setTicket(body.ticket);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load feedback.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mine, ticketId]);

  if (ticketId == null || ticketId <= 0) {
    return null;
  }

  const title = ticket?.title ?? resolveCultureLabel(t, 'shell.inbox.feedbackDetail.title', 'Feedback');

  return (
    <CreateEditModalShell title={title} size="lg" onClose={onClose}>
      {isLoading ? (
        <p className="text-sm text-slate-500">
          {resolveCultureLabel(t, 'shell.inbox.loading', 'Loading inbox…')}
        </p>
      ) : null}
      {error ? (
        <QueryErrorPanel message={title} detail={error} className="h-32" />
      ) : null}
      {ticket && !isLoading && !error ? (
        <div className="flex max-h-[min(70dvh,640px)] flex-col gap-3 overflow-y-auto text-sm">
          {ticket.messages.map((message) => (
            <div key={message.id} className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {message.authorDisplayName ?? message.kind}
              </p>
              <MarkdownPreview content={message.body} />
            </div>
          ))}
        </div>
      ) : null}
    </CreateEditModalShell>
  );
};
