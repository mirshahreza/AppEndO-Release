import { createContext, useContext } from 'react';

import type { AppShellHeaderModule } from '../../layouts/appShell/AppShellHeader';

export type ShellChromeContextValue = {
  isSidebarCollapsed: boolean;
  isRtl: boolean;
  isMobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  isAiPanelOpen: boolean;
  setAiPanelOpen: (open: boolean) => void;
  openProfile: () => void;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  tShell: (key: string) => string;
  currentModule: AppShellHeaderModule;
  displayName: string;
  avatarXs?: string | null;
  avatarInitial: string;
  primaryRole: string;
  pageKey?: string | null;
  onLogoClick: () => void;
  onNavigate: (path: string) => void;
  applicationMenuAriaLabel: string;
  setSidebarCollapsed: (collapsed: boolean) => void;
};

/** Isolated context module — keeps slot chunks on the same context instance as the provider. */
export const ShellChromeContext = createContext<ShellChromeContextValue | null>(null);

export function useOptionalPublishedShellChromeContext(): ShellChromeContextValue | null {
  return useContext(ShellChromeContext);
}

export function usePublishedShellChromeContext(): ShellChromeContextValue {
  const value = useOptionalPublishedShellChromeContext();
  if (!value) {
    throw new Error('Shell chrome slot rendered outside DesignerPublishedShellChromeProvider.');
  }
  return value;
}

export function useDesignerPublishedShellSidebarCollapsed(): boolean {
  return useContext(ShellChromeContext)?.isSidebarCollapsed ?? false;
}

export function useDesignerPublishedShellMobileMenuOpen(): boolean {
  return useContext(ShellChromeContext)?.isMobileMenuOpen ?? false;
}

export function useDesignerPublishedShellMobileMenuState(): readonly [
  boolean,
  (open: boolean) => void,
] {
  const context = useContext(ShellChromeContext);
  return [context?.isMobileMenuOpen ?? false, context?.setMobileMenuOpen ?? (() => undefined)] as const;
}

export function useDesignerPublishedShellDirection(): 'ltr' | 'rtl' {
  return useContext(ShellChromeContext)?.isRtl ? 'rtl' : 'ltr';
}