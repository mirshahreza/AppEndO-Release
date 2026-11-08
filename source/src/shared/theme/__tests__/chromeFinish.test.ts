import { describe, expect, it } from 'vitest';
import {
  CHROME_OPACITY_DEFAULT,
  HEADER_FILL_TOKEN_KEY,
  HEADER_TEXTURE_TOKEN_KEY,
  MENU_TEXTURE_TOKEN_KEY,
  SIDEBAR_FILL_TOKEN_KEY,
  formatChromeOpacityToken,
  parseChromeOpacityToken,
} from '../chromeFinish';
import { deriveThemeTokensFromBase } from '../themePresetUtils';
import { THEME_TOKEN_DEFINITION_BY_KEY } from '../themeTokenCatalog';

describe('chromeFinish', () => {
  it('parses and clamps percent tokens', () => {
    expect(parseChromeOpacityToken(undefined)).toBe(0);
    expect(parseChromeOpacityToken('0%')).toBe(0);
    expect(parseChromeOpacityToken('35%')).toBe(35);
    expect(parseChromeOpacityToken('100%')).toBe(100);
    expect(parseChromeOpacityToken('140%')).toBe(100);
    expect(parseChromeOpacityToken('nope')).toBe(0);
    expect(formatChromeOpacityToken(-4)).toBe('0%');
    expect(formatChromeOpacityToken(48.6)).toBe('49%');
    expect(formatChromeOpacityToken(100)).toBe('100%');
  });

  it('defaults chrome fill and texture to off in generated themes', () => {
    const tokens = deriveThemeTokensFromBase('#038387', 'fluent');
    expect(tokens[SIDEBAR_FILL_TOKEN_KEY]).toBe(CHROME_OPACITY_DEFAULT);
    expect(tokens[HEADER_FILL_TOKEN_KEY]).toBe(CHROME_OPACITY_DEFAULT);
    expect(tokens[MENU_TEXTURE_TOKEN_KEY]).toBe(CHROME_OPACITY_DEFAULT);
    expect(tokens[HEADER_TEXTURE_TOKEN_KEY]).toBe(CHROME_OPACITY_DEFAULT);
  });

  it('exposes fill and texture tokens as percent controls', () => {
    for (const key of [
      SIDEBAR_FILL_TOKEN_KEY,
      HEADER_FILL_TOKEN_KEY,
      MENU_TEXTURE_TOKEN_KEY,
      HEADER_TEXTURE_TOKEN_KEY,
    ]) {
      expect(THEME_TOKEN_DEFINITION_BY_KEY.get(key)?.valueKind).toBe('percent');
    }
  });
});
