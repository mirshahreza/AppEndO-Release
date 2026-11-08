import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  SHELL_EFFECT_CATALOG,
  ShellEffectLayer,
  ShellEffectStack,
  getShellEffectMovingUnits,
  getShellEffectPreset,
  getShellEffectStackCost,
  resolveShellEffectFallback,
} from '..';
import type { ShellEffectId, ShellEffectLayerConfig as LayerConfig } from '..';

function layer(effectId: ShellEffectId, id = `layer-${effectId}`): LayerConfig {
  const preset = getShellEffectPreset(effectId);
  return {
    id,
    target: SHELL_EFFECT_CATALOG[effectId].targets[0],
    plane: 'background',
    ...preset.layer,
  } as LayerConfig;
}

describe('shell effect fallbacks and cost', () => {
  it('forces high-cost phone effects to deterministic static frames', () => {
    const particle = layer('particle-field');
    expect(resolveShellEffectFallback(particle, 'phone')).toBe('static');
    expect(getShellEffectMovingUnits(particle, 'phone')).toBe(0);

    const markup = renderToStaticMarkup(
      <ShellEffectLayer layer={particle} viewport="phone" />,
    );
    expect(markup).toContain('data-effect-fallback="static"');
    expect(markup).toContain('data-effect-paused="true"');
  });

  it('applies reduced-motion and data fallbacks from catalog policy', () => {
    expect(
      resolveShellEffectFallback(layer('shimmer-bands'), 'desktop', 'runtime', {
        reducedMotion: true,
      }),
    ).toBe('hidden');
    expect(
      resolveShellEffectFallback(layer('aurora'), 'desktop', 'runtime', {
        reducedData: true,
      }),
    ).toBe('simplified');
    expect(
      renderToStaticMarkup(
        <ShellEffectLayer layer={layer('aurora')} fallback="simplified" />,
      ),
    ).toContain('data-effect-fallback="simplified"');
  });

  it('reports viewport moving units and budget limits', () => {
    const layers = [
      layer('particle-field'),
      layer('aurora'),
      layer('animated-gradient'),
    ];
    expect(getShellEffectStackCost(layers, 'desktop')).toMatchObject({
      units: 4,
      limit: 3,
      withinBudget: false,
    });
    expect(getShellEffectStackCost(layers, 'phone')).toMatchObject({
      units: 2,
      limit: 1,
      withinBudget: false,
    });
  });

  it('degrades overflow layers to static and fails closed above four layers', () => {
    const layers = [
      layer('particle-field'),
      layer('aurora'),
      layer('animated-gradient'),
    ];
    const budgeted = renderToStaticMarkup(<ShellEffectStack layers={layers} />);
    expect(budgeted.match(/data-effect-fallback="static"/g)?.length).toBe(1);

    const invalid = renderToStaticMarkup(
      <ShellEffectStack layers={[...layers, layer('film-grain'), layer('light-rays')]}>
        <main>Safe content</main>
      </ShellEffectStack>,
    );
    expect(invalid).toContain('data-invalid-layer-count="5"');
    expect(invalid).not.toContain('data-shell-effect-id');
    expect(invalid).toContain('Safe content');
  });
});

