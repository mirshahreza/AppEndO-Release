import React, { useMemo } from 'react';
import { cn } from '../../../lib/utils';
import {
  PLATFORM_NAV_FLAT_LINKS,
  PLATFORM_NAV_TOP_BAR,
  type PlatformNavComponentId,
} from '../../../shared/api/contracts/platform/platformNavigationComponents';
import { SidebarMenu, isSidebarMenuComponentKey, resolveSidebarMenuVariant } from '../../../shared/ui/SidebarMenu';
import { SidebarMenuScrollArea } from '../../../shared/ui/SidebarMenuScrollArea';
import { partitionSidebarQuickNavItems } from '../../../shared/lib/navTreeFilter';
import { FlatLinks } from './FlatLinks';
import { TopBarNav } from './TopBarNav';
import { TreeNavTwoLevel } from './TreeNavTwoLevel';
import {
  SHELL_NAVIGATION_COMPONENT_KEY_PROP,
  SHELL_NAVIGATION_REF_PROP,
} from '../../../shared/lib/shellNavigationProps';
import { ShellChromeUtilityNav } from './ShellChromeUtilityNav';
import { useShellNavigationHost } from './useShellNavigationHost';
import { isOverlayNavTier } from '../../../shared/lib/viewportTokens';
import { useViewportTier } from '../../../shared/lib/useViewportTier';

export { SHELL_NAVIGATION_COMPONENT_KEY_PROP, SHELL_NAVIGATION_REF_PROP };

export type PlatformNavigationHostProps = {
  navigationRef?: string | null;
  componentKey: PlatformNavComponentId | string;
  className?: string;
};

const PLATFORM_NAV_COMPONENTS = {
  [PLATFORM_NAV_TOP_BAR]: TopBarNav,
  [PLATFORM_NAV_FLAT_LINKS]: FlatLinks,
} as const;

function renderSidebarTopShortcutStrip(input: {
  topItems: ReturnType<typeof partitionSidebarQuickNavItems>['sidebarTopItems'];
  host: ReturnType<typeof useShellNavigationHost>;
  sidebarCollapsedRail: boolean;
}): React.ReactNode {
  const { topItems, host, sidebarCollapsedRail } = input;
  if (topItems.length === 0) {
    return null;
  }

  return (
    <ShellChromeUtilityNav
      items={topItems}
      navGroups={host.navGroups}
      pathname={host.pathname}
      onNavigate={host.onNavigate}
      placement="sidebar-top"
      isSidebarCollapsed={sidebarCollapsedRail}
      isRtl={host.isRtl}
    />
  );
}

export const PlatformNavigationHost: React.FC<PlatformNavigationHostProps> = ({
  navigationRef,
  componentKey,
  className,
}) => {
  const host = useShellNavigationHost({ navigationRef, componentKey });
  const viewportTier = useViewportTier();
  const overlayNav = isOverlayNavTier(viewportTier);
  const sidebarCollapsedRail = host.isSidebarCollapsed && !overlayNav;
  const normalizedKey = componentKey.trim();
  const sidebarVariant = resolveSidebarMenuVariant(normalizedKey);
  const { sidebarTopItems, sidebarFooterItems } = useMemo(
    () => partitionSidebarQuickNavItems(host.quickNavItems),
    [host.quickNavItems],
  );
  const NavComponent = useMemo(() => {
    if (sidebarVariant) {
      return null;
    }
    const key = normalizedKey as PlatformNavComponentId;
    return PLATFORM_NAV_COMPONENTS[key as keyof typeof PLATFORM_NAV_COMPONENTS] ?? TreeNavTwoLevel;
  }, [normalizedKey, sidebarVariant]);

  const showTopRegionStrip = host.region === 'top' && sidebarTopItems.length > 0;
  const showFooterRegionStrip = host.region === 'footer' && sidebarFooterItems.length > 0;
  const hasSideShortcutContent = host.region === 'side'
    && (sidebarTopItems.length > 0 || sidebarFooterItems.length > 0);

  if (
    !host.mount
    || (
      !showTopRegionStrip
      && !showFooterRegionStrip
      && !hasSideShortcutContent
      && host.filteredGroups.length === 0
    )
  ) {
    return (
      <div
        className={className}
        data-platform-nav-component={componentKey}
        data-nav-empty="true"
      />
    );
  }

  if (showTopRegionStrip) {
    return (
      <div
        className={cn('shrink-0', className)}
        data-platform-nav-component={componentKey}
        data-navigation-ref={host.navigationRef ?? undefined}
      >
        <ShellChromeUtilityNav
          items={sidebarTopItems}
          navGroups={host.navGroups}
          pathname={host.pathname}
          onNavigate={host.onNavigate}
          placement="sidebar-top"
          isSidebarCollapsed={sidebarCollapsedRail}
          isRtl={host.isRtl}
        />
      </div>
    );
  }

  if (showFooterRegionStrip) {
    return (
      <div
        className={cn('mt-auto shrink-0', className)}
        data-platform-nav-component={componentKey}
        data-navigation-ref={host.navigationRef ?? undefined}
      >
        <ShellChromeUtilityNav
          items={sidebarFooterItems}
          navGroups={host.navGroups}
          pathname={host.pathname}
          onNavigate={host.onNavigate}
          placement="sidebar-footer"
          isSidebarCollapsed={sidebarCollapsedRail}
          isRtl={host.isRtl}
        />
      </div>
    );
  }

  const isSideNav = host.region === 'side';
  const omitLeadingUngrouped = isSideNav && host.quickNavItems.length > 0;
  const useSidebarFillHeight = isSideNav && !sidebarCollapsedRail;

  const sidebarShortcutStrip = renderSidebarTopShortcutStrip({
    topItems: sidebarTopItems,
    host,
    sidebarCollapsedRail,
  });

  const navTreeProps = {
    groups: host.filteredGroups,
    pathname: host.pathname,
    isSidebarCollapsed: sidebarCollapsedRail,
    isRtl: host.isRtl,
    expandedGroups: host.expandedGroups,
    onExpandedGroupsChange: host.setExpandedGroups,
    onNavigate: host.onNavigate,
    isExperienceMount: host.isExperienceMount,
    accordion: isSideNav,
    lockActiveGroup: false as const,
    fillHeight: useSidebarFillHeight,
    requireOpenGroup: isSideNav,
  };

  if (sidebarVariant && isSidebarMenuComponentKey(normalizedKey)) {
    const sidebarMenu = (
      <SidebarMenu
        variant={sidebarVariant}
        {...navTreeProps}
        collapsed={sidebarCollapsedRail}
        ungroupedAtStart={!omitLeadingUngrouped}
        className={useSidebarFillHeight ? 'min-h-0 flex-1' : undefined}
      />
    );

    return (
      <div
        className={cn('flex h-full min-h-0 flex-1 flex-col overflow-hidden', className)}
        data-platform-nav-component={componentKey}
        data-navigation-ref={host.navigationRef ?? undefined}
      >
        {sidebarShortcutStrip}
        {useSidebarFillHeight ? sidebarMenu : (
          <SidebarMenuScrollArea
            className="min-h-0 flex-1"
            dir={host.isRtl ? 'rtl' : 'ltr'}
            aria-label="Navigation"
          >
            {sidebarMenu}
          </SidebarMenuScrollArea>
        )}
        {sidebarFooterItems.length > 0 ? (
          <div className="mt-auto shrink-0">
            <ShellChromeUtilityNav
              items={sidebarFooterItems}
              navGroups={host.navGroups}
              pathname={host.pathname}
              onNavigate={host.onNavigate}
              placement="sidebar-footer"
              isSidebarCollapsed={sidebarCollapsedRail}
              isRtl={host.isRtl}
            />
          </div>
        ) : null}
      </div>
    );
  }

  if (!NavComponent) {
    return (
      <div
        className={className}
        data-platform-nav-component={componentKey}
        data-nav-empty="true"
      />
    );
  }

  return (
    <div
      className={cn(
        isSideNav && 'flex h-full min-h-0 flex-1 flex-col overflow-hidden',
        className,
      )}
      data-platform-nav-component={componentKey}
      data-navigation-ref={host.navigationRef ?? undefined}
    >
      {sidebarShortcutStrip}
      <div className="flex h-full min-h-0 w-full flex-1 flex-col">
        <NavComponent {...navTreeProps} />
      </div>
      {isSideNav && sidebarFooterItems.length > 0 ? (
        <div className="mt-auto shrink-0">
          <ShellChromeUtilityNav
            items={sidebarFooterItems}
            navGroups={host.navGroups}
            pathname={host.pathname}
            onNavigate={host.onNavigate}
            placement="sidebar-footer"
            isSidebarCollapsed={sidebarCollapsedRail}
            isRtl={host.isRtl}
          />
        </div>
      ) : null}
    </div>
  );
};
