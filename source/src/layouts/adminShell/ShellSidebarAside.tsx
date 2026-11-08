import React, { type ComponentType } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { PAGE_GUIDE_EN } from '../../core/culture/translations/pageGuideEn';
import { pageGuideChromeProps } from '../../shared/ui/shell/pageGuide/pageGuideChrome';
import {
  ADMIN_SHELL_SIDEBAR_CLASS,
  ADMIN_SHELL_SIDEBAR_COLLAPSE_BUTTON_CLASS,
  ADMIN_SHELL_SIDEBAR_OVERLAY_CLASS,
} from '../../shared/ui/surfaceClasses';
import { overlayMotionPanelProps } from '../../shared/ui/overlay-motion/overlayMotion';
import { AtmosphereBackdrop } from '../../shared/ui/AtmosphereBackdrop';
import { ShellChromeFinish } from '../../shared/ui/ShellChromeFinish';
import { isOverlayNavTier } from '../../shared/lib/viewportTokens';
import { useViewportTier } from '../../shared/lib/useViewportTier';
import type { AdminShellNavGroup } from './types';
import type { NavRendererProps } from './nav/navRendererTypes';
import { PortalMenu } from './PortalMenu';
import { ShellSidebarColumn } from './ShellSidebarColumn';
import type { SidebarCollapsePolicy } from '../../shared/api/contracts/appearance/shellExperience.schema';

export type ShellSidebarAsideProps = {
  isMobileMenuOpen: boolean;
  isSidebarCollapsed: boolean;
  sidebarCollapsePolicy?: SidebarCollapsePolicy;
  onSidebarCollapsedChange: (collapsed: boolean) => void;
  isRtl: boolean;
  visibleNavGroups: AdminShellNavGroup[];
  pathname: string;
  expandedGroups: Set<string>;
  onExpandedGroupsChange: (groups: Set<string>) => void;
  isExperienceMount: boolean;
  NavRenderer: ComponentType<NavRendererProps>;
  onNavigate: (path: string) => void;
  onLogoClick: () => void;
  applicationMenuAriaLabel?: string;
  portalMenuInset?: React.ReactNode;
  quickNav?: React.ReactNode;
  footer?: React.ReactNode;
};

export const ShellSidebarAside: React.FC<ShellSidebarAsideProps> = ({
  isMobileMenuOpen,
  isSidebarCollapsed,
  sidebarCollapsePolicy = 'rail',
  onSidebarCollapsedChange,
  isRtl,
  visibleNavGroups,
  pathname,
  expandedGroups,
  onExpandedGroupsChange,
  isExperienceMount,
  NavRenderer,
  onNavigate,
  onLogoClick,
  applicationMenuAriaLabel,
  portalMenuInset,
  quickNav,
  footer,
}) => {
  const overlayNav = isOverlayNavTier(useViewportTier());
  const navCollapsed = isSidebarCollapsed && !overlayNav;
  const sidebarFullyHidden = navCollapsed && sidebarCollapsePolicy === 'hidden';
  const overlayMotion = overlayNav
    ? overlayMotionPanelProps({
      kind: 'drawer',
      origin: 'start',
      open: isMobileMenuOpen,
      dir: isRtl ? 'rtl' : 'ltr',
    })
    : null;

  const navTree = (
    <NavRenderer
      groups={visibleNavGroups}
      pathname={pathname}
      isSidebarCollapsed={navCollapsed}
      isRtl={isRtl}
      expandedGroups={expandedGroups}
      onExpandedGroupsChange={onExpandedGroupsChange}
      onNavigate={onNavigate}
      isExperienceMount={isExperienceMount}
      accordion
      lockActiveGroup={false}
      fillHeight
      requireOpenGroup
    />
  );

  return (
    <aside
      id="admin-shell-sidebar"
      aria-hidden={sidebarFullyHidden || (overlayNav && !isMobileMenuOpen) ? true : undefined}
      className={cn(
        ADMIN_SHELL_SIDEBAR_CLASS,
        overlayNav && ADMIN_SHELL_SIDEBAR_OVERLAY_CLASS,
        overlayMotion?.className,
        overlayNav
          ? (isMobileMenuOpen ? 'pointer-events-auto' : 'pointer-events-none')
          : 'translate-x-0',
        sidebarFullyHidden
          ? 'w-0 overflow-hidden border-0 p-0 opacity-0'
          : navCollapsed
            ? 'w-[var(--admin-shell-sidebar-width-collapsed,81px)]'
            : 'w-[var(--admin-shell-sidebar-width,250px)]',
      )}
      {...(overlayMotion
        ? {
          'data-overlay-kind': overlayMotion['data-overlay-kind'],
          'data-overlay-origin': overlayMotion['data-overlay-origin'],
          'data-overlay-open': overlayMotion['data-overlay-open'],
          'data-overlay-dir': overlayMotion['data-overlay-dir'],
        }
        : {})}
    >
      {!sidebarFullyHidden ? (
        <button
          type="button"
          onClick={() => onSidebarCollapsedChange(!isSidebarCollapsed)}
          className={ADMIN_SHELL_SIDEBAR_COLLAPSE_BUTTON_CLASS}
          aria-label={PAGE_GUIDE_EN['pageGuide.chrome.sidebarCollapse.title']}
          {...pageGuideChromeProps((key) => PAGE_GUIDE_EN[key] ?? key, 'sidebarCollapse', 82)}
        >
          {isSidebarCollapsed ? (
            <ChevronRight className={cn('w-3.5 h-3.5', isRtl && 'rotate-180')} />
          ) : (
            <ChevronLeft className={cn('w-3.5 h-3.5', isRtl && 'rotate-180')} />
          )}
        </button>
      ) : null}

      <AtmosphereBackdrop focus="sidebar-lower" />
      <ShellChromeFinish surface="sidebar" />

      <ShellSidebarColumn
        navCollapsed={navCollapsed}
        isRtl={isRtl}
        onLogoClick={onLogoClick}
        portalMenuInset={
          portalMenuInset ?? (applicationMenuAriaLabel ? (
            <PortalMenu
              isSidebarCollapsed={navCollapsed}
              onNavigate={onNavigate}
              ariaLabel={applicationMenuAriaLabel}
              isRtl={isRtl}
            />
          ) : undefined)
        }
        quickNav={quickNav}
        footer={footer}
        navTree={navTree}
      />
    </aside>
  );
};
