import { describe, expect, it } from 'vitest';
import {
  CREATIVE_MOTION_IDS,
  CREATIVE_SCENE_IDS,
  LANDING_WIDGET_IDS,
  VISUAL_ENGINE_IDS,
  validateCreativeMotionConfig,
  validateCreativeSceneConfig,
  validateVisualEngineConfig,
} from '../../../shared/ui';
import { BASE_COMPONENT_CATALOG } from '../catalog/baseComponentCatalog';
import {
  DEFAULT_LANDING_WIDGETS_GALLERY_CONFIG,
  exportLandingWidgetsGalleryConfig,
  getLandingWidgetIds,
  normalizeLandingWidgetsConfig,
} from '../landing-widgets/LandingWidgetsBaseComponentsWorkspace';
import {
  DEFAULT_MOTION_BEHAVIORS_GALLERY_CONFIG,
  buildCreativeMotionDemoConfig,
  exportMotionBehaviorsGalleryConfig,
  normalizeMotionBehaviorsConfig,
} from '../motion-behaviors/MotionBehaviorsBaseComponentsWorkspace';
import {
  DEFAULT_CREATIVE_SCENES_GALLERY_CONFIG,
  buildCreativeSceneDemoConfig,
  exportCreativeScenesGalleryConfig,
  normalizeCreativeScenesConfig,
} from '../creative-scenes/CreativeScenesBaseComponentsWorkspace';
import {
  DEFAULT_VISUAL_ENGINES_GALLERY_CONFIG,
  buildVisualEngineDemoConfig,
  exportVisualEnginesGalleryConfig,
  normalizeVisualEnginesConfig,
} from '../visual-engines/VisualEnginesBaseComponentsWorkspace';

const expectSeparatedExport = (value: unknown) => {
  expect(value).toEqual(expect.objectContaining({
    public: expect.any(Object),
    composition: expect.any(Object),
    demo: {
      fixtures: expect.any(Object),
      scenarios: expect.any(Object),
    },
  }));
};

describe('Creative Base Components option liveness', () => {
  it('Landing Widgets covers all 24 production widgets and normalizes app compatibility', () => {
    for (const widgetId of LANDING_WIDGET_IDS) {
      const exported = exportLandingWidgetsGalleryConfig({
        ...DEFAULT_LANDING_WIDGETS_GALLERY_CONFIG,
        widgetId,
      });
      expect(exported.composition.widgetId).toBe(widgetId);
      expectSeparatedExport(exported);
    }
    expect(getLandingWidgetIds('app').length).toBeLessThan(LANDING_WIDGET_IDS.length);
    expect(normalizeLandingWidgetsConfig({
      ...DEFAULT_LANDING_WIDGETS_GALLERY_CONFIG,
      widgetId: 'landing-pricing',
      target: 'app',
    }).widgetId).not.toBe('landing-pricing');
    expect(exportLandingWidgetsGalleryConfig({
      ...DEFAULT_LANDING_WIDGETS_GALLERY_CONFIG,
      variant: 'editorial',
    }).composition.variant).toBe('editorial');
  });

  it('Motion Behaviors covers all 18 configs, intensity, compatibility, and preference decisions', () => {
    for (const behaviorId of CREATIVE_MOTION_IDS) {
      const motion = buildCreativeMotionDemoConfig(behaviorId, 'expressive');
      expect(validateCreativeMotionConfig(motion).valid).toBe(true);
      expect(motion.id).toBe(behaviorId);
    }
    const fallback = exportMotionBehaviorsGalleryConfig({
      ...DEFAULT_MOTION_BEHAVIORS_GALLERY_CONFIG,
      behaviorId: 'scroll-parallax-layers',
      viewport: 'phone',
      saveData: true,
    });
    expectSeparatedExport(fallback);
    expect(fallback.demo.scenarios.decision.mode).toBe('fallback');
    expect(normalizeMotionBehaviorsConfig({
      ...DEFAULT_MOTION_BEHAVIORS_GALLERY_CONFIG,
      behaviorId: 'pointer-tilt',
      experience: 'app',
    }).behaviorId).not.toBe('pointer-tilt');
  });

  it('Creative Scenes covers all 12 compositions and live preset/fallback controls', () => {
    for (const sceneId of CREATIVE_SCENE_IDS) {
      const scene = buildCreativeSceneDemoConfig({
        ...DEFAULT_CREATIVE_SCENES_GALLERY_CONFIG,
        sceneId,
        preset: 'expressive',
        density: 'dense',
      });
      expect(validateCreativeSceneConfig(scene).valid).toBe(true);
      expect(scene.sceneId).toBe(sceneId);
      expect(scene.preset).toBe('expressive');
      expect(scene.density).toBe('dense');
    }
    const fallback = exportCreativeScenesGalleryConfig({
      ...DEFAULT_CREATIVE_SCENES_GALLERY_CONFIG,
      fallback: 'engine-unavailable',
    });
    expectSeparatedExport(fallback);
    expect(fallback.demo.scenarios.projection.mode).toBe('fallback');
    expect(normalizeCreativeScenesConfig({
      ...DEFAULT_CREATIVE_SCENES_GALLERY_CONFIG,
      sceneId: 'scene-product-orbit',
      experience: 'app',
    }).sceneId).not.toBe('scene-product-orbit');
  });

  it('Visual Engines covers every module and quality with valid closed configs', () => {
    for (const engineId of VISUAL_ENGINE_IDS) {
      const efficient = buildVisualEngineDemoConfig(engineId, 'efficient');
      const maximum = buildVisualEngineDemoConfig(engineId, 'maximum');
      expect(validateVisualEngineConfig(efficient).valid).toBe(true);
      expect(validateVisualEngineConfig(maximum).valid).toBe(true);
      expect(maximum).not.toEqual(efficient);
    }
    const app = exportVisualEnginesGalleryConfig({
      ...DEFAULT_VISUAL_ENGINES_GALLERY_CONFIG,
      experience: 'app',
      reducedMotion: true,
      saveData: true,
      paused: true,
    });
    expectSeparatedExport(app);
    expect(app.public.enabled).toBe(false);
    expect(app.demo.scenarios.expectedFallback).toBe('app-unsupported');
    expect(normalizeVisualEnginesConfig({
      ...DEFAULT_VISUAL_ENGINES_GALLERY_CONFIG,
      experience: 'app',
      reducedMotion: true,
      saveData: true,
      paused: true,
    })).toMatchObject({ reducedMotion: false, saveData: false, paused: false });
  });

  it('maps every Creative catalog option to the dedicated executable family test', () => {
    const creativeComponents = BASE_COMPONENT_CATALOG.components.filter(({ family }) => family === 'Creative');
    expect(creativeComponents.map(({ id }) => id)).toEqual([
      'landing-widgets',
      'motion-behaviors',
      'creative-scenes',
      'visual-engines',
    ]);
    for (const component of creativeComponents) {
      expect(component.optionIds.length).toBeGreaterThanOrEqual(7);
      expect(BASE_COMPONENT_CATALOG.tests).toContainEqual(expect.objectContaining({
        componentId: component.id,
        testId: `${component.id}.option-liveness`,
        testFile: 'src/features/base-components/__tests__/creativeOptionLiveness.test.tsx',
      }));
    }
  });
});
