import * as React from 'react';
import { StudioAdminShellLayoutWidthProvider } from './studioAdminShellLayoutWidth';

export type AdminChromeLayoutWidthHostProps = {
  portal: { portalSegment?: string; shellKey?: string } | null | undefined;
  children: React.ReactNode;
};

/** Wraps studio admin chrome (`AdminLayout` / `AppShell`) with layout-width context + bounded canvas. */
export const AdminChromeLayoutWidthHost: React.FC<AdminChromeLayoutWidthHostProps> = ({
  portal,
  children,
}) => (
  <StudioAdminShellLayoutWidthProvider portal={portal}>
    {children}
  </StudioAdminShellLayoutWidthProvider>
);
