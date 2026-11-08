import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  ThreeProductStage,
  VISUAL_ENGINE_CATALOG,
  VISUAL_ENGINE_IDS,
  VISUAL_ENGINE_LAZY_REGISTRY,
  VisualEngineFallback,
  validateVisualEngineConfig,
} from '..';
import type { CanvasParticleSystemConfig, ThreeProductStageConfig } from '..';

vi.mock('three', () => {
  throw new Error('Three must not be evaluated for a static fallback.');
});

const HASH = 'a'.repeat(64);
const particle: CanvasParticleSystemConfig = {
  engineId: 'canvas-particle-system',
  seed: 29,
  particleCount: 24,
  linkCount: 12,
  radius: 2,
  speed: 0.5,
  color: '#0d9488',
  background: '#ffffff',
};
const product: ThreeProductStageConfig = {
  engineId: 'three-product-stage',
  modelAsset: `/assets/workspace/${HASH}.glb`,
  posterAsset: `/assets/workspace/${HASH}.webp`,
  triangleCount: 80_000,
  materialCount: 4,
  textureCount: 4,
  exposure: 1,
  callouts: [{ id: 'detail', label: 'Detail', x: 25, y: 35 }],
};

describe('visual engine contracts', () => {
  it('keeps the exact eight IDs, catalog, and lazy registry in bijection', () => {
    expect(VISUAL_ENGINE_IDS).toHaveLength(8);
    expect(new Set(VISUAL_ENGINE_IDS).size).toBe(8);
    expect(Object.keys(VISUAL_ENGINE_CATALOG)).toEqual([...VISUAL_ENGINE_IDS]);
    expect(Object.keys(VISUAL_ENGINE_LAZY_REGISTRY)).toEqual([...VISUAL_ENGINE_IDS]);
    expect(VISUAL_ENGINE_IDS.map((id) => VISUAL_ENGINE_CATALOG[id].componentName)).toEqual([
      'CanvasParticleSystem',
      'CanvasVectorField',
      'ThreeProductStage',
      'ThreeModelOrbit',
      'ThreeSpatialGallery',
      'ThreeDataConstellation',
      'ShaderImageReveal',
      'ShaderAmbientField',
    ]);
  });

  it('accepts bounded local configs and rejects excess fields, remote assets, and limits', () => {
    expect(validateVisualEngineConfig(particle)).toEqual({ valid: true, issues: [] });
    expect(validateVisualEngineConfig(product)).toEqual({ valid: true, issues: [] });
    expect(validateVisualEngineConfig({ ...particle, particleCount: 181 }).valid).toBe(false);
    expect(validateVisualEngineConfig({ ...particle, source: 'void main(){}' }).issues).toContainEqual(
      expect.objectContaining({ code: 'unknown-field', path: 'source' }),
    );
    expect(
      validateVisualEngineConfig({ ...product, modelAsset: 'https://example.com/model.glb' }).issues,
    ).toContainEqual(expect.objectContaining({ code: 'invalid-asset', path: 'modelAsset' }));
  });

  it('renders seeded fallbacks deterministically without evaluating Three', () => {
    const first = renderToStaticMarkup(<VisualEngineFallback config={particle} reason="reduced-motion" />);
    const second = renderToStaticMarkup(<VisualEngineFallback config={particle} reason="reduced-motion" />);
    expect(first).toBe(second);
    expect(first).toContain('data-visual-engine-fallback="canvas-particle-system"');

    const productMarkup = renderToStaticMarkup(
      <ThreeProductStage config={product} capabilityOverride={{ snapshot: true }} />,
    );
    expect(productMarkup).toContain('data-fallback-reason="ssr"');
  });
});
