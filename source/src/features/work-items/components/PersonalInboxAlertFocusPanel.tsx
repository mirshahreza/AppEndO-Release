import React, { useCallback, useEffect, useState } from 'react';
import {
  DirectionalText,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  QueryErrorPanel,
  WorkspaceBackIcon,
} from '../../../shared/ui';
import { useCultureT } from '../../../core/culture/CultureContext';
import { resolveCultureLabel } from '../../../core/culture/cultureShellKeys';
import type { PersonalInboxItem } from '../../../shared/api/contracts/personal-inbox/types';
import { personalInboxApi } from '../../../shared/api/personalInboxApi';
import { PersonalInboxEnvelopeDetailView } from '../../../shared/personal-inbox/PersonalInboxEnvelopeDetailView';
import { PERSONAL_INBOX_MESSAGE_DETAIL_TOOLBAR_CLASS } from '../../../shared/personal-inbox/personalInboxMessageDetailLayout';

export type PersonalInboxAlertFocusPanelProps = {
  notificationId: number;
  onBackToInbox: () => void;
};

export const PersonalInboxAlertFocusPanel: React.FC<PersonalInboxAlertFocusPanelProps> = ({
  notificationId,
  onBackToInbox,
}) => {
  const t = useCultureT();
  const backLabel = resolveCultureLabel(t, 'shell.inbox.backToInbox', 'Back to inbox');
  const loadingLabel = resolveCultureLabel(t, 'shell.inbox.loading', 'Loading inbox…');
  const detailErrorLabel = resolveCultureLabel(
    t,
    'shell.inbox.alertDetail.loadError',
    'Failed to load alert details.',
  );

  const itemKey = `alert:${notificationId}`;
  const [item, setItem] = useState<PersonalInboxItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const envelope = await personalInboxApi.getItemDetail(itemKey);
      setItem(envelope.item);
    } catch (err) {
      setItem(null);
      setLoadError(err instanceof Error ? err.message : detailErrorLabel);
    } finally {
      setIsLoading(false);
    }
  }, [detailErrorLabel, itemKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const headerTitle = item?.title ?? resolveCultureLabel(t, 'shell.inbox.filter.alerts', 'Alerts');

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-white font-sans">
      <div className={PERSONAL_INBOX_MESSAGE_DETAIL_TOOLBAR_CLASS}>
        <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
          <WorkspaceBackIcon ariaLabel={backLabel} title={backLabel} onClick={onBackToInbox} />
          <DirectionalText
            as="span"
            text={headerTitle}
            className="min-w-0 truncate text-sm font-semibold text-slate-800"
          />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-auto px-4 pb-6 pt-4 sm:px-6">
        {isLoading && !item ? (
          <p className="text-sm text-slate-500">{loadingLabel}</p>
        ) : null}
        {loadError ? (
          <QueryErrorPanel message={detailErrorLabel} detail={loadError} onRetry={() => void load()} />
        ) : null}
        {item && !loadError ? (
          <PersonalInboxEnvelopeDetailView
            item={item}
            loadErrorLabel={detailErrorLabel}
            onCorrespondenceCompleted={() => void load()}
          />
        ) : null}
      </div>
    </div>
  );
};
