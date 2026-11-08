import {
  buildAccentCssVars,
  harmonizeAccentHex,
  persistAccentCssVars,
  type AccentPaletteSource,
} from './accentColorUtils';
import {
  ATMOSPHERE_GEOMETRY_TOKEN_KEY,
  syncAtmosphereGeometryDocumentAttr,
} from './atmosphereGeometry';
import {
  THEME_PRESET_PREVIEW_TOKEN_KEYS,
  THEME_TOKEN_DEFINITION_BY_KEY,
  THEME_TOKEN_KEYS,
} from './themeTokenCatalog';

const ACCENT_CSS_VAR_KEY = /^--[a-z0-9-]+$/i;

export type ThemeTokenMap = Record<string, string>;

/** Tokens that must share the same value within each group. */
const THEME_TOKEN_MIRROR_GROUPS: readonly (readonly string[])[] = [
  ['--app-accent-500', '--color-primary-500', '--color-picker-default'],
  ['--app-accent-600', '--color-primary-600'],
  ['--app-accent-700', '--color-primary-700'],
  ['--app-accent-subtle', '--color-primary-subtle'],
  ['--app-shell-bg', '--color-surface-shell'],
  ['--color-surface-elevated', '--app-surface-soft'],
  ['--color-nav-item-hover-bg', '--app-nav-hover', '--color-nav-hover'],
  ['--app-shell-content-border', '--color-shell-content-border'],
  ['--app-nav-group-header-text', '--color-nav-group-header'],
  ['--app-nav-item-active-bg', '--color-nav-item-active-bg', '--color-nav-active'],
];

/**
 * Composite tokens expressed with var() references so component stops stay live
 * (matches index.css defaults; overrides baked literals from buildAccentCssVars).
 */
export const THEME_DERIVED_COMPOSITE_TOKEN_KEYS = new Set<string>([
  '--app-nav-group',
  '--app-nav-group-active',
  '--color-nav-group',
  '--color-nav-group-active',
]);

const THEME_COMPOSITE_VAR_TOKENS: ThemeTokenMap = {
  '--gradient-app-logo': 'linear-gradient(105deg, var(--app-logo-from) 0%, var(--app-logo-via) 48%, var(--app-logo-to) 100%)',
  '--gradient-nav-group': 'linear-gradient(180deg, var(--app-nav-group-header-edge) 0%, var(--app-nav-group-header-center) calc(50% - var(--app-nav-group-header-center-band)), var(--app-nav-group-header-center) calc(50% + var(--app-nav-group-header-center-band)), var(--app-nav-group-header-edge) 100%)',
  '--gradient-nav-group-active': 'linear-gradient(180deg, var(--app-nav-group-header-edge-active) 0%, var(--app-nav-group-header-center) calc(50% - var(--app-nav-group-header-center-band)), var(--app-nav-group-header-center) calc(50% + var(--app-nav-group-header-center-band)), var(--app-nav-group-header-edge-active) 100%)',
  '--gradient-nav-group-header': 'var(--gradient-nav-group)',
  '--gradient-nav-group-header-active': 'var(--gradient-nav-group-active)',
  '--gradient-shell-atmosphere': [
    'radial-gradient(ellipse 100% 68% at -6% -10%, rgb(var(--app-accent-rgb) / 0.16) 0%, transparent 50%)',
    'radial-gradient(ellipse 78% 56% at 106% 104%, rgb(var(--app-accent-secondary-rgb) / 0.13) 0%, transparent 46%)',
    'radial-gradient(ellipse 62% 36% at 76% 2%, rgb(var(--app-accent-tertiary-rgb) / 0.10) 0%, transparent 42%)',
    'radial-gradient(ellipse 90% 50% at 50% -12%, color-mix(in srgb, var(--app-accent-wash) 52%, transparent) 0%, transparent 58%)',
    'linear-gradient(180deg, var(--app-accent-soft) 0%, var(--app-shell-bg) 100%)',
  ].join(', '),
  '--app-nav-group': 'var(--app-nav-group-header-edge)',
  '--app-nav-group-active': 'var(--app-nav-group-header-center)',
  '--color-nav-group': 'var(--app-nav-group-header-edge)',
  '--color-nav-group-active': 'var(--app-nav-group-header-center)',
  '--app-nav-group-header-text-expanded': 'var(--app-accent-700, #0f8f7a)',
  '--color-nav-group-header-expanded': 'var(--app-nav-group-header-text-expanded)',
};

const PRIMARY_RGB_CSS_TOKEN_KEYS = new Set([
  '--color-primary-glow-a055',
  '--color-primary-glow-a03',
  '--color-primary-glow-a02',
  '--shadow-cyan-ring-sm',
  '--shadow-cyan-ring-md',
  '--shadow-nav-active',
]);

const SECONDARY_RGB_CSS_TOKEN_KEYS = new Set([
  '--color-indigo-glow-a12',
  '--color-indigo-glow-a16',
  '--color-indigo-glow-a20',
  '--color-indigo-glow-a35',
]);

const TERTIARY_RGB_CSS_TOKEN_KEYS = new Set([
  '--color-sky-glow-a14',
  '--color-cyan-glow-a14',
  '--color-cyan-glow-a18',
]);

const MIXED_RGB_CSS_TOKEN_KEYS = new Set([
  '--shadow-nav-active-strong',
  '--gradient-pattern-menu-overlay',
  '--gradient-pattern-header-overlay',
  '--gradient-nav-item-hover-shimmer',
  '--gradient-nav-item-active',
  '--gradient-surface-workspace',
]);

const rewriteRgbLiteralChannels = (
  value: string,
  literal: string,
  varName: string,
): string => {
  const escaped = literal.trim().replace(/\s+/g, '\\s+');
  return value
    .replace(new RegExp(`rgb\\(\\s*${escaped}\\s*/`, 'g'), `rgb(var(${varName}) / `)
    .replace(new RegExp(`rgb\\(\\s*${escaped}\\s*\\)`, 'g'), `rgb(var(${varName}))`);
};

const rewritePrimaryRgbChannels = (value: string): string => (
  value.replace(
    /rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\/\s*([^)]+)\)/g,
    (match, red, green, blue, alpha) => (
      red === '255' && green === '255' && blue === '255'
        ? match
        : `rgb(var(--app-accent-rgb) / ${alpha.trim()})`
    ),
  )
);

const rewriteSecondaryRgbChannels = (value: string): string => (
  value.replace(
    /rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\/\s*([^)]+)\)/g,
    (match, red, green, blue, alpha) => (
      red === '255' && green === '255' && blue === '255'
        ? match
        : `rgb(var(--app-accent-secondary-rgb) / ${alpha.trim()})`
    ),
  )
);

const rewriteTertiaryRgbChannels = (value: string): string => (
  value.replace(
    /rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\/\s*([^)]+)\)/g,
    (match, red, green, blue, alpha) => (
      red === '255' && green === '255' && blue === '255'
        ? match
        : `rgb(var(--app-accent-tertiary-rgb) / ${alpha.trim()})`
    ),
  )
);

const shouldApplyCompositeVarToken = (currentValue: string | undefined, compositeValue: string): boolean => {
  const current = currentValue?.trim() ?? '';
  if (!current) {
    return true;
  }
  if (current === compositeValue.trim()) {
    return true;
  }
  return current.includes('var(--');
};

/** Composite tokens always rebuilt from source stops — never edited directly in Theme Designer. */
const FORCE_DERIVED_COMPOSITE_KEYS = new Set<string>([
  '--gradient-app-logo',
  '--gradient-nav-group',
  '--gradient-nav-group-active',
  '--gradient-nav-group-header',
  '--gradient-nav-group-header-active',
  '--gradient-shell-atmosphere',
  '--app-nav-group-header-text-expanded',
  '--color-nav-group-header-expanded',
]);

const syncCompositeVarTokens = (tokens: ThemeTokenMap): void => {
  for (const [key, compositeValue] of Object.entries(THEME_COMPOSITE_VAR_TOKENS)) {
    if (
      FORCE_DERIVED_COMPOSITE_KEYS.has(key)
      || shouldApplyCompositeVarToken(tokens[key], compositeValue)
    ) {
      tokens[key] = compositeValue;
    }
  }
};
const syncMirrorGroups = (tokens: ThemeTokenMap, preferredMirrorKey?: string): void => {
  for (const group of THEME_TOKEN_MIRROR_GROUPS) {
    let canonical: string | undefined;
    if (preferredMirrorKey && group.includes(preferredMirrorKey)) {
      canonical = String(tokens[preferredMirrorKey] ?? '').trim();
    }
    if (!canonical) {
      canonical = group
        .map((key) => tokens[key])
        .map((token) => String(token ?? '').trim())
        .find((token) => token.length > 0);
    }
    if (!canonical) {
      continue;
    }
    for (const key of group) {
      tokens[key] = canonical;
    }
  }
};

const syncRgbVarReferences = (tokens: ThemeTokenMap): void => {
  for (const [key, value] of Object.entries(tokens)) {
    if (THEME_TOKEN_DEFINITION_BY_KEY.has(key)) {
      continue;
    }
    if (!value.includes('rgb(')) {
      continue;
    }

    if (PRIMARY_RGB_CSS_TOKEN_KEYS.has(key)) {
      tokens[key] = rewritePrimaryRgbChannels(value);
      continue;
    }
    if (SECONDARY_RGB_CSS_TOKEN_KEYS.has(key)) {
      tokens[key] = rewriteSecondaryRgbChannels(value);
      continue;
    }
    if (TERTIARY_RGB_CSS_TOKEN_KEYS.has(key)) {
      tokens[key] = rewriteTertiaryRgbChannels(value);
      continue;
    }
    if (!MIXED_RGB_CSS_TOKEN_KEYS.has(key)) {
      continue;
    }

    let next = value;
    const primary = tokens['--app-accent-rgb'];
    const secondary = tokens['--app-accent-secondary-rgb'];
    const tertiary = tokens['--app-accent-tertiary-rgb'];
    if (primary) {
      next = rewriteRgbLiteralChannels(next, primary, '--app-accent-rgb');
    }
    if (secondary) {
      next = rewriteRgbLiteralChannels(next, secondary, '--app-accent-secondary-rgb');
    }
    if (tertiary) {
      next = rewriteRgbLiteralChannels(next, tertiary, '--app-accent-tertiary-rgb');
    }
    tokens[key] = next;
  }
};

export type SyncDerivedThemeTokensOptions = {
  /** When set, mirror groups prefer this key's value (live editor target). */
  preferredMirrorKey?: string;
};

/**
 * Reconcile alias mirrors and derived composite tokens so live edits propagate.
 * Call before applying or persisting theme token maps.
 */
export const syncDerivedThemeTokens = (
  tokens: ThemeTokenMap,
  options?: SyncDerivedThemeTokensOptions,
): ThemeTokenMap => {
  const synced: ThemeTokenMap = { ...sanitizeThemeTokenMap(tokens) };
  syncMirrorGroups(synced, options?.preferredMirrorKey);
  syncCompositeVarTokens(synced);
  syncRgbVarReferences(synced);
  return synced;
};

export const preserveExactForSource = (source: AccentPaletteSource): boolean => (
  source === 'fluent' || source === 'material'
);

export const deriveThemeTokensFromBase = (
  baseHex: string,
  source: AccentPaletteSource,
): ThemeTokenMap => (
  syncDerivedThemeTokens(buildAccentCssVars(harmonizeAccentHex(baseHex, preserveExactForSource(source))))
);

/**
 * Brand / logo / chrome keys operators may customize in Theme Designer.
 * Catalog entries persist on read; generator defaults stay slate until edited.
 */
export const THEME_OPERATOR_OWNED_TOKEN_KEYS = new Set<string>([
  ...THEME_TOKEN_KEYS,
  ...THEME_TOKEN_MIRROR_GROUPS.flat(),
]);

/**
 * Keep operator brand tokens; restamp slate chrome / status glows from the generator.
 * Fixes Theme Designer files produced before chrome isolation (tinted `--app-shell-bg`).
 */
export const reconcileNeutralChromeTokens = (
  tokens: ThemeTokenMap,
  baseHex: string,
  source: AccentPaletteSource,
): ThemeTokenMap => {
  const generated = deriveThemeTokensFromBase(baseHex, source);
  const stored = sanitizeThemeTokenMap(tokens);
  const merged: ThemeTokenMap = { ...generated };
  for (const key of THEME_OPERATOR_OWNED_TOKEN_KEYS) {
    const value = stored[key];
    if (value) {
      merged[key] = value;
    }
  }
  return syncDerivedThemeTokens(merged);
};

export const isSafeThemeTokenKey = (key: string): boolean => ACCENT_CSS_VAR_KEY.test(key);

export const sanitizeThemeTokenMap = (tokens: ThemeTokenMap): ThemeTokenMap => {
  const sanitized: ThemeTokenMap = {};
  for (const [key, value] of Object.entries(tokens)) {
    if (!isSafeThemeTokenKey(key)) continue;
    if (typeof value !== 'string' || value.length === 0 || value.includes('<')) continue;
    sanitized[key] = value;
  }
  return sanitized;
};

/** Scope draft tokens to a preview subtree without touching `:root`. */
export const buildThemeTokenScopeStyle = (tokens: ThemeTokenMap): ThemeTokenMap => (
  sanitizeThemeTokenMap(tokens)
);

export const applyThemeTokenMapToDocument = (tokens: ThemeTokenMap): void => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const sanitized = syncDerivedThemeTokens(tokens);
  for (const [key, value] of Object.entries(sanitized)) {
    root.style.setProperty(key, value);
  }
  syncAtmosphereGeometryDocumentAttr(root, sanitized[ATMOSPHERE_GEOMETRY_TOKEN_KEY]);
  const accent = sanitized['--app-accent-500'];
  if (accent) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', accent);
    }
  }
};

export const persistThemeTokenMap = (tokens: ThemeTokenMap): void => {
  persistAccentCssVars(syncDerivedThemeTokens(tokens));
};

export type ThemePresetPreviewSwatch = {
  key: string;
  value: string;
};

export const buildThemePresetPreviewSwatches = (tokens: ThemeTokenMap): ThemePresetPreviewSwatch[] => (
  THEME_PRESET_PREVIEW_TOKEN_KEYS.map((key) => ({
    key,
    value: tokens[key] ?? '#E2E8F0',
  }))
);

export const rgbTokenToCssColor = (value: string): string => {
  const parts = value.trim().split(/\s+/).map((part) => Number.parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return '#94A3B8';
  }
  return `rgb(${parts[0]} ${parts[1]} ${parts[2]})`;
};

export const rgbTokenToHex = (value: string): string => {
  const parts = value.trim().split(/\s+/).map((part) => Number.parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return '#00A28A';
  }
  const [red, green, blue] = parts;
  return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
};

export const hexToRgbToken = (hex: string): string => {
  const normalized = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    return '0 162 138';
  }
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `${red} ${green} ${blue}`;
};

export const resolveThemeTokenDisplayColor = (key: string, value: string): string => {
  if (value.startsWith('#')) {
    return value;
  }
  if (key.endsWith('-rgb')) {
    return rgbTokenToCssColor(value);
  }
  if (value.startsWith('rgb(')) {
    return value;
  }
  return '#E2E8F0';
};
