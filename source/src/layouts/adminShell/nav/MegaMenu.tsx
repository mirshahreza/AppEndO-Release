import React from 'react';
import { ShellSidebarMegaNavigation } from '../../../shared/ui/shell-navigation';
import { isAdminShellNavItemActive } from '../buildAdminShellNav';
import type { NavRendererProps } from './navRendererTypes';

export const MegaMenu: React.FC<NavRendererProps> = ({
  groups,
  pathname,
  onNavigate,
}) => {
  return (
    <div className="px-[16px] pt-[35px]" data-nav-renderer="mega-menu">
      <ShellSidebarMegaNavigation
        groups={groups}
        currentPath={pathname}
        isItemActive={(item) => isAdminShellNavItemActive(groups, item, pathname)}
        onNavigate={(path) => onNavigate(path)}
        ariaLabel="Mega navigation"
      />
    </div>
  );
};
