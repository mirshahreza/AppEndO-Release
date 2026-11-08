import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StickyNote, X } from 'lucide-react';
import {
  AppButton,
  CreateEditModalShell,
  DirectionalText,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  QueryErrorPanel,
  ToolbarRefreshButton,
  UiTextarea,
  WorkspaceBackIcon,
} from '../../../shared/ui';
import { useCultureT } from '../../../core/culture/CultureContext';
import { resolveCultureLabel } from '../../../core/culture/cultureShellKeys';
import type { FeedbackTicketDetailDto } from '../../../shared/api/contracts/feedback/types';
import type { PersonalInboxItem } from '../../../shared/api/contracts/personal-inbox/types';
import {
  buildPersonalInboxFeedbackFocusHref,
  type PersonalInboxFeedbackScope,
} from '../../../shared/lib/personalInboxFeedbackDeepLink';
import { inboxSupportsCorrespondenceAction } from '../../../shared/personal-inbox/inboxCorrespondencePolicy';
import { PersonalInboxCorrespondenceDialog } from '../../../shared/personal-inbox/PersonalInboxCorrespondenceDialog';
import { PersonalInboxForwardIcon, PersonalInboxReplyIcon } from '../../../shared/personal-inbox/personalInboxCorrespondenceIcons';
import {
  notifyPersonalInboxChangedWithFallback,
  personalInboxApi,
} from '../../../shared/api/personalInboxApi';
import { feedbackApi, FeedbackApiError } from '../api/feedbackApi';
import { resolveFeedbackSubjectLabel } from '../feedbackSubjectLabel';
import type { PersonalInboxEnvelopeMessage } from '../../../shared/api/contracts/personal-inbox/envelopeTypes';
import { PersonalInboxEnvelopeMessageBlock } from '../../../shared/personal-inbox/PersonalInboxEnvelopeMessageBlock';
import {
  PERSONAL_INBOX_MESSAGE_DETAIL_PAGE_CLASS,
  PERSONAL_INBOX_MESSAGE_DETAIL_THREAD_CLASS,
  PERSONAL_INBOX_MESSAGE_DETAIL_TOOLBAR_CLASS,
} from '../../../shared/personal-inbox/personalInboxMessageDetailLayout';

const STATUS_LABEL_KEYS: Record<string, string> = {
  NEW: 'feedback.status.new',
  TRIAGED: 'feedback.status.triaged',
  IN_PROGRESS: 'feedback.status.inProgress',
  RESOLVED: 'feedback.status.resolved',
  WONT_FIX: 'feedback.status.wontFix',
  DUPLICATE: 'feedback.status.duplicate',
};

export type FeedbackInboxFocusPanelProps = {
  ticketId: number;
  scope: PersonalInboxFeedbackScope;
  onBackToInbox: () => void;
};

export const FeedbackInboxFocusPanel: React.FC<FeedbackInboxFocusPanelProps> = ({
  ticketId,
  scope,
  onBackToInbox,
}) => {
  const t = useCultureT();
  const backLabel = resolveCultureLabel(t, 'shell.inbox.backToInbox', 'Back to inbox');
  const loadingLabel = resolveCultureLabel(t, 'shell.inbox.loading', 'Loading inbox…');
  const [ticket, setTicket] = useState<FeedbackTicketDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [correspondenceOpen, setCorrespondenceOpen] = useState(false);
  const [correspondenceMode, setCorrespondenceMode] = useState<'reply' | 'forward'>('reply');
  const [internalNoteOpen, setInternalNoteOpen] = useState(false);
  const [internalNoteBody, setInternalNoteBody] = useState('');
  const [envelopeMessages, setEnvelopeMessages] = useState<PersonalInboxEnvelopeMessage[]>([]);
  const [envelopeLoading, setEnvelopeLoading] = useState(false);

  const replyLabel = resolveCultureLabel(t, 'shell.inbox.correspondence.reply', 'Reply');
  const forwardLabel = resolveCultureLabel(t, 'shell.inbox.correspondence.forward', 'Forward');
  const internalNoteLabel = resolveCultureLabel(
    t,
    'shell.inbox.feedback.internalNote',
    'Internal note',
  );

  const inboxItem = useMemo((): PersonalInboxItem | null => {
    if (!ticket) {
      return null;
    }
    return {
      id: `feedback:${ticketId}`,
      kind: 'feedback',
      origin: 'Feedback',
      originDetail: scope === 'mine' ? 'My submission' : 'Staff queue',
      title: ticket.title,
      summary: null,
      surfacedAt: ticket.lastMessageAt ?? ticket.submittedAt ?? new Date().toISOString(),
      attention: 'none',
      href: buildPersonalInboxFeedbackFocusHref(ticketId, scope),
      ref: { type: 'feedback', id: ticketId },
    };
  }, [scope, ticket, ticketId]);

  const openCorrespondence = useCallback((mode: 'reply' | 'forward') => {
    setCorrespondenceMode(mode);
    setCorrespondenceOpen(true);
  }, []);

  const loadEnvelope = useCallback(async () => {
    setEnvelopeLoading(true);
    try {
      const detail = await personalInboxApi.getItemDetail(`feedback:${ticketId}`);
      setEnvelopeMessages(detail.messages);
    } catch {
      setEnvelopeMessages([]);
    } finally {
      setEnvelopeLoading(false);
    }
  }, [ticketId]);

  const loadTicket = useCallback(async () => {
    setIsLoading(true);
    setDetailError(null);
    try {
      const result = scope === 'mine'
        ? await feedbackApi.getMine(String(ticketId))
        : await feedbackApi.get(String(ticketId));
      setTicket(result.ticket);
      await loadEnvelope();
      if (scope === 'mine') {
        await feedbackApi.markMineRead(String(ticketId));
      }
      const itemKey = `feedback:${ticketId}`;
      try {
        const { summary } = await personalInboxApi.dismissAttention(itemKey);
        void notifyPersonalInboxChangedWithFallback(summary);
      } catch {
        // Inbox sync is best-effort; ticket detail still loaded.
      }
    } catch (err) {
      setDetailError(
        err instanceof FeedbackApiError
          ? err.message
          : resolveCultureLabel(t, 'feedback.inbox.detailError', 'Failed to load feedback details.'),
      );
      setTicket(null);
    } finally {
      setIsLoading(false);
    }
  }, [loadEnvelope, scope, t, ticketId]);

  const submitInternalNote = useCallback(async () => {
    const body = internalNoteBody.trim();
    if (!body) {
      return;
    }
    setBusy(true);
    try {
      const result = await feedbackApi.postMessage(String(ticketId), { body, kind: 'INTERNAL' });
      setTicket(result.ticket);
      await loadEnvelope();
      setInternalNoteBody('');
      setInternalNoteOpen(false);
    } catch (err) {
      setDetailError(err instanceof FeedbackApiError ? err.message : t('feedback.thread.sendError'));
    } finally {
      setBusy(false);
    }
  }, [internalNoteBody, loadEnvelope, t, ticketId]);

  useEffect(() => {
    void loadTicket();
  }, [loadTicket]);

  const runStaffAction = useCallback(async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      await loadTicket();
    } catch (err) {
      setDetailError(err instanceof FeedbackApiError ? err.message : t('feedback.inbox.detailError'));
    } finally {
      setBusy(false);
    }
  }, [loadTicket, t]);

  const title = ticket?.title ?? resolveCultureLabel(t, 'shell.inbox.feedbackDetail.title', 'Feedback');

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col bg-white font-sans">
      <div className={PERSONAL_INBOX_MESSAGE_DETAIL_TOOLBAR_CLASS}>
        <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
          <WorkspaceBackIcon ariaLabel={backLabel} title={backLabel} onClick={onBackToInbox} />
          <DirectionalText
            as="span"
            text={title}
            className="min-w-0 truncate text-sm font-semibold text-slate-800"
          />
          {ticket ? (
            <span className="shrink-0 text-xs text-slate-500">
              {t(STATUS_LABEL_KEYS[ticket.status] ?? 'feedback.status.new')}
            </span>
          ) : null}
        </div>
        <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
          {ticket && inboxSupportsCorrespondenceAction('feedback', 'reply') ? (
            <AppButton
              type="button"
              size="sm"
              intent="secondary"
              disabled={busy}
              onClick={() => openCorrespondence('reply')}
            >
              <PersonalInboxReplyIcon className="h-3.5 w-3.5" />
              {replyLabel}
            </AppButton>
          ) : null}
          {ticket && inboxSupportsCorrespondenceAction('feedback', 'forward') ? (
            <AppButton
              type="button"
              size="sm"
              intent="secondary"
              disabled={busy}
              onClick={() => openCorrespondence('forward')}
            >
              <PersonalInboxForwardIcon className="h-3.5 w-3.5" />
              {forwardLabel}
            </AppButton>
          ) : null}
          {ticket && scope === 'staff' ? (
            <AppButton
              type="button"
              size="sm"
              intent="secondary"
              disabled={busy}
              onClick={() => setInternalNoteOpen(true)}
            >
              <StickyNote className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {internalNoteLabel}
            </AppButton>
          ) : null}
          <ToolbarRefreshButton
            separatorBefore={false}
            onRefresh={() => void loadTicket()}
            isRefreshing={isLoading || busy}
          />
        </div>
      </div>

      <div className={PERSONAL_INBOX_MESSAGE_DETAIL_PAGE_CLASS}>
        {isLoading && !ticket ? (
          <p className="text-sm text-slate-500">{loadingLabel}</p>
        ) : null}
        {detailError ? (
          <QueryErrorPanel
            message={title}
            detail={detailError}
            onRetry={() => void loadTicket()}
            isRetrying={isLoading}
            className="h-32"
          />
        ) : null}
        {ticket && !detailError ? (
          <>
            <div className="space-y-1 pb-1">
              {ticket.subjectId ? (
                <p className="text-xs text-slate-500">
                  {resolveFeedbackSubjectLabel(t, ticket.subjectId, ticket.subjectLabel)}
                  {ticket.submitterDisplayName && scope === 'staff' ? ` · ${ticket.submitterDisplayName}` : ''}
                </p>
              ) : null}
              {scope === 'staff' ? (
                <div className="flex flex-wrap gap-1 pt-2">
                  <AppButton type="button" intent="utility" size="sm" disabled={busy} onClick={() => void runStaffAction(() => feedbackApi.claim(String(ticketId)))}>
                    {t('feedback.inbox.claim')}
                  </AppButton>
                  <AppButton type="button" intent="utility" size="sm" disabled={busy} onClick={() => void runStaffAction(() => feedbackApi.updateStatus(String(ticketId), { status: 'IN_PROGRESS' }))}>
                    {t('feedback.inbox.markInProgress')}
                  </AppButton>
                  <AppButton type="button" intent="success" size="sm" disabled={busy} onClick={() => void runStaffAction(() => feedbackApi.updateStatus(String(ticketId), { status: 'RESOLVED' }))}>
                    {t('feedback.inbox.resolve')}
                  </AppButton>
                </div>
              ) : null}
            </div>
            <div className={PERSONAL_INBOX_MESSAGE_DETAIL_THREAD_CLASS}>
              {envelopeLoading && envelopeMessages.length === 0 ? (
                <p className="text-sm text-slate-500">{loadingLabel}</p>
              ) : null}
              <PersonalInboxEnvelopeMessageBlock messages={envelopeMessages} />
            </div>
          </>
        ) : null}
      </div>
      <PersonalInboxCorrespondenceDialog
        open={correspondenceOpen}
        mode={correspondenceMode}
        item={inboxItem}
        onOpenChange={setCorrespondenceOpen}
        onCompleted={() => {
          void loadTicket();
          void loadEnvelope();
        }}
      />
      {internalNoteOpen ? (
        <CreateEditModalShell
          title={internalNoteLabel}
          size="md"
          onClose={() => {
            setInternalNoteOpen(false);
            setInternalNoteBody('');
          }}
          footer={(
            <>
              <AppButton
                intent="cancel"
                size="sm"
                onClick={() => {
                  setInternalNoteOpen(false);
                  setInternalNoteBody('');
                }}
                disabled={busy}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                {resolveCultureLabel(t, 'actions.cancel', 'Cancel')}
              </AppButton>
              <AppButton
                intent="primary"
                size="sm"
                disabled={busy || !internalNoteBody.trim()}
                onClick={() => void submitInternalNote()}
              >
                {t('feedback.thread.send')}
              </AppButton>
            </>
          )}
        >
          <UiTextarea
            rows={5}
            value={internalNoteBody}
            onChange={(event) => setInternalNoteBody(event.target.value)}
            placeholder={t('feedback.thread.placeholder')}
            ariaLabel={internalNoteLabel}
          />
        </CreateEditModalShell>
      ) : null}
    </div>
  );
};
