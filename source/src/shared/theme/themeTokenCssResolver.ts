import { isCssShadowValue } from '../lib/borderShadowDefinition';
import { isCssGradientValue } from '../lib/gradientDefinition';
import { isCssRgbValue } from '../lib/rgbDefinition';
import type { ThemeTokenDefinition } from './themeTokenCatalog';
import type { ThemeTokenMap } from './themePresetUtils';

const THEME_VAR_REFERENCE = /var\((--[a-z0-9-]+)\)/gi;
const THEME_RGB_VAR_WITH_ALPHA = /rgb\(\s*var\((--[a-z0-9-]+)\)\s*\/\s*([^)]+)\)/gi;
const MAX_VAR_RESOLVE_DEPTH = 16;

const rgbTokenToRgba = (rgbToken: string, alpha: string): string => {
  const parts = rgbToken.trim().split(/\s+/).map((part) => Number.parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return `rgba(0, 0, 0, ${alpha.trim()})`;
  }
  const [red, green, blue] = parts;
  return `rgba(${red}, ${green}, ${blue}, ${alpha.trim()})`;
};

export const bakeThemeGradientCssForDesigner = (
  css: string,
  tokens: ThemeTokenMap,
): string => {
  let baked = css;

  baked = baked.replace(
    THEME_RGB_VAR_WITH_ALPHA,
    (_match, varName: string, alpha: string) => rgbTokenToRgba(tokens[varName] ?? '', alpha),
  );

  baked = resolveThemeTokenVarReferences(baked, tokens);

  return baked;
};

export const resolveThemeTokenVarReferences = (
  value: string,
  tokens: ThemeTokenMap,
  depth = 0,
): string => {
  if (!value.includes('var(') || depth >= MAX_VAR_RESOLVE_DEPTH) {
    return value;
  }

  return value.replace(THEME_VAR_REFERENCE, (_match, varName: string) => {
    const tokenValue = tokens[varName]?.trim();
    if (!tokenValue) {
      return `var(${varName})`;
    }
    if (tokenValue.startsWith('var(')) {
      return resolveThemeTokenVarReferences(tokenValue, tokens, depth + 1);
    }
    return tokenValue;
  });
};

export const resolveThemeTokenCSSValue = (
  tokens: ThemeTokenMap,
  key: string,
): string => {
  const raw = tokens[key]?.trim() ?? '';
  if (!raw) {
    return '';
  }

  const bareVar = raw.match(/^var\((--[a-z0-9-]+)\)$/i);
  if (bareVar) {
    const target = bareVar[1];
    if (target === key) {
      return raw;
    }
    return resolveThemeTokenCSSValue(tokens, target);
  }

  return resolveThemeTokenVarReferences(raw, tokens);
};

export const bakeThemeShadowCssForDesigner = (
  css: string,
  tokens: ThemeTokenMap,
): string => bakeThemeGradientCssForDesigner(css, tokens);

export const shouldUseThemeGradientPicker = (
  token: ThemeTokenDefinition,
  tokens: ThemeTokenMap,
): boolean => {
  if (token.valueKind === 'toggle' || token.valueKind === 'percent') {
    return false;
  }
  if (token.key.startsWith('--gradient-') || token.valueKind === 'gradient') {
    return true;
  }

  const resolved = resolveThemeTokenCSSValue(tokens, token.key);
  return isCssGradientValue(resolved);
};

export const shouldUseThemeShadowPicker = (
  token: ThemeTokenDefinition,
  tokens: ThemeTokenMap,
): boolean => {
  if (token.valueKind === 'toggle' || token.valueKind === 'percent') {
    return false;
  }
  if (token.key.startsWith('--shadow-')) {
    return true;
  }

  const resolved = resolveThemeTokenCSSValue(tokens, token.key);
  return isCssShadowValue(resolved);
};

export const shouldUseThemeVariableColorPicker = (
  token: ThemeTokenDefinition,
  tokens: ThemeTokenMap,
): boolean => {
  if (
    token.valueKind === 'rgb'
    || token.valueKind === 'hex'
    || token.valueKind === 'gradient'
    || token.valueKind === 'toggle'
    || token.valueKind === 'percent'
  ) {
    return false;
  }
  if (shouldUseThemeGradientPicker(token, tokens) || shouldUseThemeShadowPicker(token, tokens)) {
    return false;
  }

  const raw = tokens[token.key]?.trim() ?? '';
  return isCssRgbValue(raw);
};
