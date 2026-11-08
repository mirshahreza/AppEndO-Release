import React from 'react';
import { ShellMobileDrawerNavigation } from '../../../shared/ui/shell-navigation';
import { isAdminShellNavItemActive } from '../buildAdminShellNav';
import type { NavRendererProps } from './navRendererTypes';

export const TopDrawerNav: React.FC<NavRendererProps> = ({
  groups,
  pathname,
  onNavigate,
}) => (
  <div className="px-[16px] pt-[35px]" data-nav-renderer="top-drawer">
    <ShellMobileDrawerNavigation
      groups={groups}
      currentPath={pathname}
      isItemActive={(item) => isAdminShellNavItemActive(groups, item, pathname)}
      onNavigate={(path) => onNavigate(path)}
      ariaLabel="Drawer navigation"
      defaultExpandedGroups={groups.flatMap((group) => group.heading ? [group.heading] : [])}
    />
  </div>
);
