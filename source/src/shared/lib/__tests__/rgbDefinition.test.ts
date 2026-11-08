import { describe, expect, it } from 'vitest';
import {
  applyRgbCssToDefinition,
  buildRgbCss,
  createDefaultRgb,
  formatRgbAlpha,
  isCssRgbValue,
  parseRgbCss,
  resolveRgbDefinitionFromCss,
  withRgbAlpha,
  withRgbLiteral,
  withRgbVariable,
} from '../rgbDefinition';
import { RGB_PRESETS } from '../rgbPresetCatalog';

describe('rgbDefinition', () => {
  it('builds variable rgb css with slash alpha', () => {
    const css = buildRgbCss({
      ...createDefaultRgb(),
      variable: '--app-accent-tertiary-rgb',
      alpha: 0.19459694989106752,
    });
    expect(css).toBe('rgb(var(--app-accent-tertiary-rgb) / 0.19459694989106752)');
  });

  it('omits alpha when fully opaque', () => {
    expect(buildRgbCss(withRgbAlpha(createDefaultRgb(), 1))).toBe('rgb(var(--app-accent-rgb))');
    expect(buildRgbCss(withRgbLiteral(withRgbAlpha(createDefaultRgb(), 1), { r: 0, g: 110, b: 150 }))).toBe(
      'rgb(0 110 150)',
    );
  });

  it('round-trips variable rgb with fallback and alpha', () => {
    const css = 'rgb(var(--app-accent-rgb, 0 162 138) / 0.16)';
    const parsed = parseRgbCss(css);
    expect(parsed).toMatchObject({
      mode: 'variable',
      variable: '--app-accent-rgb',
      fallback: '0 162 138',
      includeFallback: true,
      alpha: 0.16,
    });
    expect(buildRgbCss(parsed!)).toBe(css);
  });

  it('parses literal modern rgb and comma rgba', () => {
    expect(parseRgbCss('rgb(0 110 150 / 0.19)')).toMatchObject({
      mode: 'literal',
      r: 0,
      g: 110,
      b: 150,
      alpha: 0.19,
    });
    expect(parseRgbCss('rgba(0, 162, 138, 0.24)')).toMatchObject({
      mode: 'literal',
      r: 0,
      g: 162,
      b: 138,
      alpha: 0.24,
    });
  });

  it('detects rgb css and rejects gradients', () => {
    expect(isCssRgbValue('rgb(var(--app-accent-tertiary-rgb) / 0.19459694989106752)')).toBe(true);
    expect(isCssRgbValue('rgb(0 162 138 / 0.12)')).toBe(true);
    expect(isCssRgbValue('#00A28A')).toBe(false);
    expect(isCssRgbValue('linear-gradient(90deg, #000 0%, #fff 100%)')).toBe(false);
  });

  it('formats alpha without scientific notation', () => {
    expect(formatRgbAlpha(0)).toBe('0');
    expect(formatRgbAlpha(1)).toBe('1');
    expect(formatRgbAlpha(0.19459694989106752)).toBe('0.19459694989106752');
  });

  it('switches between variable and literal sources', () => {
    const variable = withRgbVariable(createDefaultRgb(), '--app-accent-tertiary-rgb');
    expect(variable.mode).toBe('variable');
    expect(variable.variable).toBe('--app-accent-tertiary-rgb');
    expect(buildRgbCss(withRgbLiteral(variable, { r: 99, g: 102, b: 241 }))).toBe(
      'rgb(99 102 241 / 0.2)',
    );
  });

  it('resolves invalid css to the default definition', () => {
    expect(resolveRgbDefinitionFromCss('not-a-color').variable).toBe('--app-accent-rgb');
  });

  it('parses every preset into an rgb definition', () => {
    const failures = RGB_PRESETS.filter((preset) => !applyRgbCssToDefinition(preset.css));
    expect(failures.map((preset) => preset.id)).toEqual([]);
  });
});
