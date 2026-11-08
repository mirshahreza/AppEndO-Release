import React, { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HeaderHintTooltip } from '../../../shared/ui/SideHintTooltip';
import {
  PERSONAL_INBOX_CHANGED_EVENT,
  personalInboxApi,
} from '../../../shared/api/personalInboxApi';
import { usePlatformConfig } from '../../../app/platform/PlatformConfigProvider';
import { useOptionalPlatformMount } from '../../../app/platform/PlatformMountContext';
import { resolveStudioRelativeHref } from '../../../shared/lib/studioRelativeHref';
import { useCultureT } from '../../../core/culture/CultureContext';
import { resolveCultureLabel } from '../../../core/culture/cultureShellKeys';
import { ADMIN_SHELL_HEADER_ICON_BUTTON_CLASS } from '../../../shared/ui/surfaceClasses';

export const ShellNotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { config } = usePlatformConfig();
  const mountId = useOptionalPlatformMount()?.id;
  const t = useCultureT();
  const studioHrefOptions = { config, mountId };
  const isPersonalInboxRoute = location.pathname.includes('/my-inbox');
  const [attentionCount, setAttentionCount] = useState(0);

  const title = resolveCultureLabel(t, 'shell.inbox.bell.title', 'Inbox');
  const hint = resolveCultureLabel(t, 'shell.inbox.bell.hint', 'New work, feedback, and alerts — open your personal inbox.');

  const refresh = useCallback(async () => {
    try {
      const summary = await personalInboxApi.summary();
      setAttentionCount(Math.max(0, summary.attentionCount ?? 0));
    } catch {
      // Keep last badge; refresh on next poll/focus.
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onFocus = () => {
      void refresh();
    };
    const intervalId = window.setInterval(() => {
      void refresh();
    }, 60_000);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(intervalId);
    };
  }, [refresh]);

  useEffect(() => {
    const onInboxChanged = () => {
      void refresh();
    };
    window.addEventListener(PERSONAL_INBOX_CHANGED_EVENT, onInboxChanged);
    return () => window.removeEventListener(PERSONAL_INBOX_CHANGED_EVENT, onInboxChanged);
  }, [refresh]);

  const openInbox = () => {
    if (isPersonalInboxRoute) {
      return;
    }
    navigate(resolveStudioRelativeHref(location.pathname, 'my-inbox?folder=all', studioHrefOptions));
  };

  return (
    <HeaderHintTooltip
      title={title}
      hint={hint}
      tone="violet"
      className="inline-flex shrink-0 translate-y-px items-center self-center"
    >
      <button
        type="button"
        className={ADMIN_SHELL_HEADER_ICON_BUTTON_CLASS}
        aria-label={
          attentionCount > 0
            ? `${title} (${attentionCount})`
            : title
        }
        onClick={openInbox}
        disabled={isPersonalInboxRoute}
      >
        <Bell className="h-5 w-5 shrink-0" strokeWidth={1.75} />
        {attentionCount > 0 ? (
          <span
            aria-hidden
            className="pointer-events-none absolute -end-0.5 -top-0.5 inline-flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white"
            data-testid="shell-inbox-attention-badge"
          >
            {attentionCount > 99 ? '99+' : attentionCount}
          </span>
        ) : null}
      </button>
    </HeaderHintTooltip>
  );
};
