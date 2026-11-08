import React from 'react';
import { Menu } from 'lucide-react';
import { PortalBrandLogo } from '../../app/platform/PortalBrandLogo';
import { NavigationIcon } from '../../shared/lib/navigationIcons/NavigationIcon';
import { ShellHeaderCompactTitleRow } from '../adminShell/ShellHeaderCompactTitleRow';
import { ShellHeaderTitle } from '../adminShell/ShellHeaderTitle';
import { FeedbackEntryButton } from '../../features/feedback/components/FeedbackSubmitDialog';
import { ShellNotificationBell } from '../../features/user-messages/components/ShellNotificationBell';
import { PageGuideHeaderButton } from '../../shared/ui/shell/pageGuide/PageGuideHeaderButton';
import { ShellHeaderPageActions } from '../adminShell/ShellHeaderPageActions';
import { ShellHeaderAccountEndCluster } from '../adminShell/ShellHeaderAccountEndCluster';
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

export type AppShellHeaderBreadcrumbSegment = {
  label: string;
  icon?: string;
  path?: string;
};

export type AppShellHeaderModule = {
  label?: string;
  description?: string;
  icon?: string;
  groupLabel?: string | null;
  titleTrail?: string[];
  breadcrumbTrail?: AppShellHeaderBreadcrumbSegment[];
};

export type AppShellHeaderProps = {
  isMobileMenuOpen: boolean;
  onMobileMenuOpenChange: (open: boolean) => void;
  currentModule: AppShellHeaderModule;
  onProfileOpen: () => void;
  onLogoClick?: () => void;
  displayName: string;
  avatarXs?: string | null;
  avatarInitial: string;
  primaryRole: string;
  tShell: (key: string) => string;
  pageKey?: string | null;
  showLogo?: boolean;
  showBreadcrumb?: boolean;
  showActions?: boolean;
  utilityNav?: React.ReactNode;
  desktopNavigationMenu?: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
};

export const AppShellHeader: React.FC<AppShellHeaderProps> = ({
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
  showLogo = true,
  showBreadcrumb = true,
  showActions = true,
  utilityNav,
  desktopNavigationMenu = false,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const pageTitle = currentModule.label ?? 'Page';
  const breadcrumbTrail = currentModule.breadcrumbTrail ?? [];
  const showDeepBreadcrumbNav = showBreadcrumb
    && !currentModule.titleTrail?.length
    && breadcrumbTrail.length > 2;
  const breadcrumbAncestors = showDeepBreadcrumbNav ? breadcrumbTrail.slice(0, -1) : [];
  const headerGroupLabel = showDeepBreadcrumbNav ? null : currentModule.groupLabel;
  /** Always show explanatory subtitle when present (Admin shell parity). titleTrail must not replace description. */
  const showPageSubtitle = Boolean(currentModule.description?.trim())
    || !currentModule.titleTrail?.length;

  return (
  <>
    <div className="relative flex min-w-0 flex-1 items-center gap-2 overflow-hidden lg:gap-4">
      {showLogo ? (
        <div className="hidden shrink-0 items-center me-2 lg:flex">
          <PortalBrandLogo variant="sidebar" className="h-6 w-auto" />
        </div>
      ) : null}
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
      {showLogo ? (
        <div className="flex shrink-0 items-center lg:hidden">
          <PortalBrandLogo collapsed variant="sidebar" className="h-7 w-auto translate-y-0" onClick={onLogoClick} />
        </div>
      ) : null}
      <div className="hidden min-w-0 flex-col max-lg:ms-0 sm:flex lg:hidden">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <ShellHeaderTitle
            groupLabel={headerGroupLabel}
            pageLabel={currentModule.label}
            titleTrail={currentModule.titleTrail}
            fallbackLabel={tShell('shell.portalDashboard')}
            className={ADMIN_SHELL_HEADER_TITLE_CLASS}
          />
        </div>
      </div>
      <div className="hidden min-w-0 items-center lg:flex lg:ms-2">
        <div
          className="flex min-w-0 flex-col lg:max-w-[min(100%,42rem)] lg:-translate-y-px"
          {...pageGuideProps({
            title: currentModule.label?.trim() || tShell('pageGuide.chrome.location.title'),
            hint: currentModule.description?.trim() || tShell('pageGuide.chrome.location.hint'),
            priority: 12,
            scope: 'chrome',
            topic: 'page',
          })}
        >
          {showDeepBreadcrumbNav && breadcrumbAncestors.length > 0 ? (
            <nav
              aria-label="Breadcrumb"
              className="mb-0.5 hidden min-w-0 items-center gap-1 text-[11px] font-medium text-slate-400 xl:flex"
            >
              {breadcrumbAncestors.map((segment, index) => (
                <React.Fragment key={`${segment.label}-${index}`}>
                  {index > 0 ? <span className="mx-[2px] shrink-0 font-bold text-slate-500">/</span> : null}
                  <span className="truncate" title={segment.label}>
                    {segment.label}
                  </span>
                </React.Fragment>
              ))}
            </nav>
          ) : null}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {currentModule.icon ? (
              <NavigationIcon
                iconRef={currentModule.icon}
                className="h-[20px] w-[20px] shrink-0 text-primary-700"
              />
            ) : null}
            <ShellHeaderTitle
              groupLabel={headerGroupLabel}
              pageLabel={currentModule.label}
              titleTrail={currentModule.titleTrail}
              fallbackLabel={tShell('shell.portalDashboard')}
              className={ADMIN_SHELL_HEADER_TITLE_CLASS}
            />
          </div>
          {showPageSubtitle ? (
            <p className={ADMIN_SHELL_HEADER_SUBTITLE_CLASS}>
              {currentModule.description || tShell('shell.welcome')}
            </p>
          ) : null}
        </div>
        <ShellHeaderPageActions pageKey={pageKey} pageTitle={pageTitle} />
      </div>
    </div>

    {showActions ? (
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
    ) : null}

    <ShellHeaderCompactTitleRow
      groupLabel={headerGroupLabel}
      pageLabel={currentModule.label}
      titleTrail={currentModule.titleTrail}
      fallbackLabel={tShell('shell.portalDashboard')}
    />
  </>
  );
};
