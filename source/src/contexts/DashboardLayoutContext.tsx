import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import { useAuth } from './AuthContext';
import { useClientContext } from './ClientContextContext';
import { DASHBOARD_LAYOUT_CONTEXT_KEY } from '../shared/api/contracts/attributes/builtInAttributes';
import {
  buildDefaultDashboardWidgetOrder,
} from '../features/dashboard/dashboardLayout';
import { resolveDashboardSpanUnits } from '../features/dashboard/dashboardWidgetLayoutSpan';
import {
  mergeDashboardHomeShortcut,
  registerHomeShortcutAdder,
  setDashboardDesignMode,
  type DashboardHomeShortcut,
} from '../shared/lib/dashboardHomeShortcuts';
import type { HomeWidgetRegistryEntry } from '../shared/api/contracts/home-widgets';
import { useHomeWidgetRegistry } from '../features/dashboard/useHomeWidgetRegistry';
import { resolveHomeWidgetRegistryEntry } from '../features/dashboard/homeWidgetRegistry';
import {
  clampDashboardWidgetStart,
  mergeDashboardWidgetOrder,
  parseDashboardLayout,
  resolveVisibleDashboardWidgets,
  type DashboardLayoutBlockId,
  compactDashboardWidgetChrome,
  type DashboardLayoutPreference,
  type DashboardWidgetChrome,
  type DashboardWidgetChromes,
  type DashboardWidgetId,
  type DashboardWidgetSize,
  type DashboardWidgetSizes,
} from '../shared/lib/userDashboardLayout';
import {
  fetchUserDashboardLayout,
  isUserDashboardLayoutDirty,
  persistUserDashboardLayout,
  recallUserDashboardLayout,
  rememberUserDashboardLayout,
} from '../shared/lib/userDashboardLayoutPersistence';

const PERSIST_DEBOUNCE_MS = 450;
const PERSIST_RETRY_MS = 700;
const PERSIST_MAX_ATTEMPTS = 3;
const DASHBOARD_LAYOUT_REACT_CONTEXT_KEY = '__APPENDO_DASHBOARD_LAYOUT_REACT_CONTEXT__';

type DashboardLayoutContextValue = {
  homeWidgetRegistry: HomeWidgetRegistryEntry[];
  availableWidgets: DashboardWidgetId[];
  widgetOrder: DashboardWidgetId[];
  hiddenWidgets: DashboardWidgetId[];
  widgetSizes: DashboardWidgetSizes;
  widgetChrome: DashboardWidgetChromes;
  homeShortcuts: DashboardHomeShortcut[];
  reorderWidgets: (activeId: DashboardWidgetId, overId: DashboardWidgetId) => void;
  setWidgetOrder: (order: DashboardWidgetId[]) => void;
  setWidgetSize: (widgetId: DashboardWidgetId, size: DashboardWidgetSize) => void;
  setWidgetChrome: (widgetId: DashboardWidgetId, chrome: DashboardWidgetChrome) => void;
  placeWidgets: (order: DashboardWidgetId[], sizes: DashboardWidgetSizes) => void;
  hideWidget: (widgetId: DashboardWidgetId) => void;
  showWidget: (widgetId: DashboardWidgetId) => void;
  resetLayout: () => void;
  isDesigning: boolean;
  toggleDesigning: () => void;
  addHomeShortcut: (shortcut: DashboardHomeShortcut) => boolean;
  removeHomeShortcut: (shortcutId: string) => void;
  resolveWidgetSpanUnits: (widgetId: DashboardWidgetId) => number;
  defaultSpanUnitsById: Partial<Record<string, number>>;
};

type DashboardLayoutContextGlobal = typeof globalThis & {
  [DASHBOARD_LAYOUT_REACT_CONTEXT_KEY]?: React.Context<DashboardLayoutContextValue | null>;
};

const DashboardLayoutContext = ((globalThis as DashboardLayoutContextGlobal)[DASHBOARD_LAYOUT_REACT_CONTEXT_KEY] ??=
  createContext<DashboardLayoutContextValue | null>(null));

if (import.meta.hot) {
  import.meta.hot.accept();
}

type DashboardLayoutProviderProps = {
  children: React.ReactNode;
  isAdmin: boolean;
  feedbackEnabled: boolean;
};

export const DashboardLayoutProvider: React.FC<DashboardLayoutProviderProps> = ({
  children,
  isAdmin,
  feedbackEnabled,
}) => {
  const { isAuthenticated, currentUser } = useAuth();
  const { clientContext, patchClientContext } = useClientContext();
  const hydratedUserIdRef = useRef<number | null>(null);
  const persistTimerRef = useRef<number | null>(null);
  const persistAttemptsRef = useRef(0);
  const pendingPreferenceRef = useRef<DashboardLayoutPreference | null>(null);
  const currentUserIdRef = useRef<number | null>(null);
  const patchClientContextRef = useRef(patchClientContext);
  patchClientContextRef.current = patchClientContext;
  currentUserIdRef.current = currentUser?.id ?? null;
  const [localPreference, setLocalPreference] = useState<DashboardLayoutPreference | null>(null);
  const [isDesigning, setIsDesigning] = useState(false);

  const homeWidgetRegistry = useHomeWidgetRegistry();

  const legacyDefaultOrder = useMemo(
    () => buildDefaultDashboardWidgetOrder({ isAdmin, feedbackEnabled }),
    [feedbackEnabled, isAdmin],
  );

  const availableWidgets = useMemo(
    () => homeWidgetRegistry.map((entry) => entry.layoutId),
    [homeWidgetRegistry],
  );

  const defaultHiddenWidgets = useMemo(() => {
    const legacyVisible = new Set<DashboardWidgetId>(legacyDefaultOrder);
    return homeWidgetRegistry
      .filter((entry) => !legacyVisible.has(entry.layoutId) && entry.defaultVisible !== true)
      .map((entry) => entry.layoutId);
  }, [homeWidgetRegistry, legacyDefaultOrder]);

  const sessionPreference = useMemo(
    () => parseDashboardLayout(clientContext[DASHBOARD_LAYOUT_CONTEXT_KEY]),
    [clientContext],
  );

  const basePreference = useMemo((): DashboardLayoutPreference => {
    if (localPreference) {
      return localPreference;
    }
    if (sessionPreference) {
      return sessionPreference;
    }
    return {
      layoutMode: 'masonry',
      widgetOrder: [],
      hiddenWidgets: [],
      widgetSizes: {},
      widgetChrome: {},
      homeShortcuts: [],
    };
  }, [localPreference, sessionPreference]);

  const mergedWidgetOrder = useMemo(
    () => mergeDashboardWidgetOrder(basePreference.widgetOrder, availableWidgets, legacyDefaultOrder),
    [availableWidgets, basePreference.widgetOrder, legacyDefaultOrder],
  );

  const hiddenWidgets = useMemo(() => {
    const available = new Set(availableWidgets);
    const stored = [...new Set(basePreference.hiddenWidgets)].filter((id) => available.has(id));
    const baseline = defaultHiddenWidgets.filter((id) => available.has(id));
    const revealed = new Set(
      (basePreference.revealedHomeWidgets ?? []).filter((id) => available.has(id)),
    );
    let resolved = [...new Set([...baseline, ...stored])].filter((id) => !revealed.has(id));
    if (!feedbackEnabled) {
      resolved = [...new Set([...resolved, 'feedback'])].filter((id) => available.has(id));
    }
    return resolved;
  }, [
    availableWidgets,
    basePreference.hiddenWidgets,
    basePreference.revealedHomeWidgets,
    defaultHiddenWidgets,
    feedbackEnabled,
  ]);

  const widgetOrder = useMemo(
    () => resolveVisibleDashboardWidgets(mergedWidgetOrder, hiddenWidgets),
    [hiddenWidgets, mergedWidgetOrder],
  );

  const widgetSizes = basePreference.widgetSizes ?? {};
  const widgetChrome = basePreference.widgetChrome ?? {};
  const homeShortcuts = basePreference.homeShortcuts ?? [];

  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      hydratedUserIdRef.current = null;
      pendingPreferenceRef.current = null;
      setLocalPreference(null);
      return;
    }

    if (hydratedUserIdRef.current === currentUser.id) {
      return;
    }

    hydratedUserIdRef.current = currentUser.id;
    pendingPreferenceRef.current = null;
    persistAttemptsRef.current = 0;
    const recalled = recallUserDashboardLayout(currentUser.id);
    setLocalPreference(recalled);
    if (recalled) {
      patchClientContextRef.current({
        [DASHBOARD_LAYOUT_CONTEXT_KEY]: recalled,
      });
    }
  }, [currentUser, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      return;
    }

    if (isUserDashboardLayoutDirty(currentUser.id) || pendingPreferenceRef.current) {
      return;
    }

    let cancelled = false;
    void fetchUserDashboardLayout().then((layout) => {
      if (cancelled || !layout || pendingPreferenceRef.current) {
        return;
      }
      if (isUserDashboardLayoutDirty(currentUser.id)) {
        return;
      }
      rememberUserDashboardLayout(currentUser.id, layout, false);
      patchClientContextRef.current({
        [DASHBOARD_LAYOUT_CONTEXT_KEY]: layout,
      });
      setLocalPreference((current) => current ?? layout);
    });

    return () => {
      cancelled = true;
    };
  }, [currentUser, isAuthenticated]);

  const writePreference = useCallback(async (keepalive = false) => {
    const snapshot = pendingPreferenceRef.current;
    if (!snapshot) {
      return;
    }
    const userId = currentUserIdRef.current ?? undefined;
    const saved = await persistUserDashboardLayout(snapshot, { keepalive, userId });
    if (!saved) {
      if (!keepalive && persistAttemptsRef.current < PERSIST_MAX_ATTEMPTS) {
        persistAttemptsRef.current += 1;
        persistTimerRef.current = window.setTimeout(() => {
          persistTimerRef.current = null;
          void writePreference();
        }, PERSIST_RETRY_MS);
      }
      return;
    }
    persistAttemptsRef.current = 0;
    if (pendingPreferenceRef.current !== snapshot) {
      void writePreference(keepalive);
      return;
    }
    if (userId) {
      rememberUserDashboardLayout(userId, snapshot, false);
    }
    patchClientContextRef.current({
      [DASHBOARD_LAYOUT_CONTEXT_KEY]: snapshot,
    });
    pendingPreferenceRef.current = null;
  }, []);

  const flushPendingPreference = useCallback((keepalive = false) => {
    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    if (!pendingPreferenceRef.current) {
      return;
    }
    void writePreference(keepalive);
  }, [writePreference]);

  useEffect(() => {
    const flushHidden = () => flushPendingPreference(true);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushHidden();
      }
    };
    window.addEventListener('pagehide', flushHidden);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', flushHidden);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      flushPendingPreference(true);
    };
  }, [flushPendingPreference]);

  const schedulePersist = useCallback((
    nextPreference: DashboardLayoutPreference,
    options?: { immediate?: boolean },
  ) => {
    if (!isAuthenticated || !currentUser) {
      return;
    }

    pendingPreferenceRef.current = nextPreference;
    persistAttemptsRef.current = 0;
    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }

    if (options?.immediate) {
      void writePreference();
      return;
    }

    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      void writePreference();
    }, PERSIST_DEBOUNCE_MS);
  }, [currentUser, isAuthenticated, writePreference]);

  const applyPreference = useCallback((
    updater: (current: DashboardLayoutPreference) => DashboardLayoutPreference,
    options?: { immediate?: boolean },
  ) => {
    setLocalPreference((currentLocal) => {
      const current: DashboardLayoutPreference = currentLocal ?? sessionPreference ?? {
        layoutMode: 'masonry',
        widgetOrder: mergeDashboardWidgetOrder([], availableWidgets, legacyDefaultOrder),
        hiddenWidgets: [],
        widgetSizes: {},
        widgetChrome: {},
        homeShortcuts: [],
      };
      const next = updater({
        ...current,
        widgetOrder: mergeDashboardWidgetOrder(current.widgetOrder, availableWidgets, legacyDefaultOrder),
        hiddenWidgets: [...new Set(current.hiddenWidgets)].filter((id) => availableWidgets.includes(id)),
        widgetSizes: current.widgetSizes ?? {},
        widgetChrome: current.widgetChrome ?? {},
        homeShortcuts: current.homeShortcuts ?? [],
      });
      if (currentUserIdRef.current) {
        rememberUserDashboardLayout(currentUserIdRef.current, next, true);
      }
      schedulePersist(next, options);
      patchClientContextRef.current({
        [DASHBOARD_LAYOUT_CONTEXT_KEY]: next,
      });
      return next;
    });
  }, [availableWidgets, legacyDefaultOrder, schedulePersist, sessionPreference]);

  const setWidgetOrder = useCallback((order: DashboardWidgetId[]) => {
    applyPreference((current) => ({
      ...current,
      widgetOrder: mergeDashboardWidgetOrder(order, availableWidgets, legacyDefaultOrder),
    }), { immediate: true });
  }, [applyPreference, availableWidgets, legacyDefaultOrder]);

  const reorderWidgets = useCallback((activeId: DashboardWidgetId, overId: DashboardWidgetId) => {
    if (activeId === overId) {
      return;
    }

    const currentOrder = mergeDashboardWidgetOrder(
      (localPreference ?? sessionPreference)?.widgetOrder,
      availableWidgets,
      legacyDefaultOrder,
    );
    const oldIndex = currentOrder.indexOf(activeId);
    const newIndex = currentOrder.indexOf(overId);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    setWidgetOrder(arrayMove(currentOrder, oldIndex, newIndex));
  }, [availableWidgets, legacyDefaultOrder, localPreference, sessionPreference, setWidgetOrder]);

  const hideWidget = useCallback((widgetId: DashboardWidgetId) => {
    if (!availableWidgets.includes(widgetId)) {
      return;
    }

    applyPreference((current) => {
      const hidden = new Set(current.hiddenWidgets);
      hidden.add(widgetId);
      const revealedHomeWidgets = (current.revealedHomeWidgets ?? []).filter((id) => id !== widgetId);
      return {
        ...current,
        hiddenWidgets: [...hidden],
        revealedHomeWidgets,
      };
    }, { immediate: true });
  }, [applyPreference, availableWidgets]);

  const showWidget = useCallback((widgetId: DashboardWidgetId) => {
    applyPreference((current) => ({
      ...current,
      hiddenWidgets: current.hiddenWidgets.filter((id) => id !== widgetId),
      revealedHomeWidgets: [...new Set([...(current.revealedHomeWidgets ?? []), widgetId])],
    }), { immediate: true });
  }, [applyPreference]);

  const resolveWidgetSpanUnits = useCallback((widgetId: DashboardWidgetId): number => {
    const entry = resolveHomeWidgetRegistryEntry(homeWidgetRegistry, widgetId);
    return resolveDashboardSpanUnits(widgetId, widgetSizes, entry?.defaultSpanUnits);
  }, [homeWidgetRegistry, widgetSizes]);

  const defaultSpanUnitsById = useMemo(() => {
    const map: Partial<Record<string, number>> = {};
    for (const entry of homeWidgetRegistry) {
      map[entry.layoutId] = entry.defaultSpanUnits;
    }
    return map;
  }, [homeWidgetRegistry]);

  const setWidgetSize = useCallback((widgetId: DashboardWidgetId, size: DashboardWidgetSize) => {
    if (!availableWidgets.includes(widgetId)) {
      return;
    }

    applyPreference((current) => {
      const previous = current.widgetSizes[widgetId] ?? {};
      const span = size.span ?? previous.span;
      const start = size.start !== undefined ? size.start : previous.start;
      const next: DashboardWidgetSize = {};
      if (span != null) {
        next.span = span;
      }
      if (start != null) {
        next.start = clampDashboardWidgetStart(
          start,
          span ?? resolveWidgetSpanUnits(widgetId),
        );
      }
      return {
        ...current,
        widgetSizes: {
          ...current.widgetSizes,
          [widgetId]: next,
        },
      };
    });
  }, [applyPreference, availableWidgets, resolveWidgetSpanUnits]);

  const setWidgetChrome = useCallback((widgetId: DashboardWidgetId, chrome: DashboardWidgetChrome) => {
    if (!availableWidgets.includes(widgetId)) {
      return;
    }

    applyPreference((current) => {
      const previous = current.widgetChrome[widgetId] ?? {};
      const compact = compactDashboardWidgetChrome({
        ...previous,
        ...chrome,
      });
      const nextChrome = { ...current.widgetChrome };
      if (compact) {
        nextChrome[widgetId] = compact;
      } else {
        delete nextChrome[widgetId];
      }
      return {
        ...current,
        widgetChrome: nextChrome,
      };
    }, { immediate: true });
  }, [applyPreference, availableWidgets]);

  const placeWidgets = useCallback((
    order: DashboardWidgetId[],
    sizes: DashboardWidgetSizes,
  ) => {
    applyPreference((current) => ({
      ...current,
      widgetOrder: mergeDashboardWidgetOrder(order, availableWidgets, legacyDefaultOrder),
      widgetSizes: sizes,
    }), { immediate: true });
  }, [applyPreference, availableWidgets, legacyDefaultOrder]);

  const toggleDesigning = useCallback(() => {
    setIsDesigning((current) => !current);
  }, []);

  useEffect(() => {
    setDashboardDesignMode(isDesigning);
    return () => setDashboardDesignMode(false);
  }, [isDesigning]);

  const resetLayout = useCallback(() => {
    applyPreference((current) => ({
      layoutMode: 'masonry',
      widgetOrder: mergeDashboardWidgetOrder([], availableWidgets, legacyDefaultOrder),
      hiddenWidgets: defaultHiddenWidgets,
      revealedHomeWidgets: [],
      widgetSizes: {},
      widgetChrome: {},
      homeShortcuts: current.homeShortcuts ?? [],
    }), { immediate: true });
  }, [applyPreference, availableWidgets, defaultHiddenWidgets, legacyDefaultOrder]);

  const addHomeShortcut = useCallback((shortcut: DashboardHomeShortcut) => {
    let added = false;
    applyPreference((current) => {
      const currentShortcuts = current.homeShortcuts ?? [];
      const homeShortcuts = mergeDashboardHomeShortcut(currentShortcuts, shortcut);
      added = homeShortcuts !== currentShortcuts;
      return {
        ...current,
        homeShortcuts,
        hiddenWidgets: current.hiddenWidgets.filter((id) => id !== 'my-shortcuts'),
      };
    }, { immediate: true });
    return added;
  }, [applyPreference]);

  const removeHomeShortcut = useCallback((shortcutId: string) => {
    applyPreference((current) => ({
      ...current,
      homeShortcuts: (current.homeShortcuts ?? []).filter((item) => item.id !== shortcutId),
    }), { immediate: true });
  }, [applyPreference]);

  useEffect(() => registerHomeShortcutAdder((shortcut) => addHomeShortcut(shortcut)), [addHomeShortcut]);

  const value = useMemo<DashboardLayoutContextValue>(() => ({
    homeWidgetRegistry,
    availableWidgets,
    widgetOrder,
    hiddenWidgets,
    widgetSizes,
    widgetChrome,
    homeShortcuts,
    reorderWidgets,
    setWidgetOrder,
    setWidgetSize,
    setWidgetChrome,
    placeWidgets,
    hideWidget,
    showWidget,
    resetLayout,
    isDesigning,
    toggleDesigning,
    addHomeShortcut,
    removeHomeShortcut,
    resolveWidgetSpanUnits,
    defaultSpanUnitsById,
  }), [
    addHomeShortcut,
    availableWidgets,
    hiddenWidgets,
    hideWidget,
    homeShortcuts,
    homeWidgetRegistry,
    isDesigning,
    placeWidgets,
    removeHomeShortcut,
    reorderWidgets,
    resetLayout,
    resolveWidgetSpanUnits,
    defaultSpanUnitsById,
    setWidgetChrome,
    setWidgetOrder,
    setWidgetSize,
    showWidget,
    toggleDesigning,
    widgetChrome,
    widgetOrder,
    widgetSizes,
  ]);

  return (
    <DashboardLayoutContext.Provider value={value}>
      {children}
    </DashboardLayoutContext.Provider>
  );
};

export const useDashboardLayout = (): DashboardLayoutContextValue => {
  const context = useContext(DashboardLayoutContext);
  if (!context) {
    throw new Error('useDashboardLayout must be used within DashboardLayoutProvider.');
  }
  return context;
};
