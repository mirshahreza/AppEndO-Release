import React, { type ComponentType } from 'react';

import type { AdminShellNavGroup } from './types';

import type { NavRendererProps } from './nav/navRendererTypes';
import type { SidebarCollapsePolicy } from '../../shared/api/contracts/appearance/shellExperience.schema';

import { ShellSidebarAside } from './ShellSidebarAside';



export type AdminShellSidebarProps = {

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

  quickNav?: React.ReactNode;

  footer?: React.ReactNode;

};



export const AdminShellSidebar: React.FC<AdminShellSidebarProps> = (props) => (

  <ShellSidebarAside {...props} />

);

