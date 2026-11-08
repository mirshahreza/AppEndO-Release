import { describe, expect, it } from 'vitest';
import { SHELL_EFFECT_IDS } from '../../../shared/ui';
import {
  DEFAULT_SHELL_EFFECTS_GALLERY_CONFIG,
  buildShellEffectGalleryLayers,
  exportShellEffectsGalleryConfig,
} from '../shell-effects/ShellEffectsBaseComponentsWorkspace';
import {
  DEFAULT_SHELL_FOUNDATION_GALLERY_CONFIG,
  SHELL_FOUNDATION_COMPONENT_IDS,
  exportShellFoundationGalleryConfig,
} from '../shell-foundation/ShellFoundationBaseComponentsWorkspace';
import {
  DEFAULT_SHELL_NAVIGATION_GALLERY_CONFIG,
  SHELL_NAVIGATION_COMPONENT_IDS,
  exportShellNavigationGalleryConfig,
} from '../shell-navigation/ShellNavigationBaseComponentsWorkspace';
import {
  DEFAULT_LANDING_WIDGETS_GALLERY_CONFIG,
  exportLandingWidgetsGalleryConfig,
} from '../landing-widgets/LandingWidgetsBaseComponentsWorkspace';
import {
  DEFAULT_MOTION_BEHAVIORS_GALLERY_CONFIG,
  exportMotionBehaviorsGalleryConfig,
} from '../motion-behaviors/MotionBehaviorsBaseComponentsWorkspace';
import {
  DEFAULT_CREATIVE_SCENES_GALLERY_CONFIG,
  exportCreativeScenesGalleryConfig,
} from '../creative-scenes/CreativeScenesBaseComponentsWorkspace';
import {
  DEFAULT_VISUAL_ENGINES_GALLERY_CONFIG,
  exportVisualEnginesGalleryConfig,
} from '../visual-engines/VisualEnginesBaseComponentsWorkspace';
import {
  CREATIVE_MOTION_IDS,
  CREATIVE_SCENE_IDS,
  LANDING_WIDGET_IDS,
  VISUAL_ENGINE_IDS,
} from '../../../shared/ui';

describe('shell base component galleries', () => {
  it('covers every production foundation primitive', () => {
    expect(SHELL_FOUNDATION_COMPONENT_IDS).toHaveLength(17);
    expect(new Set(SHELL_FOUNDATION_COMPONENT_IDS).size).toBe(17);
    expect(exportShellFoundationGalleryConfig(DEFAULT_SHELL_FOUNDATION_GALLERY_CONFIG)).toMatchObject({
      public: { direction: 'ltr', viewport: 'desktop' },
      composition: { component: 'ShellFrame' },
      demo: { scenarios: { state: 'default' } },
    });
  });

  it('covers navigation primitives and compositions', () => {
    expect(SHELL_NAVIGATION_COMPONENT_IDS).toHaveLength(25);
    expect(SHELL_NAVIGATION_COMPONENT_IDS).toContain('ShellNavRoot');
    expect(SHELL_NAVIGATION_COMPONENT_IDS).toContain('ShellNavigationUtilities');
    expect(exportShellNavigationGalleryConfig(DEFAULT_SHELL_NAVIGATION_GALLERY_CONFIG)).toMatchObject({
      public: { direction: 'ltr' },
      composition: { component: 'ShellSidebarNavigation' },
      demo: { fixtures: { manifest: 'shell-designer-ci' } },
    });
  });

  it('builds bounded effect stacks from every registered effect ID', () => {
    expect(SHELL_EFFECT_IDS).toHaveLength(20);
    for (const effectId of SHELL_EFFECT_IDS) {
      const config = { ...DEFAULT_SHELL_EFFECTS_GALLERY_CONFIG, effectId, layerCount: 4 as const };
      const layers = buildShellEffectGalleryLayers(config);
      expect(layers).toHaveLength(4);
      expect(layers[0].effectId).toBe(effectId);
      expect(new Set(layers.map((layer) => layer.id)).size).toBe(4);
      expect(exportShellEffectsGalleryConfig(config)).toMatchObject({
        composition: { effectId, layers },
        demo: { fixtures: { layerCount: 4 } },
      });
    }
  });

  it('exports a production-backed gallery case for every Creative catalog ID', () => {
    expect(LANDING_WIDGET_IDS).toHaveLength(24);
    expect(CREATIVE_MOTION_IDS).toHaveLength(18);
    expect(CREATIVE_SCENE_IDS).toHaveLength(12);
    expect(VISUAL_ENGINE_IDS).toHaveLength(8);
    for (const widgetId of LANDING_WIDGET_IDS) {
      expect(exportLandingWidgetsGalleryConfig({
        ...DEFAULT_LANDING_WIDGETS_GALLERY_CONFIG,
        widgetId,
      }).composition.widgetId).toBe(widgetId);
    }
    for (const behaviorId of CREATIVE_MOTION_IDS) {
      expect(exportMotionBehaviorsGalleryConfig({
        ...DEFAULT_MOTION_BEHAVIORS_GALLERY_CONFIG,
        behaviorId,
      }).composition.behavior.id).toBe(behaviorId);
    }
    for (const sceneId of CREATIVE_SCENE_IDS) {
      expect(exportCreativeScenesGalleryConfig({
        ...DEFAULT_CREATIVE_SCENES_GALLERY_CONFIG,
        sceneId,
      }).composition.sceneId).toBe(sceneId);
    }
    for (const engineId of VISUAL_ENGINE_IDS) {
      expect(exportVisualEnginesGalleryConfig({
        ...DEFAULT_VISUAL_ENGINES_GALLERY_CONFIG,
        engineId,
      }).composition.config.engineId).toBe(engineId);
    }
  });
});
