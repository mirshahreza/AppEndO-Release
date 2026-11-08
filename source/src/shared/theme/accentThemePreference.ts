import type { AccentPaletteSource, AccentThemeState } from './accentColorUtils';
import { DEFAULT_ACCENT_HEX, normalizeHex } from './accentColorUtils';
import { ACCENT_THEME_CONTEXT_KEY, BUILTIN_USER_ATTRIBUTE_KEYS } from '../api/contracts/attributes/builtInAttributes';

export { ACCENT_THEME_CONTEXT_KEY, BUILTIN_USER_ATTRIBUTE_KEYS };

const ACCENT_SOURCES = new Set<AccentPaletteSource>(['default', 'spectrum', 'fluent', 'material']);

export const parseAccentThemePreference = (value: unknown): AccentThemeState | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const hex = normalizeHex(String(record.hex ?? ''));
  if (!hex) {
    return null;
  }

  const rawSource = String(record.source ?? 'default').trim() as AccentPaletteSource;
  const source = ACCENT_SOURCES.has(rawSource) ? rawSource : 'default';

  return { hex, source };
};

export const accentThemeToAttributeValue = (state: AccentThemeState): Record<string, string> => ({
  hex: state.hex,
  source: state.source,
});

export const defaultAccentThemePreference = (): AccentThemeState => ({
  hex: DEFAULT_ACCENT_HEX,
  source: 'default',
});

/** Fixed accent theme for the unauthenticated login screen. */
export const LOGIN_ACCENT_THEME = defaultAccentThemePreference();

export const isLoginPath = (pathname: string): boolean => pathname === '/login';
