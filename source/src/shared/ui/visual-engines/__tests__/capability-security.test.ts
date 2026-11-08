/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { PLATFORM_SHADER_SOURCES } from '../shaders';
import {
  resolveCreativeSceneCapability,
  validateVisualEngineConfig,
} from '../validation';
import type { CreativeCapabilityInput } from '../types';

const base: CreativeCapabilityInput = {
  runtimeEngine: 'webgl-three',
  costTier: 'high',
  viewport: 'desktop',
  visible: true,
  documentHidden: false,
  reducedMotion: false,
  saveData: false,
  effectiveType: '4g',
  deviceMemory: 8,
  forcedColors: false,
  printing: false,
  snapshot: false,
  webgl2: true,
  dpr: 2,
};

describe('Creative browser capability matrix', () => {
  it.each([
    ['Chromium', { scrollTimeline: true, viewTransition: true, webgl2: true }],
    ['Firefox', { scrollTimeline: true, viewTransition: false, webgl2: true }],
    ['WebKit', { scrollTimeline: false, viewTransition: true, webgl2: true }],
  ])('resolves the %s feature profile without requiring that browser binary', (_browser, profile) => {
    const decision = resolveCreativeSceneCapability({ ...base, webgl2: profile.webgl2 });
    expect(decision).toMatchObject({
      eligible: true,
      dpr: 2,
      maxBackingPixels: 2_500_000,
      maxTextureBytes: 64 * 1024 * 1024,
    });
  });

  it.each([
    ['reduced-motion', { reducedMotion: true }],
    ['save-data', { saveData: true }],
    ['slow-connection', { effectiveType: 'slow-2g' }],
    ['low-memory', { deviceMemory: 2 }],
    ['phone', { viewport: 'phone' as const }],
    ['offscreen', { visible: false }],
    ['hidden', { documentHidden: true }],
    ['forced-colors', { forcedColors: true }],
    ['print', { printing: true }],
    ['snapshot', { snapshot: true }],
    ['webgl-unavailable', { webgl2: false }],
  ])('selects deterministic %s fallback', (reason, override) => {
    expect(resolveCreativeSceneCapability({ ...base, ...override })).toEqual({
      eligible: false,
      reason,
      dpr: 1,
      maxBackingPixels: 0,
      maxTextureBytes: 0,
    });
  });

  it('caps tablet DPR, backing pixels, and texture memory', () => {
    expect(resolveCreativeSceneCapability({ ...base, viewport: 'tablet', dpr: 4 })).toMatchObject({
      eligible: true,
      dpr: 1.5,
      maxBackingPixels: 1_500_000,
      maxTextureBytes: 48 * 1024 * 1024,
    });
  });
});

describe('closed visual-engine security and resource contracts', () => {
  const hash = 'a'.repeat(64);

  it.each([
    ['model triangles', { triangleCount: 80_001 }],
    ['model materials', { materialCount: 5 }],
    ['model textures', { textureCount: 5 }],
  ])('rejects product-stage %s over the frozen limit', (_label, override) => {
    expect(validateVisualEngineConfig({
      engineId: 'three-product-stage',
      modelAsset: `/assets/workspace/${hash}.glb`,
      posterAsset: `/assets/workspace/${hash}.png`,
      triangleCount: 80_000,
      materialCount: 4,
      textureCount: 4,
      exposure: 1,
      callouts: [],
      ...override,
    }).valid).toBe(false);
  });

  it.each([
    ['remote texture', `https://attacker.test/${hash}.png`],
    ['data texture', 'data:image/png;base64,AA=='],
    ['blob texture', 'blob:https://example.test/id'],
    ['oversized gallery', `/assets/workspace/${hash}.png`],
  ])('rejects %s input', (label, assetRef) => {
    const images = Array.from({ length: label === 'oversized gallery' ? 21 : 3 }, (_, index) => ({
      id: `image-${index}`,
      assetRef,
      alt: `Image ${index}`,
    }));
    expect(validateVisualEngineConfig({
      engineId: 'three-spatial-gallery',
      seed: 1,
      images,
      spacing: 1,
    }).valid).toBe(false);
  });

  it('keeps platform shader sources immutable and CSP-safe', () => {
    expect(Object.isFrozen(PLATFORM_SHADER_SOURCES)).toBe(true);
    for (const source of Object.values(PLATFORM_SHADER_SOURCES)) {
      expect(Object.isFrozen(source)).toBe(true);
      expect(`${source.vertex}\n${source.fragment}`).not.toMatch(
        /\beval\b|new\s+Function|import\s*\(|https?:|data:|blob:|#include/i,
      );
      expect(source.vertex).toContain('void main()');
      expect(source.fragment).toContain('void main()');
    }
  });

  it('rejects uploaded shader source, defines, and module paths as unknown fields', () => {
    expect(validateVisualEngineConfig({
      engineId: 'shader-ambient-field',
      seed: 1,
      shaderId: 'ambient-flow-v1',
      uniforms: {
        scale: 1,
        speed: 1,
        warp: 1,
        noise: 0.5,
        colorA: '#000000',
        colorB: '#ffffff',
      },
      fragmentShader: 'void main(){}',
      defines: { UNSAFE: true },
      modulePath: 'https://cdn.test/shader.mjs',
    }).valid).toBe(false);
  });
});
