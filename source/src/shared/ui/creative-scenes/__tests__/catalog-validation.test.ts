import { describe, expect, it } from 'vitest';
import {
  CREATIVE_SCENE_APP_ALLOWLIST,
  CREATIVE_SCENE_CATALOG,
  CREATIVE_SCENE_FIXTURES,
  CREATIVE_SCENE_IDS,
  CREATIVE_SCENE_STRUCTURAL_SIGNATURES,
  createCreativeSceneFixture,
  isCreativeSceneAppCompatible,
  resolveCreativeSceneProjection,
  validateCreativeSceneConfig,
  validateCreativeSceneHost,
} from '..';

const EXACT_IDS = [
  'scene-layered-hero',
  'scene-product-orbit',
  'scene-product-explode',
  'scene-editorial-chapters',
  'scene-spatial-gallery',
  'scene-data-constellation',
  'scene-globe-network',
  'scene-ambient-landscape',
  'scene-image-reveal-story',
  'scene-portal-tunnel',
  'scene-kinetic-cards',
  'scene-ambient-particles',
] as const;

const EXACT_APP_IDS = [
  'scene-layered-hero',
  'scene-editorial-chapters',
  'scene-data-constellation',
  'scene-kinetic-cards',
  'scene-ambient-particles',
] as const;

describe('creative scene frozen catalog', () => {
  it('is an exact 12-ID bijection', () => {
    expect(CREATIVE_SCENE_IDS).toEqual(EXACT_IDS);
    expect(Object.keys(CREATIVE_SCENE_CATALOG)).toEqual(EXACT_IDS);
    expect(CREATIVE_SCENE_FIXTURES.map((fixture) => fixture.sceneId)).toEqual(EXACT_IDS);
    expect(new Set(CREATIVE_SCENE_IDS).size).toBe(12);
  });

  it('uses the exact app-compatible allowlist', () => {
    expect(CREATIVE_SCENE_APP_ALLOWLIST).toEqual(EXACT_APP_IDS);
    expect(CREATIVE_SCENE_IDS.filter(isCreativeSceneAppCompatible)).toEqual(EXACT_APP_IDS);
    for (const sceneId of EXACT_APP_IDS) {
      expect(validateCreativeSceneConfig(createCreativeSceneFixture(sceneId, 'app')).valid).toBe(
        true,
      );
    }
    expect(() => createCreativeSceneFixture('scene-product-orbit', 'app')).toThrow(
      /not compatible/,
    );
  });

  it('publishes one unique structural signature per scene', () => {
    const signatures = Object.values(CREATIVE_SCENE_STRUCTURAL_SIGNATURES);
    expect(signatures).toHaveLength(12);
    expect(new Set(signatures).size).toBe(12);
  });
});

describe('creative scene closed validation and fallback', () => {
  it('accepts every deterministic fixture and rejects unknown fields', () => {
    for (const fixture of CREATIVE_SCENE_FIXTURES) {
      expect(validateCreativeSceneConfig(fixture), fixture.sceneId).toEqual({
        valid: true,
        issues: [],
      });
    }
    const fixture = createCreativeSceneFixture('scene-layered-hero');
    const invalid = validateCreativeSceneConfig({ ...fixture, arbitraryCss: 'display:none' });
    expect(invalid.valid).toBe(false);
    expect(invalid.issues).toContainEqual(
      expect.objectContaining({ code: 'scene.unknown-field', path: 'arbitraryCss' }),
    );
  });

  it('enforces host count, instance uniqueness and foreground ownership', () => {
    const first = {
      ...createCreativeSceneFixture('scene-layered-hero'),
      plane: 'foreground' as const,
    };
    const second = {
      ...createCreativeSceneFixture('scene-ambient-particles'),
      instanceId: first.instanceId,
      plane: 'foreground' as const,
    };
    const result = validateCreativeSceneHost([first, second], 'site');
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['host.duplicate-instance-id', 'host.duplicate-foreground']),
    );
  });

  it('maps every reason to the frozen scene fallback deterministically', () => {
    for (const fixture of CREATIVE_SCENE_FIXTURES) {
      const first = resolveCreativeSceneProjection(fixture, {
        server: false,
        reducedMotion: true,
      });
      const second = resolveCreativeSceneProjection(fixture, {
        server: false,
        reducedMotion: true,
      });
      expect(first).toEqual(second);
      expect(first).toEqual({
        mode: 'fallback',
        fallbackId: CREATIVE_SCENE_CATALOG[fixture.sceneId].fallbackId,
        reason: 'reduced-motion',
        renderAdvancedModule: false,
      });
    }
  });

  it('keeps optional-engine DOM scenes primary when the engine is unavailable', () => {
    expect(
      resolveCreativeSceneProjection(createCreativeSceneFixture('scene-layered-hero'), {
        server: false,
        advancedEngines: false,
      }),
    ).toMatchObject({ mode: 'primary', renderAdvancedModule: false });
    expect(
      resolveCreativeSceneProjection(createCreativeSceneFixture('scene-product-orbit'), {
        server: false,
        advancedEngines: false,
      }),
    ).toMatchObject({ mode: 'fallback', reason: 'engine-unavailable' });
  });
});
