import React, { useCallback, useMemo, useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { FeedbackInboxFocusPanel } from '../../features/feedback/components/FeedbackInboxFocusPanel';
import { WorkItemInboxPanel } from '../../features/work-items/components/WorkItemInboxPanel';
import { PersonalInboxPage } from '../../features/work-items/components/PersonalInboxPage';
import { DirectMessageComposeDialog } from '../../features/direct-messages/components/DirectMessageComposeDialog';
import { DirectMessageThreadPanel } from '../../features/direct-messages/components/DirectMessageThreadPanel';
import { AppButton } from '../../shared/ui';
import { useCultureT } from '../../core/culture/CultureContext';
import { resolveCultureLabel } from '../../core/culture/cultureShellKeys';
import {
  clearPersonalInboxAlertFocusParams,
  clearPersonalInboxDispatchFocusParams,
  parsePersonalInboxDispatchId,
  parsePersonalInboxNotificationId,
  parsePersonalInboxWorkItemId,
} from '../../features/work-items/lib/personalInboxSearchParams';
import { PersonalInboxAlertFocusPanel } from '../../features/work-items/components/PersonalInboxAlertFocusPanel';
import { PersonalInboxDispatchFocusPanel } from '../../features/work-items/components/PersonalInboxDispatchFocusPanel';
import {
  clearPersonalInboxFeedbackFocusParams,
  parsePersonalInboxFeedbackScope,
  parsePersonalInboxFeedbackTicketId,
} from '../../shared/lib/personalInboxFeedbackDeepLink';
import { usePlatformConfig } from '../platform/PlatformConfigProvider';
import { useOptionalPlatformMount } from '../platform/PlatformMountContext';
import { resolveStudioRelativeHref } from '../../shared/lib/studioRelativeHref';
import { usePersonalInboxShellHeader } from '../../features/work-items/hooks/usePersonalInboxShellHeader';
import type { PersonalInboxKindFilter } from '../../shared/api/contracts/personal-inbox/types';
import {
  parsePersonalInboxFolderFilter,
  parsePersonalInboxListUiFilters,
} from '../../features/work-items/lib/personalInboxSearchParams';

const parseInboxKind = (raw: string | null): PersonalInboxKindFilter => {
  const value = raw?.trim().toLowerCase();
  if (
    value === 'work_item'
    || value === 'feedback'
    || value === 'alert'
    || value === 'message_dispatch'
    || value === 'direct_message'
  ) {
    return value;
  }
  return 'all';
};

const parseThreadId = (raw: string | null): number | null => {
  if (!raw?.trim()) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

/**
 * Composed personal inbox route (`pageKey: my-inbox`) — may import multiple features.
 * Query: `workItemId`, `feedbackTicketId`, `feedbackScope`, `kind`, `view=archived`, `dispatchId`, `notificationId`.
 */
export const MyInboxPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const t = useCultureT();
  const [composeOpen, setComposeOpen] = useState(false);
  const { config } = usePlatformConfig();
  const mountId = useOptionalPlatformMount()?.id;
  const studioHrefOptions = useMemo(() => ({ config, mountId }), [config, mountId]);
  usePersonalInboxShellHeader();
  const inboxHref = resolveStudioRelativeHref(location.pathname, 'my-inbox', studioHrefOptions);
  const initialListUiFilters = useMemo(
    () => parsePersonalInboxListUiFilters(searchParams),
    [searchParams],
  );
  const composeLabel = resolveCultureLabel(t, 'shell.inbox.directMessage.compose', 'New message');
  const openThread = useCallback((id: number) => {
    navigate(resolveStudioRelativeHref(
      location.pathname,
      `my-inbox?kind=direct_message&threadId=${encodeURIComponent(String(id))}`,
      studioHrefOptions,
    ));
  }, [location.pathname, navigate, studioHrefOptions]);
  const composeToolbarAction = (
    <AppButton size="sm" intent="primary" onClick={() => setComposeOpen(true)}>
      <MessageSquarePlus className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {composeLabel}
    </AppButton>
  );
  const workItemId = parsePersonalInboxWorkItemId(searchParams);
  const feedbackTicketId = parsePersonalInboxFeedbackTicketId(searchParams);
  const feedbackScope = parsePersonalInboxFeedbackScope(searchParams);
  const threadId = parseThreadId(searchParams.get('threadId'));
  const dispatchId = parsePersonalInboxDispatchId(searchParams);
  const notificationId = parsePersonalInboxNotificationId(searchParams);

  if (searchParams.get('view') === 'messages') {
    return (
      <Navigate
        to={resolveStudioRelativeHref(location.pathname, 'my-inbox?kind=message_dispatch', studioHrefOptions)}
        replace
      />
    );
  }

  if (workItemId != null) {
    return (
      <WorkItemInboxPanel
        initialWorkItemId={workItemId}
        onBackToInbox={() => navigate(inboxHref)}
      />
    );
  }

  if (threadId != null) {
    const backHref = resolveStudioRelativeHref(
      location.pathname,
      (() => {
        const params = new URLSearchParams(searchParams);
        params.delete('threadId');
        const query = params.toString();
        return query ? `my-inbox?${query}` : 'my-inbox';
      })(),
      studioHrefOptions,
    );
    return (
      <DirectMessageThreadPanel
        threadId={threadId}
        onBackToInbox={() => navigate(backHref)}
      />
    );
  }

  if (feedbackTicketId != null) {
    const backHref = resolveStudioRelativeHref(
      location.pathname,
      (() => {
        const cleared = clearPersonalInboxFeedbackFocusParams(searchParams);
        const query = cleared.toString();
        return query ? `my-inbox?${query}` : 'my-inbox';
      })(),
      studioHrefOptions,
    );
    return (
      <FeedbackInboxFocusPanel
        ticketId={feedbackTicketId}
        scope={feedbackScope}
        onBackToInbox={() => navigate(backHref)}
      />
    );
  }

  if (dispatchId != null) {
    const backHref = resolveStudioRelativeHref(
      location.pathname,
      (() => {
        const cleared = clearPersonalInboxDispatchFocusParams(searchParams);
        const query = cleared.toString();
        return query ? `my-inbox?${query}` : 'my-inbox';
      })(),
      studioHrefOptions,
    );
    return (
      <PersonalInboxDispatchFocusPanel
        dispatchId={dispatchId}
        onBackToInbox={() => navigate(backHref)}
      />
    );
  }

  if (notificationId != null) {
    const backHref = resolveStudioRelativeHref(
      location.pathname,
      (() => {
        const cleared = clearPersonalInboxAlertFocusParams(searchParams);
        const query = cleared.toString();
        return query ? `my-inbox?${query}` : 'my-inbox';
      })(),
      studioHrefOptions,
    );
    return (
      <PersonalInboxAlertFocusPanel
        notificationId={notificationId}
        onBackToInbox={() => navigate(backHref)}
      />
    );
  }

  return (
    <>
      <PersonalInboxPage
        initialKind={parseInboxKind(searchParams.get('kind'))}
        initialFolder={parsePersonalInboxFolderFilter(searchParams)}
        initialListUiFilters={initialListUiFilters}
        composeToolbarAction={composeToolbarAction}
      />
      <DirectMessageComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        onSent={openThread}
      />
    </>
  );
};
