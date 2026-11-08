import React, { useCallback, useMemo, useState } from 'react';
import { cn } from '../../lib/utils';
import {
  PLATFORM_NAV_MEGA_MENU,
  PLATFORM_NAV_TOP_DRAWER,
  PLATFORM_NAV_TREE_TWO_LEVEL,
  type PlatformNavComponentId,
} from '../api/contracts/platform/platformNavigationComponents';
import type { AdminShellNavGroup } from '../../layouts/adminShell/types';
import { MegaMenu } from '../../layouts/adminShell/nav/MegaMenu';
import { TopDrawerNav } from '../../layouts/adminShell/nav/TopDrawerNav';
import { TreeNavTwoLevel } from '../../layouts/adminShell/nav/TreeNavTwoLevel';
import type { NavRendererProps } from '../../layouts/adminShell/nav/navRendererTypes';

export type SidebarMenuVariant = 'tree' | 'mega' | 'drawer';

export type SidebarMenuProps = {
  variant?: SidebarMenuVariant;
  groups: AdminShellNavGroup[];
  pathname: string;
  collapsed?: boolean;
  isRtl?: boolean;
  expandedGroups?: Set<string>;
  onExpandedGroupsChange?: (groups: Set<string>) => void;
  onNavigate: (path: string) => void;
  isExperienceMount?: boolean;
  /** Tree variant only — one manually expanded group at a time. */
  accordion?: boolean;
  /** Tree variant only — when true (default), the group with the active route cannot collapse. */
  lockActiveGroup?: boolean;
  /** Tree variant only — fill parent height; expanded group bodies scroll independently. */
  fillHeight?: boolean;
  /** When false, leading groups without a heading are omitted. */
  ungroupedAtStart?: boolean;
  /** When false, trailing groups without a heading are omitted. */
  ungroupedAtEnd?: boolean;
  /** Vertical gap between navigation groups in pixels (0–30). Tree variant only. */
  groupGapPx?: number;
  /** Tree variant only — keep at least one headed group expanded (default false). */
  requireOpenGroup?: boolean;
  className?: string;
};

const SIDEBAR_MENU_RENDERERS: Record<SidebarMenuVariant, React.FC<NavRendererProps>> = {
  tree: TreeNavTwoLevel,
  mega: MegaMenu,
  drawer: TopDrawerNav,
};

export function resolveSidebarMenuVariant(
  componentKey: string,
): SidebarMenuVariant | null {
  const normalized = componentKey.trim();
  switch (normalized) {
    case PLATFORM_NAV_TREE_TWO_LEVEL:
      return 'tree';
    case PLATFORM_NAV_MEGA_MENU:
      return 'mega';
    case PLATFORM_NAV_TOP_DRAWER:
      return 'drawer';
    default:
      return null;
  }
}

export function isSidebarMenuComponentKey(
  componentKey: string,
): componentKey is PlatformNavComponentId {
  return resolveSidebarMenuVariant(componentKey) !== null;
}

export function isUngroupedNavGroup(group: AdminShellNavGroup): boolean {
  return !group.heading?.trim();
}

export function clampSidebarMenuGroupGap(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(30, Math.round(value)));
}

export function filterSidebarMenuGroups(
  groups: AdminShellNavGroup[],
  options: { ungroupedAtStart?: boolean; ungroupedAtEnd?: boolean } = {},
): AdminShellNavGroup[] {
  const { ungroupedAtStart = true, ungroupedAtEnd = true } = options;
  let result = groups;

  if (!ungroupedAtStart) {
    let start = 0;
    while (start < result.length && isUngroupedNavGroup(result[start]!)) {
      start += 1;
    }
    if (start > 0) {
      result = result.slice(start);
    }
  }

  if (!ungroupedAtEnd) {
    let end = result.length;
    while (end > 0 && isUngroupedNavGroup(result[end - 1]!)) {
      end -= 1;
    }
    if (end < result.length) {
      result = result.slice(0, end);
    }
  }

  return result;
}

/**
 * Sidebar navigation menu — tree (default), mega, or drawer renderer variants.
 * Pair with platform navigation manifests via `PlatformNavigationHost`, or pass groups directly in previews.
 */
export const SidebarMenu: React.FC<SidebarMenuProps> = ({
  variant = 'tree',
  groups,
  pathname,
  collapsed = false,
  isRtl = false,
  expandedGroups,
  onExpandedGroupsChange,
  onNavigate,
  isExperienceMount = false,
  accordion = false,
  lockActiveGroup = true,
  fillHeight = false,
  ungroupedAtStart = true,
  ungroupedAtEnd = true,
  groupGapPx = 0,
  requireOpenGroup = false,
  className,
}) => {
  const resolvedGroupGapPx = clampSidebarMenuGroupGap(groupGapPx);
  const [internalExpandedGroups, setInternalExpandedGroups] = useState<Set<string>>(() => new Set());
  const resolvedExpandedGroups = expandedGroups ?? internalExpandedGroups;
  const resolvedOnExpandedGroupsChange = useCallback((next: Set<string>) => {
    if (onExpandedGroupsChange) {
      onExpandedGroupsChange(next);
      return;
    }
    setInternalExpandedGroups(next);
  }, [onExpandedGroupsChange]);

  const visibleGroups = useMemo(
    () => filterSidebarMenuGroups(groups, { ungroupedAtStart, ungroupedAtEnd }),
    [groups, ungroupedAtEnd, ungroupedAtStart],
  );

  const NavRenderer = SIDEBAR_MENU_RENDERERS[variant];

  if (visibleGroups.length === 0) {
    return (
      <div
        className={cn('min-h-[48px] w-full', className)}
        data-sidebar-menu-variant={variant}
        data-nav-empty="true"
      />
    );
  }

  return (
    <div
      className={cn(
        'min-h-0 w-full',
        fillHeight && 'flex min-h-0 flex-1 flex-col',
        className,
      )}
      data-sidebar-menu-variant={variant}
      data-sidebar-menu-fill-height={fillHeight ? 'true' : undefined}
    >
      <div className={fillHeight ? 'flex min-h-0 flex-1 flex-col' : undefined}>
        <NavRenderer
          groups={visibleGroups}
          pathname={pathname}
          isSidebarCollapsed={collapsed}
          isRtl={isRtl}
          expandedGroups={resolvedExpandedGroups}
          onExpandedGroupsChange={resolvedOnExpandedGroupsChange}
          onNavigate={onNavigate}
          isExperienceMount={isExperienceMount}
          accordion={accordion}
          lockActiveGroup={lockActiveGroup}
          fillHeight={fillHeight}
          groupGapPx={resolvedGroupGapPx}
          requireOpenGroup={requireOpenGroup}
        />
      </div>
    </div>
  );
};
