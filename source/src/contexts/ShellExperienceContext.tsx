import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AppearanceSessionResponse } from '../shared/api/contracts/appearance/shellExperience.schema';
import type { SidebarCollapsePolicy } from '../shared/api/contracts/appearance/shellExperience.schema';
import { ADMIN_SHELL_SIDEBAR_WIDTH_EXPANDED_DEFAULT_PX } from '../shared/ui/adminShellSidebarWidth';

export type ShellExperienceContextValue = {
  mountId: string;
  ready: boolean;
  isAdmin: boolean;
  session: AppearanceSessionResponse | null;
  sidebarCollapsed: boolean;
  sidebarCollapsePolicy: SidebarCollapsePolicy;
  allowUserSidebarPreference: boolean;
  sidebarExpandedWidthPx: number;
  setSidebarCollapsed: (collapsed: boolean) => void;
  applySession: (session: AppearanceSessionResponse) => void;
  navExpandedGroups: Set<string>;
  setNavExpandedGroups: (groups: Set<string>) => void;
};

const ShellExperienceContext = createContext<ShellExperienceContextValue | null>(null);

/** Keep the previous Set reference when contents are unchanged so effects keyed on it do not re-run. */
const reconcileNavExpandedGroups = (current: Set<string>, next: Iterable<string>): Set<string> => {
  const incoming = new Set(next);
  if (incoming.size !== current.size) {
    return incoming;
  }
  for (const group of incoming) {
    if (!current.has(group)) {
      return incoming;
    }
  }
  return current;
};

export function useOptionalShellExperience(): ShellExperienceContextValue | null {
  return useContext(ShellExperienceContext);
}

export function useShellExperience(): ShellExperienceContextValue {
  const value = useOptionalShellExperience();
  if (!value) {
    throw new Error('useShellExperience requires ShellExperienceProvider.');
  }
  return value;
}

export type ShellExperienceProviderProps = {
  mountId: string;
  children: ReactNode;
};

export const ShellExperienceProvider: React.FC<ShellExperienceProviderProps> = ({
  mountId,
  children,
}) => {
  const [session, setSession] = useState<AppearanceSessionResponse | null>(null);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(false);
  const [navExpandedGroups, setNavExpandedGroupsState] = useState<Set<string>>(() => new Set());

  const applySession = useCallback((next: AppearanceSessionResponse) => {
    setSession(next);
    setSidebarCollapsedState(next.effective.sidebarCollapsed);
    setNavExpandedGroupsState((current) =>
      reconcileNavExpandedGroups(current, next.effective.navExpandedGroups));
  }, []);

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setSidebarCollapsedState(collapsed);
  }, []);

  const setNavExpandedGroups = useCallback((groups: Set<string>) => {
    setNavExpandedGroupsState(groups);
  }, []);

  const value = useMemo((): ShellExperienceContextValue => ({
    mountId,
    ready: session !== null,
    isAdmin: session?.isAdmin ?? false,
    session,
    sidebarCollapsed,
    sidebarCollapsePolicy: session?.effective.sidebarCollapsePolicy ?? 'rail',
    allowUserSidebarPreference: session?.effective.allowUserSidebarPreference ?? true,
    sidebarExpandedWidthPx: session?.effective.sidebarExpandedWidthPx
      ?? ADMIN_SHELL_SIDEBAR_WIDTH_EXPANDED_DEFAULT_PX,
    setSidebarCollapsed,
    applySession,
    navExpandedGroups,
    setNavExpandedGroups,
  }), [
    applySession,
    mountId,
    navExpandedGroups,
    session,
    setNavExpandedGroups,
    setSidebarCollapsed,
    sidebarCollapsed,
  ]);

  return (
    <ShellExperienceContext.Provider value={value}>
      {children}
    </ShellExperienceContext.Provider>
  );
};
