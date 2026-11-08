/**
 * Theme Designer editor catalog — user-facing controls only.
 *
 * Full runtime maps still include alias + derived tokens from `buildAccentCssVars`
 * (mirrors, composite gradients, glow rewrites). Those are synced automatically and
 * are intentionally omitted here to avoid duplicate or non-functional controls.
 */

export type ThemeTokenValueKind = 'hex' | 'rgb' | 'css' | 'gradient' | 'toggle' | 'percent';

export type ThemeTokenDefinition = {
  key: string;
  label: string;
  description: string;
  valueKind: ThemeTokenValueKind;
};

export type ThemeTokenCategory = {
  id: string;
  label: string;
  description: string;
  tokens: ThemeTokenDefinition[];
};

const hex = (
  key: string,
  label: string,
  description: string,
): ThemeTokenDefinition => ({ key, label, description, valueKind: 'hex' });

const rgb = (
  key: string,
  label: string,
  description: string,
): ThemeTokenDefinition => ({ key, label, description, valueKind: 'rgb' });

const css = (
  key: string,
  label: string,
  description: string,
): ThemeTokenDefinition => ({ key, label, description, valueKind: 'css' });

const gradient = (
  key: string,
  label: string,
  description: string,
): ThemeTokenDefinition => ({ key, label, description, valueKind: 'gradient' });

const toggle = (
  key: string,
  label: string,
  description: string,
): ThemeTokenDefinition => ({ key, label, description, valueKind: 'toggle' });

const percent = (
  key: string,
  label: string,
  description: string,
): ThemeTokenDefinition => ({ key, label, description, valueKind: 'percent' });

/** Categories rendered in Theme Designer (curated for direct, visible impact). */
export const THEME_TOKEN_CATEGORIES: ThemeTokenCategory[] = [
  {
    id: 'brand',
    label: 'Brand colors',
    description: 'Primary accent scale — buttons, active nav, focus, and brand mark only.',
    tokens: [
      hex('--app-accent-500', 'Brand', 'Identity color (logo). Button fills use the AA-safe 600 stop.'),
      hex('--app-accent-600', 'Brand fill', 'Primary button fill — WCAG AA with white text.'),
      hex('--app-accent-700', 'Brand ink', 'Active nav text/icon and strong accents on paper.'),
      hex('--app-accent-subtle', 'Brand tint', 'Active nav row fill and other small-area tints.'),
    ],
  },
  {
    id: 'surfaces',
    label: 'Surfaces',
    description: 'Page, chrome frost, and card fills. These tokens paint the live shell; the accent generator still defaults to slate.',
    tokens: [
      toggle(
        '--app-atmosphere-geometry',
        'Geometric shapes',
        'Decorative geometry behind sidebar, header, and page chrome. On by default.',
      ),
      percent(
        '--app-sidebar-fill-opacity',
        'Sidebar fill',
        'How solid the sidebar frost is. 0% shows atmosphere; 100% is opaque shell fill.',
      ),
      percent(
        '--app-header-fill-opacity',
        'Header fill',
        'How solid the top bar frost is. 0% shows atmosphere; 100% is opaque shell fill.',
      ),
      percent(
        '--app-menu-texture-opacity',
        'Menu texture',
        'Line and dot texture on the sidebar. 0% is off; 100% is full strength.',
      ),
      percent(
        '--app-header-texture-opacity',
        'Header texture',
        'Line and dot texture on the top bar. 0% is off; 100% is full strength.',
      ),
      hex('--app-shell-bg', 'Shell background', 'Page / chrome backdrop — slate-50 by default.'),
      hex('--app-accent-muted', 'Muted accent tint', 'Small-area muted tint (chips), not chrome fill.'),
      hex('--app-accent-soft', 'Soft accent tint', 'Small-area soft tint, not chrome fill.'),
      hex('--app-accent-wash', 'Accent wash', 'Reserved for loading splash radials, not chrome.'),
      hex('--app-accent-wash-strong', 'Strong wash', 'Stronger small-area tint.'),
      hex('--color-surface-elevated', 'Elevated cards', 'Raised card and panel surface (white).'),
    ],
  },
  {
    id: 'borders',
    label: 'Borders',
    description: 'Outline and divider tones.',
    tokens: [
      hex('--app-accent-border', 'Accent border', 'Small-area accent outline (chips), not chrome.'),
      hex('--app-accent-border-strong', 'Accent divider', 'Small-area accent divider.'),
      hex('--app-shell-content-border', 'Content panel border', 'Main content host outline (slate).'),
      hex('--app-nav-group-border', 'Nav group border', 'Nav section hairline (slate).'),
    ],
  },
  {
    id: 'atmosphere',
    label: 'Atmosphere channels',
    description: 'RGB channels that tint glows, shadows, and overlays (not direct fill colors).',
    tokens: [
      rgb('--app-accent-rgb', 'Primary channel', 'Primary-tinted glows, shadows, and patterns.'),
      rgb('--app-accent-secondary-rgb', 'Secondary channel', 'Complementary overlay hue (+42°).'),
      rgb('--app-accent-tertiary-rgb', 'Tertiary channel', 'Triadic overlay hue (+196°).'),
    ],
  },
  {
    id: 'logo',
    label: 'Logo mark',
    description: 'Three gradient stops — the logo gradient is rebuilt automatically from these.',
    tokens: [
      hex('--app-logo-from', 'Logo start', 'Gradient start stop.'),
      hex('--app-logo-via', 'Logo mid', 'Gradient midpoint stop.'),
      hex('--app-logo-to', 'Logo end', 'Gradient end stop.'),
    ],
  },
  {
    id: 'nav',
    label: 'Navigation chrome',
    description: 'Sidebar section titles, active-row fill/gradient/shadow, and hover wash.',
    tokens: [
      hex('--app-nav-group-header-edge', 'Group header edge', 'Nav section header gradient edge.'),
      hex('--app-nav-group-header-edge-active', 'Group edge (active)', 'Expanded section header edge.'),
      hex('--app-nav-group-header-center', 'Group header center', 'Nav section header center band.'),
      css('--app-nav-group-header-center-band', 'Header band height', 'Center band thickness (e.g. 3px).'),
      hex('--app-nav-group-header-text', 'Group header text', 'Section title ink color.'),
      hex('--app-nav-item-active-bg', 'Active item fill', 'Selected nav row background.'),
      hex('--color-nav-item-hover-bg', 'Item hover wash', 'Nav row hover background.'),
    ],
  },
  {
    id: 'effects',
    label: 'Focus & elevation',
    description: 'Shadows and rings with visible daily impact.',
    tokens: [
      css('--shadow-cyan-ring-sm', 'Focus ring (sm)', 'Small focus / selection ring.'),
      css('--shadow-cyan-ring-md', 'Focus ring (md)', 'Medium focus ring.'),
      css('--shadow-nav-active', 'Nav item shadow', 'Active nav item elevation.'),
      css('--shadow-nav-active-strong', 'Nav shadow (strong)', 'Strong active nav depth.'),
      css('--shadow-content-host', 'Content shadow', 'Main content panel drop shadow.'),
      css('--shadow-emerald-glow-md', 'Accent glow', 'Medium accent spread glow.'),
    ],
  },
  {
    id: 'interaction',
    label: 'Interaction & pattern',
    description: 'Nav interaction sweeps and menu/header atmosphere overlays.',
    tokens: [
      gradient('--gradient-nav-item-hover-shimmer', 'Nav hover shimmer', 'Hover sweep on nav rows.'),
      gradient('--gradient-nav-item-active', 'Nav active fill', 'Active row gradient fill.'),
      gradient('--gradient-pattern-menu-overlay', 'Menu overlay', 'Sidebar pattern tint overlay. Visible when Menu texture is above 0%.'),
      gradient('--gradient-pattern-header-overlay', 'Header overlay', 'Top bar pattern tint overlay. Visible when Header texture is above 0%.'),
      css('--color-pattern-grid-line', 'Pattern grid', 'Menu/header line pattern stroke. Visible when chrome texture is above 0%.'),
    ],
  },
];

export const THEME_TOKEN_DEFINITIONS: ThemeTokenDefinition[] = THEME_TOKEN_CATEGORIES.flatMap(
  (category) => category.tokens,
);

/** Keys exposed in Theme Designer. */
export const THEME_TOKEN_KEYS: string[] = THEME_TOKEN_DEFINITIONS.map((token) => token.key);

export const THEME_TOKEN_DEFINITION_BY_KEY: ReadonlyMap<string, ThemeTokenDefinition> = new Map(
  THEME_TOKEN_DEFINITIONS.map((token) => [token.key, token]),
);

/** Swatch keys shown in list cards and preset switcher rows. */
export const THEME_PRESET_PREVIEW_TOKEN_KEYS = [
  '--app-accent-500',
  '--app-shell-bg',
  '--app-accent-600',
  '--app-accent-700',
] as const;
