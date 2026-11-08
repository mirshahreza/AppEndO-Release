import { describe, expect, it } from 'vitest';
import { ACCENT_COLOR_MATRIX } from '../accentPalettes';
import {
  accentDepthFromLightness,
  buildAccentCssVars,
  harmonizeAccentHex,
  hexToRgb,
} from '../accentColorUtils';

const lightness = (hex: string): number => {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  return ((max + min) / 2) * 100;
};

describe('accent depth scaling', () => {
  it('maps Fluent Light→Deep to rising depth without tinting chrome', () => {
    for (const row of ACCENT_COLOR_MATRIX) {
      const light = row.swatches[0];
      const deep = row.swatches[4];
      const lightTokens = harmonizeAccentHex(light.hex, true);
      const deepTokens = harmonizeAccentHex(deep.hex, true);
      const lightVars = buildAccentCssVars(lightTokens);
      const deepVars = buildAccentCssVars(deepTokens);

      expect(accentDepthFromLightness(lightness(deep.hex)))
        .toBeGreaterThan(accentDepthFromLightness(lightness(light.hex)) + 0.5);

      expect(lightVars['--app-shell-bg']).toBe(deepVars['--app-shell-bg']);
      expect(lightVars['--app-nav-group-header-edge']).toBe(deepVars['--app-nav-group-header-edge']);
      expect(deepVars['--color-primary-700']).not.toBe('#FFFFFF');
      expect(lightness(lightVars['--app-accent-500']))
        .toBeGreaterThan(lightness(deepVars['--app-accent-500']));
    }
  });

  it('keeps identity hex ordered across intensity columns for Teal', () => {
    const teal = ACCENT_COLOR_MATRIX.find((row) => row.id === 'teal');
    expect(teal).toBeTruthy();
    const identityL = teal!.swatches.map((swatch) => {
      const vars = buildAccentCssVars(harmonizeAccentHex(swatch.hex, true));
      return lightness(vars['--app-accent-500']);
    });
    for (let index = 1; index < identityL.length; index += 1) {
      expect(identityL[index]).toBeLessThan(identityL[index - 1]);
    }
  });
});
