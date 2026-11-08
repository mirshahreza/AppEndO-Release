import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppButton,
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
import {
  directMessagesApi,
  type DirectMessageThreadDto,
} from '../../../shared/api/directMessagesApi';
import type { PersonalInboxItem } from '../../../shared/api/contracts/personal-inbox/types';
import type { PersonalInboxItemDetailEnvelope } from '../../../shared/api/contracts/personal-inbox/envelopeTypes';
import {
  notifyPersonalInboxChangedWithFallback,
  personalInboxApi,
} from '../../../shared/api/personalInboxApi';
import { inboxSupportsCorrespondenceAction } from '../../../shared/personal-inbox/inboxCorrespondencePolicy';
import { PersonalInboxCorrespondenceDialog } from '../../../shared/personal-inbox/PersonalInboxCorrespondenceDialog';
import { PersonalInboxEnvelopeMessageBlock } from '../../../shared/personal-inbox/PersonalInboxEnvelopeMessageBlock';
import { PersonalInboxForwardIcon, PersonalInboxReplyIcon } from '../../../shared/personal-inbox/personalInboxCorrespondenceIcons';
import {
  PERSONAL_INBOX_MESSAGE_DETAIL_PAGE_CLASS,
  PERSONAL_INBOX_MESSAGE_DETAIL_THREAD_CLASS,
  PERSONAL_INBOX_MESSAGE_DETAIL_TOOLBAR_CLASS,
} from '../../../shared/personal-inbox/personalInboxMessageDetailLayout';
import { cn } from '../../../lib/utils';

export type DirectMessageThreadPanelProps = {
  threadId: number;
  onBackToInbox: () => void;
};

export const DirectMessageThreadPanel: React.FC<DirectMessageThreadPanelProps> = ({
  threadId,
  onBackToInbox,
}) => {
  const t = useCultureT();
  const backLabel = resolveCultureLabel(t, 'shell.inbox.backToInbox', 'Back to inbox');
  const titleLabel = resolveCultureLabel(t, 'shell.inbox.directMessage.threadTitle', 'Conversation');
  const replyPlaceholder = resolveCultureLabel(
    t,
    'shell.inbox.directMessage.replyPlaceholder',
    'Write a reply…',
  );
  const sendLabel = resolveCultureLabel(t, 'shell.inbox.directMessage.send', 'Send');
  const replyLabel = resolveCultureLabel(t, 'shell.inbox.correspondence.reply', 'Reply');
  const forwardLabel = resolveCultureLabel(t, 'shell.inbox.correspondence.forward', 'Forward');

  const [thread, setThread] = useState<DirectMessageThreadDto | null>(null);
  const [envelope, setEnvelope] = useState<PersonalInboxItemDetailEnvelope | null>(null);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [correspondenceOpen, setCorrespondenceOpen] = useState(false);
  const [correspondenceMode, setCorrespondenceMode] = useState<'reply' | 'forward'>('reply');

  const inboxItem = useMemo((): PersonalInboxItem => ({
    id: `direct_message:${threadId}`,
    kind: 'direct_message',
    origin: 'Direct message',
    originDetail: thread?.counterpartUsername ?? null,
    title: thread ? `${titleLabel}: ${thread.counterpartUsername}` : titleLabel,
    summary: thread?.lastMessagePreview ?? null,
    surfacedAt: thread?.lastMessageAt ?? new Date().toISOString(),
    attention: 'none',
    href: `my-inbox?kind=direct_message&threadId=${threadId}`,
    ref: { type: 'direct_message', id: threadId },
  }), [thread, threadId, titleLabel]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [threadRow, detail] = await Promise.all([
        directMessagesApi.getThread(threadId),
        personalInboxApi.getItemDetail(`direct_message:${threadId}`),
      ]);
      setThread(threadRow);
      setEnvelope(detail);
      await directMessagesApi.markRead(threadId);
      const { summary } = await personalInboxApi.dismissAttention(`direct_message:${threadId}`);
      await notifyPersonalInboxChangedWithFallback(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversation.');
    } finally {
      setIsLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sendReply = async () => {
    const text = draft.trim();
    if (!text) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await directMessagesApi.sendMessage(threadId, text);
      setDraft('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setBusy(false);
    }
  };

  const openCorrespondence = (mode: 'reply' | 'forward') => {
    setCorrespondenceMode(mode);
    setCorrespondenceOpen(true);
  };

  const headerTitle = thread
    ? `${titleLabel}: ${thread.counterpartUsername}`
    : titleLabel;

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-white font-sans">
      <div className={PERSONAL_INBOX_MESSAGE_DETAIL_TOOLBAR_CLASS}>
        <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
          <AppButton intent="ghost" size="sm" onClick={onBackToInbox}>
            <WorkspaceBackIcon className="h-4 w-4 shrink-0" aria-hidden />
            {backLabel}
          </AppButton>
          <DirectionalText className="text-sm font-semibold text-slate-800">{headerTitle}</DirectionalText>
        </div>
        <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
          {inboxSupportsCorrespondenceAction('direct_message', 'reply') ? (
            <AppButton
              type="button"
              size="sm"
              intent="secondary"
              disabled={busy || isLoading}
              onClick={() => openCorrespondence('reply')}
            >
              <PersonalInboxReplyIcon className="h-3.5 w-3.5" />
              {replyLabel}
            </AppButton>
          ) : null}
          {inboxSupportsCorrespondenceAction('direct_message', 'forward') ? (
            <AppButton
              type="button"
              size="sm"
              intent="secondary"
              disabled={busy || isLoading}
              onClick={() => openCorrespondence('forward')}
            >
              <PersonalInboxForwardIcon className="h-3.5 w-3.5" />
              {forwardLabel}
            </AppButton>
          ) : null}
          <ToolbarRefreshButton onClick={() => void load()} disabled={isLoading || busy} />
        </div>
      </div>

      {error ? (
        <QueryErrorPanel message={error} onRetry={() => void load()} />
      ) : null}

      <div className={cn(PERSONAL_INBOX_MESSAGE_DETAIL_PAGE_CLASS, 'gap-4 pb-6')}>
        <div className={PERSONAL_INBOX_MESSAGE_DETAIL_THREAD_CLASS}>
          {isLoading && !envelope ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : envelope && envelope.messages.length > 0 ? (
            <PersonalInboxEnvelopeMessageBlock messages={envelope.messages} />
          ) : (
            <p className="text-sm text-slate-500">No messages yet.</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-end">
          <UiTextarea
            className="min-h-[4.5rem] flex-1"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={replyPlaceholder}
            disabled={busy || isLoading}
            rows={3}
          />
          <AppButton intent="primary" onClick={() => void sendReply()} disabled={busy || isLoading || !draft.trim()}>
            {sendLabel}
          </AppButton>
        </div>
      </div>
      <PersonalInboxCorrespondenceDialog
        open={correspondenceOpen}
        mode={correspondenceMode}
        item={envelope?.item ?? inboxItem}
        onOpenChange={setCorrespondenceOpen}
        onCompleted={() => void load()}
      />
    </div>
  );
};
