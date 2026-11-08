import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import { useClientContext } from './ClientContextContext';
import { GRID_COLUMN_LAYOUTS_CONTEXT_KEY } from '../shared/api/contracts/attributes/builtInAttributes';
import type { GridColumnLayoutState } from '../shared/lib/appTableGridColumnLayout';
import {
  mergeGridColumnLayout,
  parseUserGridColumnLayouts,
  resolveStoredGridColumnLayout,
  type UserGridColumnLayoutsMap,
} from '../shared/lib/userGridColumnLayouts';
import { persistUserGridColumnLayout } from '../shared/lib/userGridColumnLayoutsPersistence';

const PERSIST_DEBOUNCE_MS = 450;

type GridColumnLayoutsContextValue = {
  layouts: UserGridColumnLayoutsMap;
  getLayout: (gridId: string | undefined) => GridColumnLayoutState | null;
  persistLayout: (gridId: string, layout: GridColumnLayoutState) => void;
};

const GridColumnLayoutsContext = createContext<GridColumnLayoutsContextValue | null>(null);

export const GridColumnLayoutsProvider = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, currentUser } = useAuth();
  const { clientContext, patchClientContext } = useClientContext();
  const hydratedUserIdRef = useRef<number | null>(null);
  const [localOverrides, setLocalOverrides] = useState<UserGridColumnLayoutsMap>({});
  const persistTimersRef = useRef<Map<string, number>>(new Map());

  const sessionLayouts = useMemo(
    () => parseUserGridColumnLayouts(clientContext[GRID_COLUMN_LAYOUTS_CONTEXT_KEY]),
    [clientContext],
  );

  const layouts = useMemo(
    () => ({ ...sessionLayouts, ...localOverrides }),
    [localOverrides, sessionLayouts],
  );

  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      hydratedUserIdRef.current = null;
      setLocalOverrides({});
      return;
    }

    if (hydratedUserIdRef.current !== currentUser.id) {
      hydratedUserIdRef.current = currentUser.id;
      setLocalOverrides({});
    }
  }, [currentUser, isAuthenticated]);

  useEffect(() => () => {
    for (const timerId of persistTimersRef.current.values()) {
      window.clearTimeout(timerId);
    }
    persistTimersRef.current.clear();
  }, []);

  const getLayout = useCallback(
    (gridId: string | undefined) => resolveStoredGridColumnLayout(layouts, gridId),
    [layouts],
  );

  const persistLayout = useCallback((gridId: string, layout: GridColumnLayoutState) => {
    if (!isAuthenticated || !currentUser) {
      return;
    }

    setLocalOverrides((current) => ({ ...current, [gridId]: layout }));

    const existingTimer = persistTimersRef.current.get(gridId);
    if (existingTimer !== undefined) {
      window.clearTimeout(existingTimer);
    }

    const timerId = window.setTimeout(() => {
      persistTimersRef.current.delete(gridId);
      void (async () => {
        const saved = await persistUserGridColumnLayout(gridId, layout);
        if (saved) {
          patchClientContext({
            [GRID_COLUMN_LAYOUTS_CONTEXT_KEY]: mergeGridColumnLayout(sessionLayouts, gridId, layout),
          });
          setLocalOverrides((current) => {
            if (!(gridId in current)) {
              return current;
            }
            const next = { ...current };
            delete next[gridId];
            return next;
          });
        }
      })();
    }, PERSIST_DEBOUNCE_MS);

    persistTimersRef.current.set(gridId, timerId);
  }, [currentUser, isAuthenticated, patchClientContext, sessionLayouts]);

  const value = useMemo<GridColumnLayoutsContextValue>(() => ({
    layouts,
    getLayout,
    persistLayout,
  }), [getLayout, layouts, persistLayout]);

  return (
    <GridColumnLayoutsContext.Provider value={value}>
      {children}
    </GridColumnLayoutsContext.Provider>
  );
};

export const useGridColumnLayouts = (): GridColumnLayoutsContextValue => {
  const context = useContext(GridColumnLayoutsContext);
  if (!context) {
    throw new Error('useGridColumnLayouts must be used within GridColumnLayoutsProvider.');
  }
  return context;
};

export const useOptionalGridColumnLayouts = (): GridColumnLayoutsContextValue | null =>
  useContext(GridColumnLayoutsContext);
