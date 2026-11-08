import { describe, expect, it } from 'vitest';
import { applyGradientCssToDefinition } from '../gradientDefinition';
import { GRADIENT_PRESETS } from '../gradientPresetCatalog';

describe('gradientPresetCatalog', () => {
  it('parses every preset into a gradient definition', () => {
    const failures = GRADIENT_PRESETS.filter((preset) => !applyGradientCssToDefinition(preset.css));
    expect(failures.map((preset) => preset.id)).toEqual([]);
  });
});
