import React from 'react';
import { PortalBrandLogo } from '../../app/platform/PortalBrandLogo';
import { PAGE_GUIDE_EN } from '../../core/culture/translations/pageGuideEn';
import { pageGuideChromeProps } from '../../shared/ui/shell/pageGuide/pageGuideChrome';
import { SidebarMenuScrollArea } from '../../shared/ui/SidebarMenuScrollArea';
import { cn } from '../../lib/utils';
import {
  ADMIN_SHELL_SIDEBAR_LOGO_EXPANDED_NUDGE_CLASS,
  ADMIN_SHELL_SIDEBAR_LOGO_INNER_WRAPPER_CLASS,
  adminShellSidebarLogoRegionClassName,
  adminShellSidebarNavClassName,
  adminShellSidebarNavPaddingClass,
} from '../../shared/ui/adminShellSidebarMetrics';

export type ShellSidebarColumnProps = {
  navCollapsed: boolean;
  isRtl: boolean;
  onLogoClick: () => void;
  /** Portal menu row between logo and nav (AppShell / designer published). */
  portalMenuInset?: React.ReactNode;
  quickNav?: React.ReactNode;
  footer?: React.ReactNode;
  navTree: React.ReactNode;
};

export const ShellSidebarColumn: React.FC<ShellSidebarColumnProps> = ({
  navCollapsed,
  isRtl,
  onLogoClick,
  portalMenuInset,
  quickNav,
  footer,
  navTree,
}) => (
  <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
    <div className={adminShellSidebarLogoRegionClassName(navCollapsed)}>
      <div
        className={ADMIN_SHELL_SIDEBAR_LOGO_INNER_WRAPPER_CLASS}
        {...pageGuideChromeProps((key) => PAGE_GUIDE_EN[key] ?? key, 'logo', 15)}
      >
        <PortalBrandLogo
          collapsed={navCollapsed}
          variant="sidebar"
          className={navCollapsed ? undefined : ADMIN_SHELL_SIDEBAR_LOGO_EXPANDED_NUDGE_CLASS}
          onClick={onLogoClick}
        />
      </div>
    </div>

    {portalMenuInset ? (
      <div className={cn('shrink-0', adminShellSidebarNavPaddingClass(navCollapsed))}>
        {portalMenuInset}
      </div>
    ) : null}

    <nav className={adminShellSidebarNavClassName(navCollapsed)}>
      {quickNav}
      {navCollapsed ? (
        <SidebarMenuScrollArea
          className="min-h-0 flex-1"
          dir={isRtl ? 'rtl' : 'ltr'}
          aria-label="Navigation"
        >
          {navTree}
        </SidebarMenuScrollArea>
      ) : navTree}
    </nav>
    {footer}
  </div>
);
