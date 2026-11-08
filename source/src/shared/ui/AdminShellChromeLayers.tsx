import React from 'react';
import { AtmosphereBackdrop } from './AtmosphereBackdrop';
import { isPublishedAdminShellHeaderClassName } from './normalizePublishedAdminShellChrome';
import { ShellChromeFinish } from './ShellChromeFinish';

/** Decorative layers shared by AdminLayout / AppShell and designer-published shells. */
export const AdminShellChromeHeaderLayers: React.FC = () => (
  <>
    <AtmosphereBackdrop focus="header" />
    <ShellChromeFinish surface="header" />
  </>
);

export const AdminShellChromeSidebarLayers: React.FC = () => (
  <>
    <AtmosphereBackdrop focus="sidebar-lower" />
    <ShellChromeFinish surface="sidebar" />
  </>
);

export const AdminShellChromeRootAtmosphere: React.FC = () => (
  <AtmosphereBackdrop className="admin-shell-atmosphere-main" />
);

export function adminShellChromeLayersForClassName(className: string): React.ReactNode | null {
  if (className.includes('admin-shell-header-band') || isPublishedAdminShellHeaderClassName(className)) {
    return <AdminShellChromeHeaderLayers />;
  }
  if (className.includes('designer-shell-sidebar')) {
    return <AdminShellChromeSidebarLayers />;
  }
  if (
    className.includes('shell-atmosphere')
    && className.includes('admin-shell-surface')
    && (className.includes('h-screen') || className.includes('!h-screen'))
  ) {
    return <AdminShellChromeRootAtmosphere />;
  }
  return null;
}
