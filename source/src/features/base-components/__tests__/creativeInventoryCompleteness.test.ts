import { describe, expect, it } from 'vitest';
import {
  CREATIVE_MOTION_CATALOG,
  CREATIVE_MOTION_IDS,
  CREATIVE_SCENE_CATALOG,
  CREATIVE_SCENE_IDS,
  CREATIVE_SCENE_RENDERERS,
  LANDING_WIDGET_CATALOG,
  LANDING_WIDGET_FIXTURES,
  LANDING_WIDGET_IDS,
  LANDING_WIDGET_REGISTRY,
  VISUAL_ENGINE_CATALOG,
  VISUAL_ENGINE_IDS,
  VISUAL_ENGINE_LAZY_REGISTRY,
} from '../../../shared/ui';
import { BASE_COMPONENT_CATALOG } from '../catalog/baseComponentCatalog';

const CREATIVE_SECTION_IDS = [
  'landing-widgets',
  'motion-behaviors',
  'creative-scenes',
  'visual-engines',
] as const;

describe('Creative production inventory completeness', () => {
  it('keeps each frozen inventory in exact catalog/runtime bijection', () => {
    expect(LANDING_WIDGET_IDS).toHaveLength(24);
    expect(Object.keys(LANDING_WIDGET_CATALOG)).toEqual([...LANDING_WIDGET_IDS]);
    expect(Object.keys(LANDING_WIDGET_FIXTURES)).toEqual([...LANDING_WIDGET_IDS]);
    expect(Object.keys(LANDING_WIDGET_REGISTRY)).toEqual([...LANDING_WIDGET_IDS]);

    expect(CREATIVE_MOTION_IDS).toHaveLength(18);
    expect(Object.keys(CREATIVE_MOTION_CATALOG)).toEqual([...CREATIVE_MOTION_IDS]);

    expect(CREATIVE_SCENE_IDS).toHaveLength(12);
    expect(Object.keys(CREATIVE_SCENE_CATALOG)).toEqual([...CREATIVE_SCENE_IDS]);
    expect(Object.keys(CREATIVE_SCENE_RENDERERS)).toEqual([...CREATIVE_SCENE_IDS]);

    expect(VISUAL_ENGINE_IDS).toHaveLength(8);
    expect(Object.keys(VISUAL_ENGINE_CATALOG)).toEqual([...VISUAL_ENGINE_IDS]);
    expect(Object.keys(VISUAL_ENGINE_LAZY_REGISTRY)).toEqual([...VISUAL_ENGINE_IDS]);
  });

  it('maps every Creative workspace to metadata, exports, a primary demo, and tests', () => {
    for (const sectionId of CREATIVE_SECTION_IDS) {
      const component = BASE_COMPONENT_CATALOG.components.find(({ id }) => id === sectionId);
      expect(component?.family).toBe('Creative');
      expect(component?.publicExportIds.length).toBeGreaterThan(0);
      expect(BASE_COMPONENT_CATALOG.exports.some(({ componentId }) => componentId === sectionId)).toBe(true);
      expect(BASE_COMPONENT_CATALOG.demos.filter(({ sectionId: id, primary }) => id === sectionId && primary)).toHaveLength(1);
      expect(BASE_COMPONENT_CATALOG.tests.filter(({ componentId }) => componentId === sectionId)).toHaveLength(2);
    }
  });

  it('classifies every production component export named by Creative catalogs', () => {
    const exportIds = new Set(BASE_COMPONENT_CATALOG.exports.map(({ exportId }) => exportId));
    for (const id of LANDING_WIDGET_IDS) {
      expect(exportIds.has(LANDING_WIDGET_CATALOG[id].componentName)).toBe(true);
    }
    for (const id of VISUAL_ENGINE_IDS) {
      expect(exportIds.has(VISUAL_ENGINE_CATALOG[id].componentName)).toBe(true);
    }
  });
});
