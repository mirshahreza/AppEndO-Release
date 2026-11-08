import { describe, expect, it } from 'vitest';
import {
  addShadowLayer,
  buildBorderCss,
  buildBorderShadowCssOutput,
  createBorderShadowDefinitionFromShadowCss,
  createDefaultBorder,
  createDefaultBorderShadow,
  isCssShadowValue,
  parseShadowCss,
  reverseShadowLayers,
  updateBorder,
} from '../borderShadowDefinition';

describe('borderShadowDefinition', () => {
  it('builds border css with width, style, and radius', () => {
    const border = updateBorder(createDefaultBorder(), { width: 2, color: '#6366f1', radius: 12 });
    expect(buildBorderCss(border)).toContain('2px solid');
    expect(buildBorderCss(border)).toContain('border-radius: 12px');
  });

  it('builds combined border and shadow output', () => {
    const output = buildBorderShadowCssOutput(createDefaultBorderShadow());
    expect(output.border).toContain('border:');
    expect(output.shadow).toContain('0px 4px 6px');
    expect(output.combined).toContain('box-shadow:');
  });

  it('parses shadow css layers', () => {
    const css = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)';
    const parsed = parseShadowCss(css);
    expect(parsed?.layers).toHaveLength(2);
  });

  it('adds a shadow layer', () => {
    const definition = createDefaultBorderShadow();
    const next = addShadowLayer(definition.shadow);
    expect(next.layers).toHaveLength(3);
  });

  it('reverses shadow layer order', () => {
    const definition = createDefaultBorderShadow();
    const reversed = reverseShadowLayers(definition.shadow.layers);
    expect(reversed[0].offsetY).toBe(definition.shadow.layers[1].offsetY);
  });

  it('detects box-shadow css values', () => {
    expect(isCssShadowValue('0 4px 6px rgba(0, 0, 0, 0.1)')).toBe(true);
    expect(isCssShadowValue('inset 0 1px 0 #fff')).toBe(true);
    expect(isCssShadowValue('rgb(var(--app-accent-rgb) / 0.12)')).toBe(false);
  });

  it('builds a border-shadow definition with default border chrome and parsed shadow', () => {
    const css = '0 0 0 2px rgba(0, 162, 138, 0.12)';
    const definition = createBorderShadowDefinitionFromShadowCss(css);
    expect(definition.border.style).toBe('solid');
    expect(definition.shadow.layers).toHaveLength(1);
    expect(buildBorderShadowCssOutput(definition).shadow).toContain('2px');
  });
});
