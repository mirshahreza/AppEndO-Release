import React from 'react';
import { cn } from '../../../lib/utils';
import { NavigationIcon } from '../../../shared/lib/navigationIcons/NavigationIcon';
import { pageGuideNavItemProps } from '../../../shared/ui/shell/pageGuide/pageGuideChrome';
import {
  buildSideHintContent,
  resolveHeaderHintFallbackTone,
  resolveSideHintTitleTone,
  SideHintTooltip,
} from '../../../shared/ui/SideHintTooltip';
import { isDashboardHomePageKey, writeNavHomeShortcutDrag } from '../../../shared/lib/dashboardHomeShortcuts';
import { useDashboardDesignMode } from '../../../shared/lib/useDashboardDesignMode';
import { isAdminShellNavItemActive } from '../buildAdminShellNav';
import type { AdminShellNavGroup, AdminShellNavItem } from '../types';
import { NavItemLink } from './NavItemLink';
import { ADMIN_SHELL_HEADER_ICON_BUTTON_CLASS } from '../../../shared/ui/surfaceClasses';

export type ShellChromeUtilityNavPlacement = 'sidebar-footer' | 'sidebar-top' | 'header';

export type ShellChromeUtilityNavProps = {
  items: AdminShellNavItem[];
  navGroups: AdminShellNavGroup[];
  pathname: string;
  onNavigate: (path: string) => void;
  placement: ShellChromeUtilityNavPlacement;
  isSidebarCollapsed?: boolean;
  isRtl?: boolean;
};

const HEADER_BUTTON_CLASS = ADMIN_SHELL_HEADER_ICON_BUTTON_CLASS;
const STRIP_BUTTON_CLASS = 'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors';
const TOP_STRIP_BUTTON_CLASS = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors [&_svg]:h-5 [&_svg]:w-5';
const FOOTER_COLLAPSED_BUTTON_CLASS = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors';
const TOP_COLLAPSED_BUTTON_CLASS = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors [&_svg]:h-5 [&_svg]:w-5';
const TOP_STRIP_ICON_CLASS = 'h-5 w-5 shrink-0';

export const ShellChromeUtilityNav: React.FC<ShellChromeUtilityNavProps> = ({
  items,
  navGroups,
  pathname,
  onNavigate,
  placement,
  isSidebarCollapsed = false,
  isRtl = false,
}) => {
  const isDesigning = useDashboardDesignMode();
  const navigableItems = items.filter((item) => item.type !== 'separator' && Boolean(item.path));
  const isFooter = placement === 'sidebar-footer';
  const isTop = placement === 'sidebar-top';
  const isHeader = placement === 'header';
  const isSidebarStrip = isFooter || isTop;
  if (navigableItems.length === 0) {
    return null;
  }

  const collapsedButtonClass = isTop ? TOP_COLLAPSED_BUTTON_CLASS : FOOTER_COLLAPSED_BUTTON_CLASS;
  const stripButtonClass = isSidebarCollapsed && isSidebarStrip
    ? collapsedButtonClass
    : isTop
      ? TOP_STRIP_BUTTON_CLASS
      : isSidebarStrip
        ? STRIP_BUTTON_CLASS
        : HEADER_BUTTON_CLASS;
  const stripIconClass = isTop
    ? TOP_STRIP_ICON_CLASS
    : isSidebarCollapsed && isSidebarStrip
      ? 'h-5 w-5'
      : isSidebarStrip
        ? 'h-4 w-4'
        : 'h-5 w-5';
  const wrapHint = (content: React.ReactNode, child: React.ReactNode) => (
    <SideHintTooltip
      content={content}
      isRtl={isRtl}
      placement={isTop ? 'top' : isFooter ? undefined : 'bottom'}
      className="inline-flex shrink-0"
    >
      {child}
    </SideHintTooltip>
  );

  const buttons = navigableItems.map((item, index) => {
    const isActive = isAdminShellNavItemActive(navGroups, item, pathname);
    const label = item.label?.trim() || 'Navigation';
    const tone = resolveSideHintTitleTone(item.iconColor, resolveHeaderHintFallbackTone(index));

    const canPinToHome = Boolean(item.path) && !isDashboardHomePageKey(item.pageKey);
    const canDragToHome = canPinToHome && isDesigning;
    return (
      <React.Fragment key={`${item.pageKey ?? item.path ?? item.label}-${index}`}>
        {wrapHint(
          buildSideHintContent(label, item.description, tone),
          <NavItemLink
            path={item.path!}
            onNavigate={onNavigate}
            draggable={canDragToHome}
            onDragStart={(event) => {
              if (!canDragToHome || !item.path) {
                event.preventDefault();
                return;
              }
              const wrote = writeNavHomeShortcutDrag(event.dataTransfer, {
                pageKey: item.pageKey,
                path: item.path,
                label: item.label,
                icon: item.icon,
              });
              if (!wrote) {
                event.preventDefault();
              }
            }}
            className={cn(
              stripButtonClass,
              canDragToHome ? 'admin-nav-item-drag' : 'cursor-pointer',
              isActive
                ? 'bg-primary-subtle/55 text-primary-700 [&_svg]:stroke-[2.25]'
                : isHeader
                  ? 'text-primary-700 hover:bg-primary-subtle/45'
                  : 'text-slate-400 hover:bg-primary-subtle/45 hover:text-primary-700',
            )}
            {...pageGuideNavItemProps(label, item.description, 88, item.pageKey)}
            aria-current={isActive ? 'page' : undefined}
          >
            <NavigationIcon
              iconRef={item.icon}
              className={cn(
                stripIconClass,
                isActive
                  ? 'text-primary-700'
                  : item.iconColor || (isHeader ? 'text-inherit' : 'text-slate-400'),
              )}
            />
            <span className="sr-only">{label}</span>
          </NavItemLink>,
        )}
      </React.Fragment>
    );
  });

  if (isTop) {
    return (
      <nav
        aria-label="Sidebar shortcuts"
        data-shell-nav="sidebar-top"
        className={cn(
          'shrink-0 pb-2',
          isSidebarCollapsed ? 'px-1 pt-1' : 'px-[16px] pt-0',
        )}
      >
        <div
          className={cn(
            'flex items-center justify-center',
            isSidebarCollapsed ? 'flex-wrap gap-1' : 'flex-nowrap gap-1.5',
          )}
        >
          {buttons}
        </div>
      </nav>
    );
  }

  if (isFooter) {
    return (
      <nav
        aria-label="Sidebar footer"
        data-shell-nav="sidebar-footer"
        className={cn(
          'shrink-0 pt-2 pb-6',
          isSidebarCollapsed ? 'px-1' : 'px-[16px]',
        )}
      >
        <div
          className={cn(
            'flex items-center justify-center',
            isSidebarCollapsed ? 'flex-col gap-2' : 'flex-wrap gap-2',
          )}
        >
          {buttons}
        </div>
      </nav>
    );
  }

  return (
    <nav
      aria-label="Header utilities"
      data-shell-nav="header"
      className="flex items-center gap-1"
    >
      {buttons}
    </nav>
  );
};
