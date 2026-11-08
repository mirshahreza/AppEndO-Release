import { describe, expect, it } from 'vitest';
import {
  SHELL_EFFECT_CATALOG,
  getShellEffectPreset,
  validateShellEffectLayer,
  validateShellEffectStack,
} from '..';
import type { ShellEffectId, ShellEffectLayerConfig } from '..';

function layer(effectId: ShellEffectId, id = `layer-${effectId}`): ShellEffectLayerConfig {
  const preset = getShellEffectPreset(effectId);
  return {
    id,
    target: SHELL_EFFECT_CATALOG[effectId].targets[0],
    plane: 'background',
    ...preset.layer,
  } as ShellEffectLayerConfig;
}

describe('shell effect validation', () => {
  it('accepts all curated subtle layers', () => {
    for (const effectId of Object.keys(SHELL_EFFECT_CATALOG) as ShellEffectId[]) {
      expect(validateShellEffectLayer(layer(effectId)), effectId).toEqual({
        valid: true,
        issues: [],
      });
    }
  });

  it('rejects unsafe assets, out-of-range configs, and unsupported targets', () => {
    const image = layer('image-depth-pan');
    if (image.effectId !== 'image-depth-pan') throw new Error('Unexpected fixture');
    image.config.assetRef = 'https://example.com/tracker.png';
    expect(validateShellEffectLayer(image).issues.map((issue) => issue.code)).toContain(
      'config.invalid-asset',
    );

    const aurora = layer('aurora');
    if (aurora.effectId !== 'aurora') throw new Error('Unexpected fixture');
    aurora.config.bands = 99;
    aurora.target = 'content-host';
    const codes = validateShellEffectLayer(aurora).issues.map((issue) => issue.code);
    expect(codes).toContain('config.invalid-value');
    expect(codes).toContain('layer.unsupported-target');
  });

  it('enforces four unique layers and stable validation codes', () => {
    const duplicate = layer('animated-gradient', 'layer-duplicate');
    const layers = [
      duplicate,
      { ...layer('gradient-orbs'), id: 'layer-duplicate' },
      layer('light-rays'),
      layer('conic-rays'),
      layer('film-grain'),
    ];
    const result = validateShellEffectStack({ layers });
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('stack.too-many-layers');
    expect(result.issues.map((issue) => issue.code)).toContain('stack.duplicate-layer-id');
  });
});

