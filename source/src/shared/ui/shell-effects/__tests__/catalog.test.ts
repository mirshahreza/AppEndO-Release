import { describe, expect, it } from 'vitest';
import {
  SHELL_EFFECT_CATALOG,
  SHELL_EFFECT_IDS,
  SHELL_EFFECT_PRESETS,
  SHELL_EFFECT_RENDERERS,
  getShellEffectPreset,
} from '..';

describe('shell effect catalog', () => {
  it('keeps the closed 20-effect renderer catalog in bijection', () => {
    expect(SHELL_EFFECT_IDS).toHaveLength(20);
    expect(Object.keys(SHELL_EFFECT_CATALOG)).toEqual([...SHELL_EFFECT_IDS]);
    expect(Object.keys(SHELL_EFFECT_RENDERERS)).toEqual([...SHELL_EFFECT_IDS]);
    expect(new Set(SHELL_EFFECT_IDS).size).toBe(20);
  });

  it('provides exactly two deterministic curated presets per effect', () => {
    expect(SHELL_EFFECT_PRESETS).toHaveLength(40);
    expect(new Set(SHELL_EFFECT_PRESETS.map((preset) => preset.id)).size).toBe(40);

    for (const effectId of SHELL_EFFECT_IDS) {
      const presets = SHELL_EFFECT_PRESETS.filter((preset) => preset.effectId === effectId);
      expect(presets.map((preset) => preset.id)).toEqual([
        `subtle-${effectId}`,
        `expressive-${effectId}`,
      ]);
      expect(getShellEffectPreset(effectId).layer.seed).toBe(11);
      expect(getShellEffectPreset(effectId, 'expressive').layer.seed).toBe(29);
    }
  });

  it('declares a safe target and reduced-motion fallback for every effect', () => {
    for (const effectId of SHELL_EFFECT_IDS) {
      const meta = SHELL_EFFECT_CATALOG[effectId];
      expect(meta.targets.length).toBeGreaterThan(0);
      expect(['static', 'simplified', 'hidden']).toContain(meta.reducedMotion);
      expect(['low', 'medium', 'high']).toContain(meta.cost);
      expect(meta.costTier).toBe(meta.cost);
      expect(['static', 'css-svg', 'orchestrated-dom', 'canvas-2d']).toContain(
        meta.runtimeEngine,
      );
      expect(['core', 'enhanced']).toContain(meta.authoringTier);
      expect(['base', 'feature-lazy', 'visible-opt-in']).toContain(meta.loadRule);
      expect(['static', 'simplified', 'hidden']).toContain(meta.fallbackRenderer);
    }
  });
});

