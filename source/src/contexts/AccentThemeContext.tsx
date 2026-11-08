import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  applyAccentThemeToDocument,
  cacheAccentThemeCssVars,
  DEFAULT_ACCENT_HEX,
  harmonizeAccentHex,
  persistAccentTheme,
  readStoredAccentTheme,
  type AccentPaletteSource,
  type AccentThemeState,
} from '../shared/theme/accentColorUtils';
import { isLoginPath, LOGIN_ACCENT_THEME } from '../shared/theme/accentThemePreference';

type AccentThemeContextValue = {
  accentHex: string;
  source: AccentPaletteSource;
  setAccentColor: (hex: string, source: AccentPaletteSource) => void;
  applyAccentThemeState: (state: AccentThemeState) => void;
  applyAccentThemeVisual: (state: AccentThemeState) => void;
  resetAccentColor: () => void;
};

const AccentThemeContext = createContext<AccentThemeContextValue | null>(null);

const resolveInitialAccentTheme = (): AccentThemeState => {
  if (typeof window !== 'undefined' && isLoginPath(window.location.pathname)) {
    return LOGIN_ACCENT_THEME;
  }
  const stored = readStoredAccentTheme();
  return stored ?? { hex: DEFAULT_ACCENT_HEX, source: 'default' };
};

const initialAccentTheme = resolveInitialAccentTheme();

export const AccentThemeProvider = ({ children }: { children: ReactNode }) => {
  const [accentHex, setAccentHex] = useState(initialAccentTheme.hex);
  const [source, setSource] = useState<AccentPaletteSource>(initialAccentTheme.source);

  const applyAccentThemeVisual = useCallback((state: AccentThemeState): AccentThemeState => {
    const preserveExact = state.source === 'fluent' || state.source === 'material';
    const tokens = applyAccentThemeToDocument(state.hex, preserveExact);
    const nextState: AccentThemeState = { hex: tokens.base, source: state.source };
    setAccentHex(tokens.base);
    setSource(state.source);
    return nextState;
  }, []);

  const applyAccentThemeState = useCallback((state: AccentThemeState) => {
    const nextState = applyAccentThemeVisual(state);
    persistAccentTheme(nextState);
  }, [applyAccentThemeVisual]);

  const setAccentColor = useCallback((hex: string, nextSource: AccentPaletteSource) => {
    applyAccentThemeState({ hex, source: nextSource });
  }, [applyAccentThemeState]);

  const resetAccentColor = useCallback(() => {
    setAccentColor(DEFAULT_ACCENT_HEX, 'default');
  }, [setAccentColor]);

  const value = useMemo(
    () => ({
      accentHex,
      source,
      setAccentColor,
      applyAccentThemeState,
      applyAccentThemeVisual,
      resetAccentColor,
    }),
    [accentHex, applyAccentThemeState, applyAccentThemeVisual, resetAccentColor, setAccentColor, source],
  );

  return <AccentThemeContext.Provider value={value}>{children}</AccentThemeContext.Provider>;
};

export const useAccentTheme = (): AccentThemeContextValue => {
  const context = useContext(AccentThemeContext);
  if (!context) {
    throw new Error('useAccentTheme must be used within AccentThemeProvider');
  }
  return context;
};

/** Apply persisted accent before first paint to avoid a flash of the default theme. */
export const bootstrapAccentTheme = (): void => {
  if (typeof window !== 'undefined' && isLoginPath(window.location.pathname)) {
    applyAccentThemeToDocument(LOGIN_ACCENT_THEME.hex, false);
    return;
  }

  const stored = readStoredAccentTheme();
  const hex = stored?.hex ?? DEFAULT_ACCENT_HEX;
  const preserveExact = stored?.source === 'fluent' || stored?.source === 'material';
  applyAccentThemeToDocument(hex, preserveExact);
  cacheAccentThemeCssVars(hex, preserveExact);
};

export const getAccentPreviewTokens = (hex: string, source: AccentPaletteSource) => (
  harmonizeAccentHex(hex, source === 'fluent' || source === 'material')
);
