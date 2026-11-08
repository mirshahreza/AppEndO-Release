import React, { useCallback, useEffect, useState } from 'react';
import { AppButton, QueryErrorPanel } from '../ui';
import type { PersonalInboxItem } from '../api/contracts/personal-inbox/types';
import type { PersonalInboxItemDetailEnvelope } from '../api/contracts/personal-inbox/envelopeTypes';
import { useCultureT } from '../../core/culture/CultureContext';
import { resolveCultureLabel } from '../../core/culture/cultureShellKeys';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePlatformConfig } from '../../app/platform/PlatformConfigProvider';
import { useOptionalPlatformMount } from '../../app/platform/PlatformMountContext';
import { resolveStudioRelativeHref } from '../lib/studioRelativeHref';
import { PersonalInboxCorrespondenceDialog } from './PersonalInboxCorrespondenceDialog';
import { PersonalInboxEnvelopeMessageBlock } from './PersonalInboxEnvelopeMessageBlock';
import { inboxCorrespondenceCapabilities } from './inboxCorrespondencePolicy';
import { PersonalInboxForwardIcon, PersonalInboxReplyIcon } from './personalInboxCorrespondenceIcons';
import {
  PERSONAL_INBOX_MESSAGE_DETAIL_ACTIONS_CLASS,
  PERSONAL_INBOX_MESSAGE_DETAIL_PAGE_CLASS,
  PERSONAL_INBOX_MESSAGE_DETAIL_THREAD_CLASS,
} from './personalInboxMessageDetailLayout';
import { personalInboxApi } from '../api/personalInboxApi';

export type PersonalInboxEnvelopeDetailViewProps = {
  item: PersonalInboxItem;
  onCorrespondenceCompleted?: () => void;
  loadErrorLabel?: string;
  /** e.g. close modal before navigating to `item.href`. */
  onOpenRelated?: () => void;
};

/** Shared inbox detail body: envelope API + toolbar + message block. */
export const PersonalInboxEnvelopeDetailView: React.FC<PersonalInboxEnvelopeDetailViewProps> = ({
  item,
  onCorrespondenceCompleted,
  loadErrorLabel,
  onOpenRelated,
}) => {
  const t = useCultureT();
  const navigate = useNavigate();
  const location = useLocation();
  const { config } = usePlatformConfig();
  const mountId = useOptionalPlatformMount()?.id;
  const studioHrefOptions = { config, mountId };

  const [detail, setDetail] = useState<PersonalInboxItemDetailEnvelope | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [correspondenceOpen, setCorrespondenceOpen] = useState(false);
  const [correspondenceMode, setCorrespondenceMode] = useState<'reply' | 'forward'>('reply');

  const openRelatedLabel = resolveCultureLabel(t, 'shell.inbox.alertDetail.openRelated', 'Open related page');
  const replyLabel = resolveCultureLabel(t, 'shell.inbox.correspondence.reply', 'Reply');
  const forwardLabel = resolveCultureLabel(t, 'shell.inbox.correspondence.forward', 'Forward');
  const loadingLabel = resolveCultureLabel(t, 'shell.inbox.loading', 'Loading inbox…');
  const detailErrorLabel = loadErrorLabel ?? resolveCultureLabel(
    t,
    'shell.inbox.envelope.loadError',
    'Failed to load message details.',
  );
  const emptyLabel = resolveCultureLabel(t, 'shell.inbox.alertDetail.empty', 'No additional details.');

  const loadDetail = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const envelope = await personalInboxApi.getItemDetail(item.id);
      setDetail(envelope);
    } catch (err) {
      setDetail(null);
      setLoadError(err instanceof Error ? err.message : detailErrorLabel);
    } finally {
      setIsLoading(false);
    }
  }, [detailErrorLabel, item.id]);

  useEffect(() => {
    setDetail(null);
    setLoadError(null);
    setCorrespondenceOpen(false);
    void loadDetail();
  }, [loadDetail]);

  const detailMatchesItem = detail != null && detail.itemKey === item.id;
  const policyCaps = inboxCorrespondenceCapabilities(item.kind);
  const capabilities = detailMatchesItem ? detail.capabilities : undefined;
  const canReply = Boolean(capabilities?.reply && policyCaps.reply);
  const canForward = Boolean(capabilities?.forward && policyCaps.forward);
  const canOpenRelated = detailMatchesItem
    ? (capabilities?.showRelatedHref ?? (
      item.href.trim().length > 0 && !item.href.startsWith('my-inbox')
    ))
    : item.href.trim().length > 0 && !item.href.startsWith('my-inbox');

  const openCorrespondence = (mode: 'reply' | 'forward') => {
    setCorrespondenceMode(mode);
    setCorrespondenceOpen(true);
  };

  return (
    <>
      <div className={`${PERSONAL_INBOX_MESSAGE_DETAIL_PAGE_CLASS} min-h-0 gap-4 text-sm text-slate-700`}>
        <div className={PERSONAL_INBOX_MESSAGE_DETAIL_ACTIONS_CLASS}>
          {canReply ? (
            <AppButton
              size="sm"
              intent="secondary"
              disabled={isLoading}
              onClick={() => openCorrespondence('reply')}
            >
              <PersonalInboxReplyIcon className="h-3.5 w-3.5" />
              {replyLabel}
            </AppButton>
          ) : null}
          {canForward ? (
            <AppButton
              size="sm"
              intent="secondary"
              disabled={isLoading}
              onClick={() => openCorrespondence('forward')}
            >
              <PersonalInboxForwardIcon className="h-3.5 w-3.5" />
              {forwardLabel}
            </AppButton>
          ) : null}
          {canOpenRelated ? (
            <AppButton
              size="sm"
              intent="secondary"
              onClick={() => {
                onOpenRelated?.();
                navigate(resolveStudioRelativeHref(location.pathname, item.href, studioHrefOptions));
              }}
            >
              {openRelatedLabel}
            </AppButton>
          ) : null}
        </div>

        {isLoading && !detail ? (
          <p className="text-slate-500">{loadingLabel}</p>
        ) : null}
        {loadError ? (
          <QueryErrorPanel
            message={item.title}
            detail={loadError}
            onRetry={() => void loadDetail()}
            isRetrying={isLoading}
            className="h-28"
          />
        ) : null}
        {!loadError && detail && detail.messages.length > 0 ? (
          <div className={PERSONAL_INBOX_MESSAGE_DETAIL_THREAD_CLASS}>
            <PersonalInboxEnvelopeMessageBlock messages={detail.messages} />
          </div>
        ) : null}
        {!loadError && !isLoading && detail && detail.messages.length === 0 ? (
          <p className="text-slate-500">{emptyLabel}</p>
        ) : null}
      </div>
      <PersonalInboxCorrespondenceDialog
        open={correspondenceOpen}
        mode={correspondenceMode}
        item={detail?.item ?? item}
        onOpenChange={setCorrespondenceOpen}
        onCompleted={() => {
          void loadDetail();
          onCorrespondenceCompleted?.();
        }}
      />
    </>
  );
};
