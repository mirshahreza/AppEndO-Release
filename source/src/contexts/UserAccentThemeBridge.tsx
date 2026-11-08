import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useClientContext } from './ClientContextContext';
import { useAccentTheme } from './AccentThemeContext';
import {
  ACCENT_THEME_CONTEXT_KEY,
  isLoginPath,
  LOGIN_ACCENT_THEME,
  parseAccentThemePreference,
  accentThemeToAttributeValue,
} from '../shared/theme/accentThemePreference';
import {
  persistUserAccentTheme,
  resetAccentThemeDefinitionIdCache,
} from '../shared/theme/userAccentThemePersistence';

const PERSIST_DEBOUNCE_MS = 450;

/**
 * Applies the logged-in user's saved accent theme from session context and
 * persists picker changes back to the user's built-in accent_theme attribute.
 */
export const UserAccentThemeBridge = () => {
  const { pathname } = useLocation();
  const { isAuthenticated, currentUser } = useAuth();
  const { clientContext, patchClientContext } = useClientContext();
  const { accentHex, source, applyAccentThemeState, applyAccentThemeVisual } = useAccentTheme();

  const hydratedUserIdRef = useRef<number | null>(null);
  const skipNextPersistRef = useRef(false);
  const persistTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isLoginPath(pathname)) {
      hydratedUserIdRef.current = null;
      resetAccentThemeDefinitionIdCache();
      skipNextPersistRef.current = true;
      applyAccentThemeVisual(LOGIN_ACCENT_THEME);
      return;
    }

    if (!isAuthenticated || !currentUser) {
      hydratedUserIdRef.current = null;
      resetAccentThemeDefinitionIdCache();
      return;
    }

    if (hydratedUserIdRef.current === currentUser.id) {
      return;
    }

    const preference = parseAccentThemePreference(clientContext[ACCENT_THEME_CONTEXT_KEY]);
    if (preference) {
      skipNextPersistRef.current = true;
      applyAccentThemeState(preference);
    }

    hydratedUserIdRef.current = currentUser.id;
  }, [applyAccentThemeState, applyAccentThemeVisual, clientContext, currentUser, isAuthenticated, pathname]);

  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      return undefined;
    }

    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return undefined;
    }

    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
    }

    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      void (async () => {
        const saved = await persistUserAccentTheme({ hex: accentHex, source });
        if (saved) {
          patchClientContext({
            [ACCENT_THEME_CONTEXT_KEY]: accentThemeToAttributeValue({ hex: accentHex, source }),
          });
        }
      })();
    }, PERSIST_DEBOUNCE_MS);

    return () => {
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [accentHex, currentUser, isAuthenticated, patchClientContext, source]);

  return null;
};
