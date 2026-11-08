import React from 'react';
import { Menu } from 'lucide-react';
import { PortalBrandLogo } from '../../app/platform/PortalBrandLogo';
import { NavigationIcon } from '../../shared/lib/navigationIcons/NavigationIcon';
import { ShellHeaderCompactTitleRow } from './ShellHeaderCompactTitleRow';
import { ShellHeaderTitle } from './ShellHeaderTitle';
import { FeedbackEntryButton } from '../../features/feedback/components/FeedbackSubmitDialog';
import { ShellNotificationBell } from '../../features/user-messages/components/ShellNotificationBell';
import { PageGuideHeaderButton } from '../../shared/ui/shell/pageGuide/PageGuideHeaderButton';
import { ShellHeaderPageActions } from './ShellHeaderPageActions';
import { ShellHeaderAccountEndCluster } from './ShellHeaderAccountEndCluster';
import { ShellPageWidthHeaderControl } from '../../shared/ui/shell-foundation/ShellPageWidthHeaderControl';
import { pageGuideProps } from '../../shared/ui/shell/pageGuide/pageGuide.attrs';
import { pageGuideChromeProps } from '../../shared/ui/shell/pageGuide/pageGuideChrome';
import {
  adminShellHamburgerButtonClass,
  ADMIN_SHELL_HEADER_ACTIONS_CLUSTER_CLASS,
  ADMIN_SHELL_HEADER_UTILITY_CLUSTER_CLASS,
  ADMIN_SHELL_HEADER_VERTICAL_SEPARATOR_CLASS,
  ADMIN_SHELL_HEADER_SUBTITLE_CLASS,
  ADMIN_SHELL_HEADER_TITLE_CLASS,
} from '../../shared/ui/surfaceClasses';

export type AdminShellHeaderModule = {
  label?: string;
  description?: string;
  icon?: string;
  groupLabel?: string | null;
  titleTrail?: string[];
};

export type AdminShellHeaderProps = {
  isMobileMenuOpen: boolean;
  onMobileMenuOpenChange: (open: boolean) => void;
  currentModule: AdminShellHeaderModule;
  onProfileOpen: () => void;
  onLogoClick: () => void;
  displayName: string;
  avatarXs?: string | null;
  avatarInitial: string;
  primaryRole: string;
  tShell: (key: string) => string;
  pageKey?: string | null;
  utilityNav?: React.ReactNode;
  /** When sidebar is fully hidden on desktop, keep the menu control visible on lg+. */
  desktopNavigationMenu?: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
};

export const AdminShellHeader: React.FC<AdminShellHeaderProps> = ({
  isMobileMenuOpen,
  onMobileMenuOpenChange,
  currentModule,
  onProfileOpen,
  onLogoClick,
  displayName,
  avatarXs,
  avatarInitial,
  primaryRole,
  tShell,
  pageKey,
  utilityNav,
  desktopNavigationMenu = false,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const pageTitle = currentModule.label ?? 'Page';

  return (
  <>
    <div className="relative flex min-w-0 flex-1 items-center gap-2 overflow-hidden lg:gap-4">
      <button
        type="button"
        className={adminShellHamburgerButtonClass({ visibleOnDesktop: desktopNavigationMenu })}
        onClick={() => onMobileMenuOpenChange(!isMobileMenuOpen)}
        aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={isMobileMenuOpen}
        aria-controls="admin-shell-sidebar"
        {...pageGuideChromeProps(tShell, 'menu', 18)}
      >
        <Menu className="flex h-5 w-5 items-center" />
      </button>
      <div className="flex shrink-0 items-center lg:hidden">
        <PortalBrandLogo collapsed variant="sidebar" className="h-7 w-auto translate-y-0" onClick={onLogoClick} />
      </div>
      <div className="flex min-w-0 items-center max-sm:hidden lg:ms-2">
        <div
          className="flex min-w-0 max-w-full flex-col lg:max-w-[min(100%,42rem)] lg:-translate-y-px rtl:lg:max-w-[min(100%,26rem)]"
          {...pageGuideProps({
            title: currentModule.label?.trim() || tShell('pageGuide.chrome.location.title'),
            hint: currentModule.description?.trim() || tShell('pageGuide.chrome.location.hint'),
            priority: 12,
            scope: 'chrome',
            topic: 'page',
          })}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {currentModule.icon ? (
              <NavigationIcon
                iconRef={currentModule.icon}
                className="h-5 w-5 shrink-0 text-primary-700 max-lg:hidden"
              />
            ) : null}
            <ShellHeaderTitle
              groupLabel={currentModule.groupLabel}
              pageLabel={currentModule.label}
              titleTrail={currentModule.titleTrail}
              fallbackLabel={tShell('shell.portalDashboard')}
              className={ADMIN_SHELL_HEADER_TITLE_CLASS}
            />
          </div>
          <p className={ADMIN_SHELL_HEADER_SUBTITLE_CLASS}>
            {currentModule.description || tShell('shell.welcome')}
          </p>
        </div>
        <ShellHeaderPageActions pageKey={pageKey} pageTitle={pageTitle} />
      </div>
    </div>

    <div className={`${ADMIN_SHELL_HEADER_ACTIONS_CLUSTER_CLASS} z-30 shrink-0 overflow-visible`}>
      <div className={ADMIN_SHELL_HEADER_UTILITY_CLUSTER_CLASS}>
        <PageGuideHeaderButton />
        {utilityNav}
      </div>

      <span
        role="separator"
        aria-orientation="vertical"
        className={ADMIN_SHELL_HEADER_VERTICAL_SEPARATOR_CLASS}
      />

      <FeedbackEntryButton pageKey={pageKey} variant="header" />

      <ShellNotificationBell />

      <span
        role="separator"
        aria-orientation="vertical"
        className={ADMIN_SHELL_HEADER_VERTICAL_SEPARATOR_CLASS}
      />

      <ShellPageWidthHeaderControl studioAdminChrome className="inline-flex shrink-0" />

      <ShellHeaderAccountEndCluster
        onProfileOpen={onProfileOpen}
        displayName={displayName}
        avatarXs={avatarXs}
        avatarInitial={avatarInitial}
        primaryRole={primaryRole}
        tShell={tShell}
        isFullscreen={isFullscreen}
        onToggleFullscreen={onToggleFullscreen}
      />
    </div>

    <ShellHeaderCompactTitleRow
      groupLabel={currentModule.groupLabel}
      pageLabel={currentModule.label}
      titleTrail={currentModule.titleTrail}
      fallbackLabel={tShell('shell.portalDashboard')}
    />
  </>
  );
};
