import React, { type ComponentType } from 'react';

import type { AdminShellNavGroup } from '../adminShell/types';

import type { NavRendererProps } from '../adminShell/nav/navRendererTypes';

import { ShellSidebarAside, type ShellSidebarAsideProps } from '../adminShell/ShellSidebarAside';



export type AppShellSidebarProps = Omit<ShellSidebarAsideProps, 'applicationMenuAriaLabel'> & {

  applicationMenuAriaLabel: string;

};



export const AppShellSidebar: React.FC<AppShellSidebarProps> = (props) => (

  <ShellSidebarAside {...props} />

);

