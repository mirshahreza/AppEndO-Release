import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  SHELL_EFFECT_PRESETS,
  SHELL_EFFECT_CATALOG,
  ShellEffectLayer,
  createSeededPoints,
  getShellEffectPreset,
} from '..';
import type { ShellEffectLayerConfig, ShellEffectPreset } from '..';

function layerFromPreset(preset: ShellEffectPreset, id = 'layer-test'): ShellEffectLayerConfig {
  return {
    id,
    target: SHELL_EFFECT_CATALOG[preset.effectId].targets[0],
    plane: 'background',
    ...preset.layer,
  } as ShellEffectLayerConfig;
}

describe('shell effect deterministic rendering', () => {
  it('creates stable seeded point fields', () => {
    expect(createSeededPoints(29, 12)).toEqual(createSeededPoints(29, 12));
    expect(createSeededPoints(29, 12)).not.toEqual(createSeededPoints(30, 12));
  });

  it('renders every curated preset deterministically', () => {
    for (const preset of SHELL_EFFECT_PRESETS) {
      const layer = layerFromPreset(preset);
      const first = renderToStaticMarkup(<ShellEffectLayer layer={layer} />);
      const second = renderToStaticMarkup(<ShellEffectLayer layer={layer} />);
      expect(first, preset.id).toBe(second);
      expect(first, preset.id).toContain(`data-effect-renderer="${preset.effectId}"`);
      expect(first, preset.id).toContain('aria-hidden="true"');
    }
  });

  it('changes generated geometry when the seed changes', () => {
    const preset = getShellEffectPreset('particle-field', 'subtle');
    const first = layerFromPreset(preset);
    const second = { ...first, seed: first.seed + 1 };
    expect(renderToStaticMarkup(<ShellEffectLayer layer={first} />)).not.toBe(
      renderToStaticMarkup(<ShellEffectLayer layer={second} />),
    );
  });
});

