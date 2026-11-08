import {
  ATMOSPHERE_GEOMETRY_ON,
  ATMOSPHERE_GEOMETRY_TOKEN_KEY,
  syncAtmosphereGeometryDocumentAttr,
} from './atmosphereGeometry';
import {
  CHROME_OPACITY_DEFAULT,
  HEADER_FILL_TOKEN_KEY,
  HEADER_TEXTURE_TOKEN_KEY,
  MENU_TEXTURE_TOKEN_KEY,
  SIDEBAR_FILL_TOKEN_KEY,
} from './chromeFinish';
import {
  NEUTRAL_SURFACE,
  NEUTRAL_TEXT,
  SEMANTIC_STATUS_RGB,
  WCAG_AA_CONTRAST,
} from './colorTokens';

export const DEFAULT_ACCENT_HEX = '#00A28A';
export const ACCENT_STORAGE_KEY = 'appendo-accent-color';
/** First-paint splash cache — keep the key in sync with the hydrate script in `index.html`. */
export const ACCENT_CSS_STORAGE_KEY = 'appendo-accent-css-v3';
const ACCENT_CSS_VAR_KEY = /^--[a-z0-9-]+$/i;

export type AccentPaletteSource = 'default' | 'spectrum' | 'fluent' | 'material';

export type AccentThemeState = {
  hex: string;
  source: AccentPaletteSource;
};

export type AccentCssTokens = {
  base: string;
  hover: string;
  active: string;
  subtle: string;
  muted: string;
  soft: string;
  wash: string;
  washStrong: string;
  border: string;
  borderStrong: string;
  contentBorder: string;
  rgb: string;
  rgbSecondary: string;
  rgbTertiary: string;
  logoVia: string;
  logoTo: string;
  navGroup: string;
  navGroupActive: string;
  navItemActive: string;
};

const HEX_PATTERN = /^#([0-9a-fA-F]{6})$/;

export const normalizeHex = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!HEX_PATTERN.test(trimmed)) return null;
  return `#${trimmed.slice(1).toUpperCase()}`;
};

type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };

const clamp = (value: number, min: number, max: number): number => (
  Math.min(max, Math.max(min, value))
);

export const hexToRgb = (hex: string): Rgb => {
  const normalized = normalizeHex(hex) ?? DEFAULT_ACCENT_HEX;
  const value = Number.parseInt(normalized.slice(1), 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
};

const rgbToHex = ({ r, g, b }: Rgb): string => (
  `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('').toUpperCase()}`
);

const rgbToHsl = ({ r, g, b }: Rgb): Hsl => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  const l = (max + min) / 2;
  let s = 0;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rn:
        h = ((gn - bn) / delta) % 6;
        break;
      case gn:
        h = (bn - rn) / delta + 2;
        break;
      default:
        h = (rn - gn) / delta + 4;
        break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s: s * 100, l: l * 100 };
};

const hslToRgb = ({ h, s, l }: Hsl): Rgb => {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let rp = 0;
  let gp = 0;
  let bp = 0;

  if (h < 60) {
    rp = c; gp = x;
  } else if (h < 120) {
    rp = x; gp = c;
  } else if (h < 180) {
    gp = c; bp = x;
  } else if (h < 240) {
    gp = x; bp = c;
  } else if (h < 300) {
    rp = x; bp = c;
  } else {
    rp = c; bp = x;
  }

  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
};

const hslToHex = (hsl: Hsl): string => rgbToHex(hslToRgb(hsl));

/** Default nav-header lift when depth is unknown (mid accents). */
const NAV_GROUP_HEADER_LIGHTEN_DEGREES = 14;

/** Main-menu section header labels sit this many HSL lightness degrees darker than primary-700. */
const NAV_GROUP_HEADER_DARKEN_DEGREES = 24;

/** Heavy center band extends this many pixels above/below vertical midpoint. */
const NAV_GROUP_HEADER_CENTER_BAND_PX = 3;

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

const channelToLinear = (channel: number): number => {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

const relativeLuminanceFromHex = (hex: string): number => {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
};

/** WCAG contrast ratio between two hex colors. */
export const contrastRatioHex = (foreground: string, background: string): number => {
  const lighter = Math.max(relativeLuminanceFromHex(foreground), relativeLuminanceFromHex(background));
  const darker = Math.min(relativeLuminanceFromHex(foreground), relativeLuminanceFromHex(background));
  return (lighter + 0.05) / (darker + 0.05);
};

const saturateForInk = (hsl: Hsl): Hsl => (
  hsl.s < 8
    ? hsl
    : { ...hsl, s: clamp(Math.max(hsl.s, 42), 42, 90) }
);

/** Darken (or lighten on dark paper) until WCAG AA against the background. */
const ensureContrastOnBackground = (
  foreground: string,
  background: string,
  minRatio = WCAG_AA_CONTRAST,
): string => {
  const backgroundIsLight = relativeLuminanceFromHex(background) > 0.45;
  let hsl = saturateForInk(rgbToHsl(hexToRgb(foreground)));
  for (let step = 0; step < 48; step += 1) {
    const candidate = hslToHex(hsl);
    if (contrastRatioHex(candidate, background) >= minRatio) {
      return candidate;
    }
    hsl = {
      ...hsl,
      l: clamp(hsl.l + (backgroundIsLight ? -2.5 : 2.5), 8, 92),
    };
  }
  return hslToHex(hsl);
};

/** Darken a fill until white label text meets WCAG AA. */
export const ensureFillContrastsWhite = (fill: string, minRatio = WCAG_AA_CONTRAST): string => {
  let hsl = saturateForInk(rgbToHsl(hexToRgb(fill)));
  for (let step = 0; step < 48; step += 1) {
    const candidate = hslToHex(hsl);
    if (contrastRatioHex('#FFFFFF', candidate) >= minRatio) {
      return candidate;
    }
    hsl = { ...hsl, l: clamp(hsl.l - 2.5, 8, 92) };
  }
  return hslToHex(hsl);
};

/**
 * 0 = light accent (pastel identity), 1 = deep accent.
 * Anchored so Fluent tint40≈0 and shade40≈1. Depth no longer tints chrome.
 */
export const accentDepthFromLightness = (lightness: number): number => (
  clamp((62 - lightness) / 54, 0, 1)
);

const lightenHex = (hex: string, lightnessDelta = NAV_GROUP_HEADER_LIGHTEN_DEGREES): string => {
  const hsl = rgbToHsl(hexToRgb(hex));
  return hslToHex({ ...hsl, l: clamp(hsl.l + lightnessDelta, 0, 100) });
};

const buildNavGroupHeaderGradient = (
  edge: string,
  center: string,
  centerBandPx = NAV_GROUP_HEADER_CENTER_BAND_PX,
): string => (
  `linear-gradient(180deg, ${edge} 0%, ${center} calc(50% - ${centerBandPx}px), ${center} calc(50% + ${centerBandPx}px), ${edge} 100%)`
);

const mixWithWhite = (hex: string, whiteRatio: number): string => {
  const { r, g, b } = hexToRgb(hex);
  const ratio = clamp(whiteRatio, 0, 1);
  return rgbToHex({
    r: Math.round(r + (255 - r) * ratio),
    g: Math.round(g + (255 - g) * ratio),
    b: Math.round(b + (255 - b) * ratio),
  });
};

const rgbString = (hex: string): string => {
  const { r, g, b } = hexToRgb(hex);
  return `${r} ${g} ${b}`;
};

/**
 * Loading splash and shell root paper — slate field with readable accent radials.
 * Chrome (sidebar/header) stays transparent so this wash and the geometric atmosphere show through.
 */
const buildShellAtmosphereGradient = (
  tokens: AccentCssTokens,
  depth = accentDepthFromLightness(rgbToHsl(hexToRgb(tokens.base)).l),
): string => {
  const a1 = lerp(0.11, 0.18, depth);
  const a2 = lerp(0.08, 0.14, depth);
  const a3 = lerp(0.06, 0.11, depth);
  return [
    `radial-gradient(ellipse 100% 68% at -6% -10%, rgb(${tokens.rgb} / ${a1}) 0%, transparent 50%)`,
    `radial-gradient(ellipse 78% 56% at 106% 104%, rgb(${tokens.rgbSecondary} / ${a2}) 0%, transparent 46%)`,
    `radial-gradient(ellipse 62% 36% at 76% 2%, rgb(${tokens.rgbTertiary} / ${a3}) 0%, transparent 42%)`,
    `linear-gradient(180deg, ${NEUTRAL_SURFACE.page} 0%, ${NEUTRAL_SURFACE.page} 100%)`,
  ].join(', ');
};

/** Mirror horizontal gradient anchor positions for RTL shell chrome. */
export const mirrorShellAtmosphereGradient = (gradient: string): string => (
  gradient.replace(
    /\bat\s+(-?\d+(?:\.\d+)?%)\s+(-?\d+(?:\.\d+)?%)/g,
    (_match, x: string, y: string) => {
      const mirroredX = 100 - Number.parseFloat(x);
      const xLabel = x.endsWith('%') ? `${mirroredX}%` : String(mirroredX);
      return `at ${xLabel} ${y}`;
    },
  )
);

const resolveShellAtmosphereGradientForDirection = (
  ltrGradient: string,
  direction: 'ltr' | 'rtl',
): string => (direction === 'rtl' ? mirrorShellAtmosphereGradient(ltrGradient) : ltrGradient);

const SHELL_ATMOSPHERE_LTR_VAR = '--gradient-shell-atmosphere-ltr';
const SHADOW_CONTENT_HOST_LTR_VAR = '--shadow-content-host-ltr';
const GRADIENT_PATTERN_HEADER_OVERLAY_LTR_VAR = '--gradient-pattern-header-overlay-ltr';
const GRADIENT_PATTERN_HEADER_DARKEN_LTR_VAR = '--gradient-pattern-header-darken-ltr';

/** Flip the horizontal offset on shell content-host lift shadows (e.g. -6px 0 → 6px 0). */
export const mirrorHorizontalPxBoxShadow = (shadow: string): string => (
  shadow.replace(/(-?\d+(?:\.\d+)?)px\s+0/g, (_match, px: string) => {
    const value = Number.parseFloat(px);
    if (value === 0) {
      return '0 0';
    }
    return `${-value}px 0`;
  })
);

/** Mirror linear-gradient angles used on header chrome textures (90deg ↔ 270deg). */
const mirrorLinearGradientAngle = (gradient: string): string => (
  gradient.replace(/\b(90|270)deg\b/g, (deg) => (deg === '90' ? '270deg' : '90deg'))
);

const readLtrThemeToken = (root: HTMLElement, ltrVar: string, fallbackVar: string): string => (
  root.style.getPropertyValue(ltrVar).trim()
  || root.style.getPropertyValue(fallbackVar).trim()
);

/** Re-apply shell tokens that must mirror when `dir` is rtl (inline accent theme overrides CSS). */
export const syncAdminShellDirectionalThemeTokens = (
  root: HTMLElement,
  direction: 'ltr' | 'rtl',
): void => {
  const atmosphereLtr = readLtrThemeToken(root, SHELL_ATMOSPHERE_LTR_VAR, '--gradient-shell-atmosphere');
  if (atmosphereLtr) {
    root.style.setProperty(
      '--gradient-shell-atmosphere',
      resolveShellAtmosphereGradientForDirection(atmosphereLtr, direction),
    );
  }

  const shadowLtr = readLtrThemeToken(root, SHADOW_CONTENT_HOST_LTR_VAR, '--shadow-content-host');
  if (shadowLtr) {
    root.style.setProperty(
      '--shadow-content-host',
      direction === 'rtl' ? mirrorHorizontalPxBoxShadow(shadowLtr) : shadowLtr,
    );
  }

  const headerOverlayLtr = readLtrThemeToken(
    root,
    GRADIENT_PATTERN_HEADER_OVERLAY_LTR_VAR,
    '--gradient-pattern-header-overlay',
  );
  if (headerOverlayLtr) {
    root.style.setProperty(
      '--gradient-pattern-header-overlay',
      direction === 'rtl' ? mirrorLinearGradientAngle(headerOverlayLtr) : headerOverlayLtr,
    );
  }

  const headerDarkenLtr = readLtrThemeToken(
    root,
    GRADIENT_PATTERN_HEADER_DARKEN_LTR_VAR,
    '--gradient-pattern-header-darken',
  );
  if (headerDarkenLtr) {
    root.style.setProperty(
      '--gradient-pattern-header-darken',
      direction === 'rtl' ? mirrorLinearGradientAngle(headerDarkenLtr) : headerDarkenLtr,
    );
  }
};

/** @deprecated Use syncAdminShellDirectionalThemeTokens */
const syncShellAtmosphereGradientDirection = syncAdminShellDirectionalThemeTokens;

const buildAtmosphere = (
  baseHsl: Hsl,
  base: string,
  depth = accentDepthFromLightness(baseHsl.l),
): Omit<AccentCssTokens, 'base' | 'hover' | 'active' | 'subtle'> => {
  const secondary = hslToHex({
    h: (baseHsl.h + 42) % 360,
    s: clamp(baseHsl.s * lerp(0.55, 0.78, depth), 28, 76),
    l: clamp(lerp(baseHsl.l + 8, baseHsl.l + 3, depth), 28, 52),
  });
  const tertiary = hslToHex({
    h: (baseHsl.h + 196) % 360,
    s: clamp(baseHsl.s * lerp(0.42, 0.6, depth), 20, 62),
    l: clamp(lerp(baseHsl.l + 12, baseHsl.l + 7, depth), 32, 56),
  });

  // Small-area tints only (chips, active-row fill). Never used as chrome/page fills.
  return {
    muted: hslToHex({
      h: baseHsl.h,
      s: clamp(baseHsl.s * lerp(0.08, 0.16, depth), 4, 18),
      l: lerp(97.5, 95, depth),
    }),
    soft: hslToHex({
      h: baseHsl.h,
      s: clamp(baseHsl.s * lerp(0.05, 0.12, depth), 3, 14),
      l: lerp(98.8, 97, depth),
    }),
    wash: hslToHex({
      h: baseHsl.h,
      s: clamp(baseHsl.s * lerp(0.08, 0.16, depth), 4, 18),
      l: lerp(97, 95, depth),
    }),
    washStrong: hslToHex({
      h: baseHsl.h,
      s: clamp(baseHsl.s * lerp(0.1, 0.2, depth), 6, 22),
      l: lerp(94, 91, depth),
    }),
    border: hslToHex({
      h: baseHsl.h,
      s: clamp(baseHsl.s * lerp(0.08, 0.18, depth), 4, 20),
      l: lerp(90, 86, depth),
    }),
    borderStrong: hslToHex({
      h: baseHsl.h,
      s: clamp(baseHsl.s * lerp(0.1, 0.2, depth), 5, 22),
      l: lerp(86, 82, depth),
    }),
    contentBorder: NEUTRAL_SURFACE.border,
    rgb: rgbString(base),
    rgbSecondary: rgbString(secondary),
    rgbTertiary: rgbString(tertiary),
    logoVia: secondary,
    logoTo: tertiary,
    navGroup: NEUTRAL_SURFACE.page,
    navGroupActive: NEUTRAL_SURFACE.page,
    navItemActive: hslToHex({
      h: baseHsl.h,
      s: clamp(baseHsl.s * lerp(0.06, 0.12, depth), 4, 16),
      l: lerp(98.5, 96.5, depth),
    }),
  };
};

const inkFromHue = (hsl: Hsl): string => {
  const onCard = ensureContrastOnBackground(
    hslToHex(saturateForInk({ ...hsl, l: clamp(hsl.l, 22, 38) })),
    NEUTRAL_SURFACE.card,
  );
  return ensureContrastOnBackground(onCard, NEUTRAL_SURFACE.page);
};

const fillFromHue = (hsl: Hsl, lightness: number): string => (
  ensureFillContrastsWhite(hslToHex(saturateForInk({ ...hsl, l: lightness })))
);

/** Harmonize free-picked colors into AA-safe ink/fill. Chrome surfaces stay neutral. */
export const harmonizeAccentHex = (hex: string, preserveExact = false): AccentCssTokens => {
  const normalized = normalizeHex(hex) ?? DEFAULT_ACCENT_HEX;
  const hsl = rgbToHsl(hexToRgb(normalized));

  if (preserveExact) {
    const base = normalized;
    const baseHsl = rgbToHsl(hexToRgb(base));
    const depth = accentDepthFromLightness(baseHsl.l);
    const hover = fillFromHue(baseHsl, clamp(baseHsl.l, 28, 42));
    const active = inkFromHue(baseHsl);
    const atmosphereHsl = saturateForInk({
      ...baseHsl,
      l: clamp(baseHsl.l, 28, 48),
    });
    return {
      base,
      hover,
      active,
      subtle: mixWithWhite(active, lerp(0.88, 0.82, depth)),
      ...buildAtmosphere(atmosphereHsl, hover, depth),
    };
  }

  const baseHsl: Hsl = {
    h: hsl.h,
    s: clamp(hsl.s, 44, 90),
    l: clamp(hsl.l, 30, 42),
  };
  const depth = accentDepthFromLightness(baseHsl.l);
  const base = fillFromHue(baseHsl, baseHsl.l);

  return {
    base,
    hover: fillFromHue(baseHsl, clamp(baseHsl.l - 6, 24, 40)),
    active: inkFromHue(baseHsl),
    subtle: hslToHex({
      h: baseHsl.h,
      s: clamp(baseHsl.s * 0.28, 8, 22),
      l: lerp(97.5, 95, depth),
    }),
    ...buildAtmosphere(baseHsl, base, depth),
  };
};

export const buildAccentCssVars = (tokens: AccentCssTokens): Record<string, string> => {
  const baseLightness = rgbToHsl(hexToRgb(tokens.base)).l;
  const depth = accentDepthFromLightness(baseLightness);
  const buttonFill = tokens.hover;
  const ink = tokens.active;
  const navHeaderEdge = NEUTRAL_SURFACE.page;
  const navHeaderCenter = NEUTRAL_SURFACE.page;
  const navGroupHeaderGradient = buildNavGroupHeaderGradient(navHeaderEdge, navHeaderCenter);
  const glow = (lightAlpha: number, deepAlpha: number) => lerp(lightAlpha, deepAlpha, depth);
  const inkRgb = '15 23 42';
  const shellAtmosphereLtr = buildShellAtmosphereGradient(tokens, depth);
  const shadowContentHostLtr = '-6px 0 16px -8px rgb(15 23 42 / 0.045)';
  const gradientPatternHeaderOverlayLtr = `linear-gradient(90deg, rgb(${inkRgb} / 0.03) 0%, rgb(${inkRgb} / 0.015) 40%, rgb(255 255 255 / 0) 72%)`;
  const gradientPatternHeaderDarkenLtr = `linear-gradient(90deg, rgb(${inkRgb} / 0.02) 0%, rgb(${inkRgb} / 0.04) 100%)`;

  return {
  '--app-accent-500': tokens.base,
  '--app-accent-600': buttonFill,
  '--app-accent-700': ink,
  '--app-accent-subtle': tokens.subtle,
  '--app-accent-muted': tokens.muted,
  '--app-accent-soft': tokens.soft,
  '--app-accent-wash': tokens.wash,
  '--app-accent-wash-strong': tokens.washStrong,
  '--app-accent-border': tokens.border,
  '--app-accent-border-strong': tokens.borderStrong,
  '--app-accent-rgb': tokens.rgb,
  '--app-accent-secondary-rgb': tokens.rgbSecondary,
  '--app-accent-tertiary-rgb': tokens.rgbTertiary,
  '--app-logo-from': tokens.base,
  '--app-logo-via': tokens.logoVia,
  '--app-logo-to': tokens.logoTo,
  '--app-shell-bg': NEUTRAL_SURFACE.page,
  [ATMOSPHERE_GEOMETRY_TOKEN_KEY]: ATMOSPHERE_GEOMETRY_ON,
  [SIDEBAR_FILL_TOKEN_KEY]: CHROME_OPACITY_DEFAULT,
  [HEADER_FILL_TOKEN_KEY]: CHROME_OPACITY_DEFAULT,
  [MENU_TEXTURE_TOKEN_KEY]: CHROME_OPACITY_DEFAULT,
  [HEADER_TEXTURE_TOKEN_KEY]: CHROME_OPACITY_DEFAULT,
  '--app-nav-hover': NEUTRAL_SURFACE.muted,
  '--app-nav-group': navHeaderEdge,
  '--app-nav-group-active': navHeaderCenter,
  '--app-nav-group-header-edge': navHeaderEdge,
  '--app-nav-group-header-edge-active': navHeaderEdge,
  '--app-nav-group-header-center': navHeaderCenter,
  '--app-nav-group-header-center-band': `${NAV_GROUP_HEADER_CENTER_BAND_PX}px`,
  '--app-nav-group-header-text': NEUTRAL_TEXT.body,
  '--app-nav-group-border': NEUTRAL_SURFACE.border,
  '--app-nav-item-active-bg': tokens.navItemActive,
  '--app-shell-content-border': NEUTRAL_SURFACE.border,
  [SHELL_ATMOSPHERE_LTR_VAR]: shellAtmosphereLtr,
  '--gradient-shell-atmosphere': shellAtmosphereLtr,
  [SHADOW_CONTENT_HOST_LTR_VAR]: shadowContentHostLtr,
  [GRADIENT_PATTERN_HEADER_OVERLAY_LTR_VAR]: gradientPatternHeaderOverlayLtr,
  [GRADIENT_PATTERN_HEADER_DARKEN_LTR_VAR]: gradientPatternHeaderDarkenLtr,
  '--gradient-app-logo': `linear-gradient(105deg, ${tokens.base} 0%, ${tokens.logoVia} 48%, ${tokens.logoTo} 100%)`,

  '--color-primary-500': tokens.base,
  '--color-primary-600': buttonFill,
  '--color-primary-700': ink,
  '--color-primary-subtle': tokens.subtle,
  '--color-surface-shell': NEUTRAL_SURFACE.page,
  '--color-surface-modal-tint': NEUTRAL_SURFACE.card,
  '--color-surface-panel-muted': NEUTRAL_SURFACE.muted,
  '--color-surface-elevated': NEUTRAL_SURFACE.card,
  '--color-border-subtle': NEUTRAL_SURFACE.border,
  '--color-border-divider': NEUTRAL_SURFACE.divider,
  '--color-shell-content-border': NEUTRAL_SURFACE.border,
  '--color-nav-hover': NEUTRAL_SURFACE.muted,
  '--color-nav-group': navHeaderEdge,
  '--color-nav-group-active': navHeaderCenter,
  '--color-nav-group-header': NEUTRAL_TEXT.body,
  '--color-nav-item-active-bg': tokens.navItemActive,
  '--color-nav-active': tokens.navItemActive,
  '--color-picker-default': tokens.base,
  '--color-text-nav': NEUTRAL_TEXT.nav,
  '--color-text-nav-icon': NEUTRAL_TEXT.navIcon,
  '--color-text-body': NEUTRAL_TEXT.body,
  '--color-text-ink': NEUTRAL_TEXT.ink,

  '--color-primary-glow-a055': `rgb(${tokens.rgb} / ${glow(0.1, 0.2)})`,
  '--color-primary-glow-a03': `rgb(${tokens.rgb} / ${glow(0.07, 0.14)})`,
  '--color-primary-glow-a02': `rgb(${tokens.rgb} / ${glow(0.045, 0.09)})`,
  '--color-emerald-glow-a035': `rgb(${SEMANTIC_STATUS_RGB.success} / 0.09)`,
  '--color-emerald-glow-a14': `rgb(${SEMANTIC_STATUS_RGB.success} / 0.16)`,
  '--color-emerald-glow-a22': `rgb(${SEMANTIC_STATUS_RGB.success} / 0.24)`,
  '--color-emerald-glow-a45': `rgb(${SEMANTIC_STATUS_RGB.success} / 0.42)`,
  '--color-indigo-glow-a12': `rgb(${tokens.rgbSecondary} / ${glow(0.08, 0.16)})`,
  '--color-indigo-glow-a16': `rgb(${tokens.rgbSecondary} / ${glow(0.11, 0.22)})`,
  '--color-indigo-glow-a20': `rgb(${tokens.rgbSecondary} / ${glow(0.14, 0.28)})`,
  '--color-indigo-glow-a35': `rgb(${tokens.rgbSecondary} / ${glow(0.2, 0.38)})`,
  '--color-sky-glow-a14': `rgb(${tokens.rgbTertiary} / ${glow(0.09, 0.18)})`,
  '--color-cyan-glow-a14': `rgb(${tokens.rgbTertiary} / ${glow(0.09, 0.18)})`,
  '--color-cyan-glow-a18': `rgb(${tokens.rgbTertiary} / ${glow(0.12, 0.24)})`,
  '--color-pattern-grid-line': `rgb(${tokens.rgb} / ${glow(0.36, 0.54)})`,
  '--color-slate-border-a06': `rgb(${inkRgb} / 0.06)`,

  '--shadow-cyan-ring-sm': `0 0 0 2px rgb(${tokens.rgb} / ${glow(0.12, 0.22)})`,
  '--shadow-cyan-ring-md': `0 0 0 2px rgb(${tokens.rgb} / ${glow(0.16, 0.3)})`,
  '--shadow-emerald-glow-md': `0 0 18px rgb(var(--app-accent-rgb) / 0.34)`,
  '--shadow-nav-group-inset': 'none',
  '--shadow-nav-separator-outset': `0 1px 0 rgb(${inkRgb} / 0.04)`,
  '--shadow-nav-active': `0 1px 3px rgb(${tokens.rgb} / ${glow(0.08, 0.15)}), 0 0 0 1px rgb(${tokens.rgb} / ${glow(0.05, 0.1)})`,
  '--shadow-nav-active-strong': `inset 0 1px 0 rgb(255 255 255 / 0.94), inset 0 0 0 1px rgb(${tokens.rgb} / ${glow(0.05, 0.09)}), 0 2px 10px rgb(${tokens.rgb} / ${glow(0.08, 0.15)}), 0 1px 4px rgb(0 0 0 / 0.06)`,
  '--shadow-content-host': shadowContentHostLtr,

  '--gradient-pattern-menu-darken': `linear-gradient(180deg, rgb(${inkRgb} / 0.02) 0%, rgb(${inkRgb} / 0.04) 100%)`,
  '--gradient-pattern-header-darken': gradientPatternHeaderDarkenLtr,
  '--gradient-nav-group': navGroupHeaderGradient,
  '--gradient-nav-group-active': navGroupHeaderGradient,
  '--gradient-nav-group-header': navGroupHeaderGradient,
  '--gradient-nav-group-header-active': navGroupHeaderGradient,
  '--gradient-pattern-menu-overlay': `linear-gradient(165deg, rgb(${inkRgb} / 0.03) 0%, rgb(${inkRgb} / 0.015) 42%, rgb(255 255 255 / 0) 74%)`,
  '--gradient-pattern-header-overlay': gradientPatternHeaderOverlayLtr,
  '--gradient-nav-item-hover-shimmer': `linear-gradient(110deg, transparent 0%, rgb(${inkRgb} / 0.04) 44%, rgb(${inkRgb} / 0.025) 56%, transparent 100%)`,
  '--gradient-nav-item-active': `linear-gradient(135deg, ${NEUTRAL_SURFACE.card} 0%, ${tokens.subtle} 36%, ${NEUTRAL_SURFACE.card} 100%)`,
  '--color-nav-item-hover-bg': NEUTRAL_SURFACE.muted,
  '--gradient-surface-workspace': `linear-gradient(135deg, ${NEUTRAL_SURFACE.page} 0%, ${NEUTRAL_SURFACE.card} 48%, ${NEUTRAL_SURFACE.muted} 100%)`,
  };
};

const isSafeAccentCssVar = (key: string, value: unknown): value is string => (
  ACCENT_CSS_VAR_KEY.test(key) && typeof value === 'string' && value.length > 0 && !value.includes('<')
);

const syncThemeColorMeta = (hex: string): void => {
  if (typeof document === 'undefined') return;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', hex);
  }
};

export const persistAccentCssVars = (vars: Record<string, string>): void => {
  if (typeof window === 'undefined') return;
  try {
    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(vars)) {
      if (isSafeAccentCssVar(key, value)) {
        sanitized[key] = value;
      }
    }
    window.localStorage.setItem(ACCENT_CSS_STORAGE_KEY, JSON.stringify(sanitized));
  } catch {
    // quota / private mode
  }
};

export const cacheAccentThemeCssVars = (hex: string, preserveExact = false): void => {
  persistAccentCssVars(buildAccentCssVars(harmonizeAccentHex(hex, preserveExact)));
};

export const applyCachedAccentCssVarsToDocument = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(ACCENT_CSS_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
    const root = document.documentElement;
    let applied = false;
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!isSafeAccentCssVar(key, value)) continue;
      root.style.setProperty(key, value);
      applied = true;
    }
    const accent = root.style.getPropertyValue('--app-accent-500').trim();
    if (accent) {
      syncThemeColorMeta(accent);
    }
    if (applied) {
      syncAdminShellDirectionalThemeTokens(
        root,
        root.getAttribute('dir') === 'rtl' ? 'rtl' : 'ltr',
      );
      const geometry = (parsed as Record<string, unknown>)[ATMOSPHERE_GEOMETRY_TOKEN_KEY];
      syncAtmosphereGeometryDocumentAttr(
        root,
        typeof geometry === 'string' ? geometry : undefined,
      );
    }
    return applied;
  } catch {
    return false;
  }
};

export const applyAccentThemeToDocument = (hex: string, preserveExact = false): AccentCssTokens => {
  const tokens = harmonizeAccentHex(hex, preserveExact);
  const vars = buildAccentCssVars(tokens);
  const root = document.documentElement;

  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  syncAdminShellDirectionalThemeTokens(
    root,
    root.getAttribute('dir') === 'rtl' ? 'rtl' : 'ltr',
  );
  syncAtmosphereGeometryDocumentAttr(root, vars[ATMOSPHERE_GEOMETRY_TOKEN_KEY]);
  syncThemeColorMeta(tokens.base);

  return tokens;
};

export const readStoredAccentTheme = (): AccentThemeState | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(ACCENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AccentThemeState>;
    const hex = normalizeHex(parsed.hex ?? '');
    if (!hex) return null;
    const source = parsed.source ?? 'fluent';
    return { hex, source };
  } catch {
    return null;
  }
};

export const persistAccentTheme = (state: AccentThemeState): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACCENT_STORAGE_KEY, JSON.stringify(state));
  const preserveExact = state.source === 'fluent' || state.source === 'material';
  cacheAccentThemeCssVars(state.hex, preserveExact);
};
