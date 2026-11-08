import { describe, expect, it } from 'vitest';
import {
  addGradientStop,
  buildGradientCss,
  createDefaultGradient,
  extractFirstGradientCss,
  parseGradientCss,
  resolveGradientDefinitionFromCss,
  resolveGradientInsertPosition,
  reverseGradientStops,
} from '../gradientDefinition';

describe('gradientDefinition', () => {
  it('builds linear, radial, and conic gradients', () => {
    expect(buildGradientCss(createDefaultGradient('linear'))).toMatch(/^linear-gradient\(/);
    expect(buildGradientCss(createDefaultGradient('radial'))).toMatch(/^radial-gradient\(/);
    expect(buildGradientCss(createDefaultGradient('conic'))).toMatch(/^conic-gradient\(/);
  });

  it('builds repeating gradient families', () => {
    expect(buildGradientCss(createDefaultGradient('repeating-linear'))).toMatch(/^repeating-linear-gradient\(/);
    expect(buildGradientCss(createDefaultGradient('repeating-radial'))).toMatch(/^repeating-radial-gradient\(/);
    expect(buildGradientCss(createDefaultGradient('repeating-conic'))).toMatch(/^repeating-conic-gradient\(/);
  });

  it('round-trips a linear gradient css string', () => {
    const css = 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)';
    const parsed = parseGradientCss(css);
    expect(parsed?.type).toBe('linear');
    expect(parsed?.angle).toBe(135);
    expect(buildGradientCss(parsed!)).toBe(css);
  });

  it('reverses stop positions', () => {
    const definition = createDefaultGradient('linear');
    const reversed = reverseGradientStops(definition.stops);
    expect(reversed[0].position).toBe(100);
    expect(reversed[1].position).toBe(0);
  });

  it('adds a stop at the largest gap and interpolates color', () => {
    const definition = createDefaultGradient('linear');
    expect(resolveGradientInsertPosition(definition.stops)).toBe(50);

    const next = addGradientStop(definition);
    expect(next.stops).toHaveLength(3);
    expect(next.stops.map((stop) => stop.position)).toContain(50);
    expect(buildGradientCss(next)).toMatch(/50%/);
  });

  it('extracts the first gradient from layered background values', () => {
    const layered = [
      'radial-gradient(ellipse 100% 68% at -6% -10%, rgb(0 162 138 / 0.028) 0%, transparent 50%)',
      'linear-gradient(155deg, #E9EFEE 0%, #FAFBFB 48%, #F4F6F6 100%)',
    ].join(', ');

    expect(extractFirstGradientCss(layered)).toBe(
      'radial-gradient(ellipse 100% 68% at -6% -10%, rgb(0 162 138 / 0.028) 0%, transparent 50%)',
    );
  });

  it('resolves a designer definition from stored theme gradient css', () => {
    const css = 'linear-gradient(110deg, transparent 0%, rgb(0 162 138 / 0.07) 44%, rgb(0 130 120 / 0.045) 56%, transparent 100%)';
    const definition = resolveGradientDefinitionFromCss(css);
    expect(definition.type).toBe('linear');
    expect(definition.angle).toBe(110);
    expect(definition.stops[0].color).toBe('rgba(0, 0, 0, 0)');
    expect(definition.stops[1].color).toContain('rgba');
    expect(buildGradientCss(definition)).toContain('linear-gradient');
  });

  it('parses theme menu overlay gradients without collapsing stops to black', () => {
    const baked = 'linear-gradient(165deg, rgba(0, 162, 138, 0.05) 0%, rgba(0, 130, 120, 0.03) 42%, rgba(255, 255, 255, 0) 74%)';
    const definition = resolveGradientDefinitionFromCss(baked);
    expect(definition.angle).toBe(165);
    expect(definition.stops).toHaveLength(3);
    expect(definition.stops[0].color).toBe('rgba(0, 162, 138, 0.05)');
    expect(definition.stops[2].color).toBe('rgba(255, 255, 255, 0)');
  });
});
