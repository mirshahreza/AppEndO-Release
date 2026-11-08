import React, { useCallback, useEffect, useState } from 'react';
import { Archive } from 'lucide-react';
import { AppButton, CreateEditModalShell, QueryErrorPanel } from '../../../shared/ui';
import { useCultureT } from '../../../core/culture/CultureContext';
import { resolveCultureLabel } from '../../../core/culture/cultureShellKeys';
import {
  formatMessagesLedgerChannel,
  formatMessagesLedgerStatus,
} from '../../../shared/lib/messagesLedgerCulture';
import { notifyPersonalInboxChangedWithFallback, personalInboxApi } from '../../../shared/api/personalInboxApi';
import { showAppFeedbackToast } from '../../../shared/ui/appFeedbackToast';
import { PERSONAL_INBOX_SYSTEM_FOLDER_ARCHIVED } from '../../../shared/personal-inbox/personalInboxFolderRefs';
import { MountGridDateText } from '../../../app/platform/MountGridDateText';
import type { PersonalInboxItemDetailEnvelope } from '../../../shared/api/contracts/personal-inbox/envelopeTypes';
import { PersonalInboxEnvelopeMessageBlock } from '../../../shared/personal-inbox/PersonalInboxEnvelopeMessageBlock';
import { PERSONAL_INBOX_MESSAGE_DETAIL_PAGE_CLASS } from '../../../shared/personal-inbox/personalInboxMessageDetailLayout';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePlatformConfig } from '../../../app/platform/PlatformConfigProvider';
import { useOptionalPlatformMount } from '../../../app/platform/PlatformMountContext';
import { resolveStudioRelativeHref } from '../../../shared/lib/studioRelativeHref';
import { resolveInboxItemTitle } from '../../../shared/lib/shellInboxCultureLabels';

export type PersonalInboxDispatchDetailDialogProps = {
  dispatchId: number | null;
  onClose: () => void;
  onArchived?: () => void;
};

export const PersonalInboxDispatchDetailDialog: React.FC<PersonalInboxDispatchDetailDialogProps> = ({
  dispatchId,
  onClose,
  onArchived,
}) => {
  const t = useCultureT();
  const navigate = useNavigate();
  const location = useLocation();
  const { config } = usePlatformConfig();
  const mountId = useOptionalPlatformMount()?.id;
  const studioHrefOptions = { config, mountId };

  const [detail, setDetail] = useState<PersonalInboxItemDetailEnvelope | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  const loadDetail = useCallback(async (id: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const envelope = await personalInboxApi.getItemDetail(`message_dispatch:${id}`);
      setDetail(envelope);
    } catch (err) {
      setDetail(null);
      setError(err instanceof Error ? err.message : 'Failed to load dispatch.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (dispatchId == null) {
      setDetail(null);
      setError(null);
      return;
    }
    void loadDetail(dispatchId);
  }, [dispatchId, loadDetail]);

  if (dispatchId == null) {
    return null;
  }

  const title = detail?.item.title
    ? resolveInboxItemTitle(t, detail.item.title)
    : resolveCultureLabel(t, 'shell.inbox.dispatchDetail.title', 'Send log entry');
  const archiveLabel = resolveCultureLabel(t, 'shell.inbox.folder.archived', 'Archived');
  const ledger = detail?.dispatchLedger;

  const archiveDispatch = () => {
    setArchiving(true);
    void personalInboxApi.setItemFolderRefs(`message_dispatch:${dispatchId}`, [PERSONAL_INBOX_SYSTEM_FOLDER_ARCHIVED])
      .then(({ summary }) => {
        void notifyPersonalInboxChangedWithFallback(summary);
        onArchived?.();
        onClose();
      })
      .catch((err) => {
        showAppFeedbackToast(
          err instanceof Error ? err.message : resolveCultureLabel(t, 'shell.inbox.folder.saveFailed', 'Could not update folders.'),
          { type: 'error' },
        );
      })
      .finally(() => setArchiving(false));
  };

  return (
    <CreateEditModalShell
      onClose={onClose}
      title={title}
      size="maximized"
      footer={(
        <AppButton
          size="sm"
          intent="secondary"
          disabled={archiving || isLoading || !detail}
          onClick={archiveDispatch}
        >
          <Archive className="me-1.5 h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
          {archiveLabel}
        </AppButton>
      )}
    >
      {isLoading && !detail ? (
        <p className="text-sm text-slate-500">
          {resolveCultureLabel(t, 'shell.inbox.messagesLedger.loading', 'Loading your messages…')}
        </p>
      ) : null}
      {error ? (
        <QueryErrorPanel
          message={resolveCultureLabel(t, 'shell.inbox.messagesLedger.loadFailed', 'Could not load messages')}
          detail={error}
          onRetry={() => void loadDetail(dispatchId)}
          isRetrying={isLoading}
          className="h-32"
        />
      ) : null}
      {detail && !error ? (
        <div className={`${PERSONAL_INBOX_MESSAGE_DETAIL_PAGE_CLASS} min-h-0 gap-5 text-sm text-slate-700`}>
          {ledger ? (
            <dl className="grid w-full grid-cols-1 gap-x-10 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {resolveCultureLabel(t, 'shell.inbox.messagesLedger.column.channel', 'Channel')}
                </dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {formatMessagesLedgerChannel(t, ledger.channel)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {resolveCultureLabel(t, 'shell.inbox.messagesLedger.column.status', 'Status')}
                </dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {formatMessagesLedgerStatus(t, ledger.deliveryStatus)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {resolveCultureLabel(t, 'shell.inbox.messagesLedger.column.type', 'Type')}
                </dt>
                <dd className="mt-0.5 font-medium text-slate-900">{ledger.eventType}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {resolveCultureLabel(t, 'shell.inbox.grid.column.date', 'Date')}
                </dt>
                <dd className="mt-0.5">
                  <MountGridDateText value={ledger.createdAt} align="start" className="inline w-auto font-mono text-xs" />
                </dd>
              </div>
              {ledger.deliveredAt ? (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {resolveCultureLabel(t, 'shell.inbox.dispatchDetail.delivered', 'Delivered')}
                  </dt>
                  <dd className="mt-0.5">
                    <MountGridDateText value={ledger.deliveredAt} align="start" className="inline w-auto font-mono text-xs" />
                  </dd>
                </div>
              ) : null}
              {ledger.errorSummary ? (
                <div className="sm:col-span-2 lg:col-span-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-rose-600">
                    {resolveCultureLabel(t, 'shell.inbox.dispatchDetail.error', 'Error')}
                  </dt>
                  <dd className="mt-0.5 text-rose-700">{ledger.errorSummary}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          {detail.messages.length > 0 ? (
            <PersonalInboxEnvelopeMessageBlock messages={detail.messages} />
          ) : null}
          {ledger?.href ? (
            <AppButton
              size="sm"
              intent="secondary"
              onClick={() => {
                onClose();
                navigate(resolveStudioRelativeHref(location.pathname, ledger.href!, studioHrefOptions));
              }}
            >
              {resolveCultureLabel(t, 'shell.inbox.dispatchDetail.openLink', 'Open link')}
            </AppButton>
          ) : null}
        </div>
      ) : null}
    </CreateEditModalShell>
  );
};
