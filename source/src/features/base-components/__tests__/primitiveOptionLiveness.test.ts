import { describe, expect, it } from 'vitest';
import { getBaseComponentOptions } from '../catalog/baseComponentCatalog';
import { resolveBaseComponentConfig } from '../catalog/resolveBaseComponentConfig';
import { exportBaseComponentConfig } from '../catalog/exportBaseComponentConfig';
import { PRIMITIVE_SECTION_IDS } from '../catalog/sections/primitiveSections.options';

describe('primitive option liveness', () => {
  it.each(PRIMITIVE_SECTION_IDS)('%s resolves production options and exports public props', (sectionId) => {
    const options = getBaseComponentOptions(sectionId);
    expect(options.length).toBeGreaterThan(0);
    const resolution = resolveBaseComponentConfig(options);
    expect(Object.keys(resolution.optionState)).toHaveLength(options.length);
    const exported = exportBaseComponentConfig(options, resolution.values);
    expect(exported.public).toEqual(expect.any(Object));
  });
});
