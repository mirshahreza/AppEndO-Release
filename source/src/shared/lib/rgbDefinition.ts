import { clamp, colorToRgba, parseCssColor, rgbToHex } from './colorMath';

export type RgbSourceMode = 'variable' | 'literal';

export type RgbDefinition = {
  mode: RgbSourceMode;
  variable: string;
  fallback: string;
  includeFallback: boolean;
  r: number;
  g: number;
  b: number;
  alpha: number;
};

export type RgbVariableOption = {
  name: string;
  label: string;
  fallback?: string;
};

export const DEFAULT_RGB_VARIABLES: readonly RgbVariableOption[] = [
  { name: '--app-accent-rgb', label: 'Accent', fallback: '0 162 138' },
  { name: '--app-accent-secondary-rgb', label: 'Secondary', fallback: '0 130 120' },
  { name: '--app-accent-tertiary-rgb', label: 'Tertiary', fallback: '0 110 150' },
];

const CSS_VARIABLE_NAME = /^--[a-zA-Z0-9-]+$/;
const VARIABLE_RGB_CSS = /^rgba?\(\s*var\(\s*(--[a-zA-Z0-9-]+)\s*(?:,\s*([^)]*?))?\s*\)\s*(?:\/\s*([^)]+))?\s*\)$/i;
const LITERAL_SPACE_RGB_CSS = /^rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([^)]+))?\s*\)$/i;
const SPACE_RGB_CHANNELS = /^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})$/;

const clampChannel = (value: number): number => clamp(Math.round(value), 0, 255);

const parseAlphaToken = (raw: string | undefined): number => {
  if (raw == null || raw.trim() === '') {
    return 1;
  }
  const parsed = Number(raw.trim());
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return clamp(parsed, 0, 1);
};

export const formatRgbAlpha = (alpha: number): string => {
  const clamped = clamp(alpha, 0, 1);
  if (clamped === 0) {
    return '0';
  }
  if (clamped === 1) {
    return '1';
  }
  const asString = clamped.toString();
  if (/e/i.test(asString)) {
    return clamped.toFixed(16).replace(/\.?0+$/, '');
  }
  return asString;
};

export const formatRgbChannels = (r: number, g: number, b: number): string => (
  `${clampChannel(r)} ${clampChannel(g)} ${clampChannel(b)}`
);

export const parseRgbChannels = (value: string): { r: number; g: number; b: number } | null => {
  const trimmed = value.trim();
  const spaceMatch = trimmed.match(SPACE_RGB_CHANNELS);
  if (spaceMatch) {
    return {
      r: clampChannel(Number(spaceMatch[1])),
      g: clampChannel(Number(spaceMatch[2])),
      b: clampChannel(Number(spaceMatch[3])),
    };
  }
  const parsed = parseCssColor(trimmed);
  if (!parsed) {
    return null;
  }
  return { r: parsed.r, g: parsed.g, b: parsed.b };
};

export const createDefaultRgb = (): RgbDefinition => ({
  mode: 'variable',
  variable: DEFAULT_RGB_VARIABLES[0].name,
  fallback: DEFAULT_RGB_VARIABLES[0].fallback ?? '',
  includeFallback: false,
  r: 0,
  g: 162,
  b: 138,
  alpha: 0.2,
});

export const isCssVariableName = (value: string): boolean => CSS_VARIABLE_NAME.test(value.trim());

export const buildRgbCss = (definition: RgbDefinition): string => {
  const alphaSuffix = definition.alpha >= 1 ? '' : ` / ${formatRgbAlpha(definition.alpha)}`;
  if (definition.mode === 'variable' && isCssVariableName(definition.variable)) {
    const fallback = definition.includeFallback && definition.fallback.trim()
      ? `, ${definition.fallback.trim()}`
      : '';
    return `rgb(var(${definition.variable.trim()}${fallback})${alphaSuffix})`;
  }
  return `rgb(${formatRgbChannels(definition.r, definition.g, definition.b)}${alphaSuffix})`;
};

export const parseRgbCss = (value: string): RgbDefinition | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const variableMatch = trimmed.match(VARIABLE_RGB_CSS);
  if (variableMatch) {
    const variable = variableMatch[1];
    const fallback = (variableMatch[2] ?? '').trim();
    const known = DEFAULT_RGB_VARIABLES.find((entry) => entry.name === variable);
    const resolvedFallback = fallback || known?.fallback || '';
    const fallbackChannels = parseRgbChannels(resolvedFallback);
    return {
      mode: 'variable',
      variable,
      fallback: resolvedFallback,
      includeFallback: Boolean(fallback),
      r: fallbackChannels?.r ?? 0,
      g: fallbackChannels?.g ?? 0,
      b: fallbackChannels?.b ?? 0,
      alpha: parseAlphaToken(variableMatch[3]),
    };
  }

  const spaceMatch = trimmed.match(LITERAL_SPACE_RGB_CSS);
  if (spaceMatch) {
    return {
      mode: 'literal',
      variable: DEFAULT_RGB_VARIABLES[0].name,
      fallback: '',
      includeFallback: false,
      r: clampChannel(Number(spaceMatch[1])),
      g: clampChannel(Number(spaceMatch[2])),
      b: clampChannel(Number(spaceMatch[3])),
      alpha: parseAlphaToken(spaceMatch[4]),
    };
  }

  const parsed = parseCssColor(trimmed);
  if (!parsed) {
    return null;
  }

  return {
    mode: 'literal',
    variable: DEFAULT_RGB_VARIABLES[0].name,
    fallback: '',
    includeFallback: false,
    r: parsed.r,
    g: parsed.g,
    b: parsed.b,
    alpha: parsed.a,
  };
};

export const isCssRgbValue = (value: string): boolean => {
  const trimmed = value.trim();
  return /^rgba?\(/i.test(trimmed) && parseRgbCss(trimmed) != null;
};

export const applyRgbCssToDefinition = (css: string): RgbDefinition | null => parseRgbCss(css);

export const resolveRgbDefinitionFromCss = (css: string): RgbDefinition => (
  parseRgbCss(css) ?? createDefaultRgb()
);

export const withRgbVariable = (
  definition: RgbDefinition,
  variable: RgbVariableOption | string,
): RgbDefinition => {
  const option = typeof variable === 'string'
    ? DEFAULT_RGB_VARIABLES.find((entry) => entry.name === variable) ?? {
      name: variable,
      label: variable,
    }
    : variable;
  const fallback = option.fallback?.trim() ?? definition.fallback;
  const channels = parseRgbChannels(fallback);
  return {
    ...definition,
    mode: 'variable',
    variable: option.name,
    fallback,
    includeFallback: false,
    r: channels?.r ?? definition.r,
    g: channels?.g ?? definition.g,
    b: channels?.b ?? definition.b,
  };
};

export const withRgbLiteral = (
  definition: RgbDefinition,
  channels: { r: number; g: number; b: number },
): RgbDefinition => ({
  ...definition,
  mode: 'literal',
  includeFallback: false,
  r: clampChannel(channels.r),
  g: clampChannel(channels.g),
  b: clampChannel(channels.b),
  fallback: formatRgbChannels(channels.r, channels.g, channels.b),
});

export const withRgbAlpha = (definition: RgbDefinition, alpha: number): RgbDefinition => ({
  ...definition,
  alpha: clamp(alpha, 0, 1),
});

export const resolveRgbPreviewCss = (definition: RgbDefinition): string => {
  if (definition.mode === 'variable' && isCssVariableName(definition.variable)) {
    return buildRgbCss({ ...definition, includeFallback: true });
  }
  const rgba = colorToRgba(rgbToHex(definition.r, definition.g, definition.b), definition.alpha);
  return `rgb(${rgba.r} ${rgba.g} ${rgba.b} / ${formatRgbAlpha(definition.alpha)})`;
};
