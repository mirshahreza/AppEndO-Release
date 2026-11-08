import { useEffect, useRef } from 'react';
import { DASHBOARD_LAYOUT_CONTEXT_KEY } from '../shared/api/contracts/attributes/builtInAttributes';
import {
  HOME_SHORTCUT_FALLBACK_EVENT,
  mergeDashboardHomeShortcut,
  type DashboardHomeShortcut,
} from '../shared/lib/dashboardHomeShortcuts';
import {
  parseDashboardLayout,
  type DashboardLayoutPreference,
} from '../shared/lib/userDashboardLayout';
import { persistUserDashboardLayout, rememberUserDashboardLayout } from '../shared/lib/userDashboardLayoutPersistence';
import { useAuth } from './AuthContext';
import { useClientContext } from './ClientContextContext';

const emptyLayout = (): DashboardLayoutPreference => ({
  layoutMode: 'masonry',
  widgetOrder: [],
  hiddenWidgets: [],
  widgetSizes: {},
  widgetChrome: {},
  homeShortcuts: [],
});

export const useHomeShortcutFallback = (): void => {
  const { isAuthenticated, currentUser } = useAuth();
  const { clientContext, patchClientContext } = useClientContext();
  const clientContextRef = useRef(clientContext);
  const pendingLayoutRef = useRef<DashboardLayoutPreference | null>(null);
  clientContextRef.current = clientContext;

  useEffect(() => {
    if (!isAuthenticated) {
      pendingLayoutRef.current = null;
      return;
    }

    const handleFallback = (event: Event) => {
      const shortcut = (event as CustomEvent<DashboardHomeShortcut>).detail;
      if (!shortcut) {
        return;
      }

      const current = pendingLayoutRef.current
        ?? parseDashboardLayout(clientContextRef.current[DASHBOARD_LAYOUT_CONTEXT_KEY])
        ?? emptyLayout();
      const next: DashboardLayoutPreference = {
        ...current,
        homeShortcuts: mergeDashboardHomeShortcut(current.homeShortcuts ?? [], shortcut),
        hiddenWidgets: current.hiddenWidgets.filter((id) => id !== 'my-shortcuts'),
      };
      pendingLayoutRef.current = next;
      if (currentUser?.id) {
        rememberUserDashboardLayout(currentUser.id, next, true);
      }
      patchClientContext({ [DASHBOARD_LAYOUT_CONTEXT_KEY]: next });
      void persistUserDashboardLayout(next, { userId: currentUser?.id });
    };

    window.addEventListener(HOME_SHORTCUT_FALLBACK_EVENT, handleFallback);
    return () => window.removeEventListener(HOME_SHORTCUT_FALLBACK_EVENT, handleFallback);
  }, [currentUser?.id, isAuthenticated, patchClientContext]);
};
