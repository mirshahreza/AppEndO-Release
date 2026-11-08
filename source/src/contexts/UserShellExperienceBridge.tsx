import { useEffect, useRef } from 'react';
import type { AppearanceSessionResponse } from '../shared/api/contracts/appearance/shellExperience.schema';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useShellExperience } from './ShellExperienceContext';
import { useAppearanceSession, saveUserShellExperience } from '../shared/api/queries/appearance';
import {
  persistExpandedNavGroups,
  persistSidebarCollapsed,
  readStoredExpandedNavGroups,
  readStoredSidebarCollapsed,
} from '../shared/ui/adminLayoutPreferences';
import { isLoginPath } from '../shared/theme/accentThemePreference';
import {
  ADMIN_SHELL_SIDEBAR_WIDTH_EXPANDED_DEFAULT_PX,
  applyAdminShellSidebarWidthCssVariables,
} from '../shared/ui/adminShellSidebarWidth';

const PERSIST_DEBOUNCE_MS = 450;

/**
 * Loads appearance session after login and persists sidebar / nav-group overrides.
 */
export const UserShellExperienceBridge = () => {
  const { pathname } = useLocation();
  const { isAuthenticated, currentUser } = useAuth();
  const {
    mountId,
    applySession,
    sidebarCollapsed,
    navExpandedGroups,
    allowUserSidebarPreference,
    sidebarExpandedWidthPx,
  } = useShellExperience();

  const sessionQuery = useAppearanceSession(
    mountId,
    isAuthenticated && !isLoginPath(pathname),
  );

  const skipNextPersistRef = useRef(false);
  const persistTimerRef = useRef<number | null>(null);
  const hydratedUserIdRef = useRef<number | null>(null);
  const appliedSessionRef = useRef<AppearanceSessionResponse | null>(null);

  useEffect(() => {
    if (isLoginPath(pathname)) {
      hydratedUserIdRef.current = null;
      appliedSessionRef.current = null;
    }
  }, [pathname]);

  useEffect(() => {
    if (isLoginPath(pathname) || !isAuthenticated || !currentUser) {
      return;
    }

    if (sessionQuery.data) {
      if (appliedSessionRef.current === sessionQuery.data) {
        return;
      }
      appliedSessionRef.current = sessionQuery.data;
      skipNextPersistRef.current = hydratedUserIdRef.current !== currentUser.id;
      applySession(sessionQuery.data);
      persistSidebarCollapsed(sessionQuery.data.effective.sidebarCollapsed);
      persistExpandedNavGroups(new Set(sessionQuery.data.effective.navExpandedGroups));
      hydratedUserIdRef.current = currentUser.id;
      return;
    }

    if (sessionQuery.isError && hydratedUserIdRef.current !== currentUser.id) {
      const fallbackCollapsed = readStoredSidebarCollapsed() ?? false;
      const fallbackGroups = readStoredExpandedNavGroups() ?? new Set<string>();
      skipNextPersistRef.current = true;
      appliedSessionRef.current = null;
      applySession({
        success: true,
        mountId,
        portalDefaults: {
          version: 1,
          sidebarDefaultCollapsed: false,
          sidebarCollapsePolicy: 'rail',
          allowUserSidebarPreference: true,
          sidebarExpandedWidthPx: ADMIN_SHELL_SIDEBAR_WIDTH_EXPANDED_DEFAULT_PX,
          layoutWidth: 'fluid',
          layoutWidthUserControl: true,
        },
        userExperience: null,
        effective: {
          sidebarCollapsed: fallbackCollapsed,
          sidebarCollapsePolicy: 'rail',
          allowUserSidebarPreference: true,
          sidebarExpandedWidthPx: ADMIN_SHELL_SIDEBAR_WIDTH_EXPANDED_DEFAULT_PX,
          layoutWidth: 'fluid',
          layoutWidthUserControl: true,
          navExpandedGroups: [...fallbackGroups],
        },
        isAdmin: false,
      });
      hydratedUserIdRef.current = currentUser.id;
    }
  }, [
    applySession,
    currentUser,
    isAuthenticated,
    mountId,
    pathname,
    sessionQuery.data,
    sessionQuery.isError,
  ]);

  useEffect(() => {
    applyAdminShellSidebarWidthCssVariables(sidebarExpandedWidthPx);
  }, [sidebarExpandedWidthPx]);

  useEffect(() => {
    if (!isAuthenticated || !currentUser || !allowUserSidebarPreference) {
      return undefined;
    }

    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      persistSidebarCollapsed(sidebarCollapsed);
      persistExpandedNavGroups(navExpandedGroups);
      return undefined;
    }

    persistSidebarCollapsed(sidebarCollapsed);
    persistExpandedNavGroups(navExpandedGroups);

    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
    }

    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      void saveUserShellExperience({
        version: 1,
        sidebarCollapsed,
        navExpandedGroups: [...navExpandedGroups],
      }).catch(() => undefined);
    }, PERSIST_DEBOUNCE_MS);

    return () => {
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [
    allowUserSidebarPreference,
    currentUser,
    isAuthenticated,
    navExpandedGroups,
    sidebarCollapsed,
  ]);

  return null;
};
