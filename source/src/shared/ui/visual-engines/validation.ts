import { VISUAL_ENGINE_CATALOG, VISUAL_ENGINE_LIMITS } from './catalog';
import type {
  CreativeCapabilityInput,
  CreativeSceneCapability,
  VisualEngineConfig,
  VisualEngineId,
} from './types';
import { VISUAL_ENGINE_IDS } from './types';

export type VisualEngineValidationIssue = {
  path: string;
  code: 'unknown-engine' | 'unknown-field' | 'invalid-value' | 'invalid-asset' | 'invalid-reference';
  message: string;
};

export type VisualEngineValidationResult = {
  valid: boolean;
  issues: readonly VisualEngineValidationIssue[];
};

const HEX = /^#[0-9a-f]{6}$/i;
const SAFE_ID = /^[a-z][a-z0-9-]{0,63}$/;
const LOCAL_RASTER =
  /^\/assets\/workspace\/[a-f0-9]{64}\.(?:png|jpg|jpeg|webp|avif)$/;
const LOCAL_MODEL = /^\/assets\/workspace\/[a-f0-9]{64}\.(?:glb|gltf)$/;
const IDS = new Set<string>(VISUAL_ENGINE_IDS);

const KEYS: Record<VisualEngineId, readonly string[]> = {
  'canvas-particle-system': ['engineId', 'seed', 'particleCount', 'linkCount', 'radius', 'speed', 'color', 'background'],
  'canvas-vector-field': ['engineId', 'seed', 'columns', 'rows', 'forces', 'lineLength', 'color', 'background'],
  'three-product-stage': ['engineId', 'modelAsset', 'posterAsset', 'triangleCount', 'materialCount', 'textureCount', 'exposure', 'callouts'],
  'three-model-orbit': ['engineId', 'modelAsset', 'posterAsset', 'triangleCount', 'materialCount', 'textureCount', 'orbitRadius', 'annotations'],
  'three-spatial-gallery': ['engineId', 'seed', 'images', 'spacing'],
  'three-data-constellation': ['engineId', 'seed', 'nodes', 'edges', 'color'],
  'shader-image-reveal': ['engineId', 'imageAsset', 'alt', 'shaderId', 'uniforms'],
  'shader-ambient-field': ['engineId', 'seed', 'shaderId', 'uniforms'],
};

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function finite(value: unknown, min: number, max: number, integer = false): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value));
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  issues: VisualEngineValidationIssue[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      issues.push({ path: `${path}${key}`, code: 'unknown-field', message: `${key} is not in the closed schema.` });
    }
  }
}

function safeText(value: unknown, max: number): boolean {
  return typeof value === 'string' && value.length > 0 && value.length <= max && !/[<>]/.test(value);
}

function common(config: Record<string, unknown>, issues: VisualEngineValidationIssue[]): VisualEngineId | null {
  if (typeof config.engineId !== 'string' || !IDS.has(config.engineId)) {
    issues.push({ path: 'engineId', code: 'unknown-engine', message: 'Engine ID is not in the closed catalog.' });
    return null;
  }
  const id = config.engineId as VisualEngineId;
  exactKeys(config, KEYS[id], '', issues);
  if ('seed' in config && !finite(config.seed, 0, 2_147_483_647, true)) {
    issues.push({ path: 'seed', code: 'invalid-value', message: 'Seed must be a bounded non-negative integer.' });
  }
  return id;
}

function validateCallouts(value: unknown, maximum: number, path: string, issues: VisualEngineValidationIssue[]) {
  if (!Array.isArray(value) || value.length > maximum) {
    issues.push({ path, code: 'invalid-value', message: `At most ${maximum} DOM callouts are allowed.` });
    return;
  }
  value.forEach((entry, index) => {
    if (!object(entry)) return issues.push({ path: `${path}.${index}`, code: 'invalid-value', message: 'Callout must be an object.' });
    exactKeys(entry, ['id', 'label', 'body', 'x', 'y'], `${path}.${index}.`, issues);
    if (!safeText(entry.id, 64) || !SAFE_ID.test(entry.id as string) || !safeText(entry.label, 120) || (entry.body !== undefined && !safeText(entry.body, 400)) || !finite(entry.x, 0, 100) || !finite(entry.y, 0, 100)) {
      issues.push({ path: `${path}.${index}`, code: 'invalid-value', message: 'Callout fields are outside their closed bounds.' });
    }
  });
}

export function validateVisualEngineConfig(value: unknown): VisualEngineValidationResult {
  const issues: VisualEngineValidationIssue[] = [];
  if (!object(value)) return { valid: false, issues: [{ path: '', code: 'invalid-value', message: 'Config must be an object.' }] };
  const id = common(value, issues);
  if (!id) return { valid: false, issues };
  const bad = (path: string, message = 'Value is outside the closed bounds.') =>
    issues.push({ path, code: 'invalid-value', message });
  const asset = (path: string, candidate: unknown, model = false) => {
    if (typeof candidate !== 'string' || !(model ? LOCAL_MODEL : LOCAL_RASTER).test(candidate)) {
      issues.push({ path, code: 'invalid-asset', message: 'Only sanitized local workspace assets are allowed.' });
    }
  };

  switch (id) {
    case 'canvas-particle-system':
      if (!finite(value.particleCount, 10, 180, true)) bad('particleCount');
      if (!finite(value.linkCount, 0, 180, true)) bad('linkCount');
      if (!finite(value.radius, 0.5, 6) || !finite(value.speed, 0, 2) || !HEX.test(String(value.color)) || !HEX.test(String(value.background))) bad('appearance');
      break;
    case 'canvas-vector-field':
      if (!finite(value.columns, 2, 32, true) || !finite(value.rows, 2, 18, true) || !finite(value.lineLength, 2, 30) || !HEX.test(String(value.color)) || !HEX.test(String(value.background))) bad('geometry');
      if (!Array.isArray(value.forces) || value.forces.length > 3) bad('forces');
      else value.forces.forEach((force, index) => {
        if (!object(force)) return bad(`forces.${index}`);
        exactKeys(force, ['x', 'y', 'strength', 'radius'], `forces.${index}.`, issues);
        if (!finite(force.x, 0, 1) || !finite(force.y, 0, 1) || !finite(force.strength, -2, 2) || !finite(force.radius, 0.05, 1)) bad(`forces.${index}`);
      });
      break;
    case 'three-product-stage':
    case 'three-model-orbit': {
      asset('modelAsset', value.modelAsset, true);
      asset('posterAsset', value.posterAsset);
      const orbit = id === 'three-model-orbit';
      if (!finite(value.triangleCount, 1, orbit ? VISUAL_ENGINE_LIMITS.orbitTriangles : VISUAL_ENGINE_LIMITS.productTriangles, true)) bad('triangleCount');
      if (!finite(value.materialCount, 1, orbit ? 6 : 4, true) || !finite(value.textureCount, 0, orbit ? 6 : 4, true)) bad('resources');
      if (orbit) {
        if (!finite(value.orbitRadius, 1, 12)) bad('orbitRadius');
        validateCallouts(value.annotations, 8, 'annotations', issues);
      } else {
        if (!finite(value.exposure, 0.25, 2)) bad('exposure');
        validateCallouts(value.callouts, 8, 'callouts', issues);
      }
      break;
    }
    case 'three-spatial-gallery':
      if (!Array.isArray(value.images) || value.images.length < 3 || value.images.length > 20) bad('images');
      else value.images.forEach((image, index) => {
        if (!object(image)) return bad(`images.${index}`);
        exactKeys(image, ['id', 'assetRef', 'alt'], `images.${index}.`, issues);
        asset(`images.${index}.assetRef`, image.assetRef);
        if (!safeText(image.id, 64) || !SAFE_ID.test(image.id as string) || !safeText(image.alt, 180)) bad(`images.${index}`);
      });
      if (!finite(value.spacing, 0.5, 4)) bad('spacing');
      break;
    case 'three-data-constellation': {
      if (!Array.isArray(value.nodes) || value.nodes.length < 1 || value.nodes.length > 96) bad('nodes');
      const nodeIds = new Set<string>();
      if (Array.isArray(value.nodes)) value.nodes.forEach((node, index) => {
        if (!object(node)) return bad(`nodes.${index}`);
        exactKeys(node, ['id', 'label', 'value', 'group'], `nodes.${index}.`, issues);
        if (!safeText(node.id, 64) || !SAFE_ID.test(node.id as string) || nodeIds.has(node.id as string) || !safeText(node.label, 120) || !finite(node.value, 0, 1_000_000) || !finite(node.group, 0, 15, true)) bad(`nodes.${index}`);
        else nodeIds.add(node.id as string);
      });
      if (!Array.isArray(value.edges) || value.edges.length > 192) bad('edges');
      else value.edges.forEach((edge, index) => {
        if (!object(edge)) return bad(`edges.${index}`);
        exactKeys(edge, ['source', 'target', 'weight'], `edges.${index}.`, issues);
        if (!nodeIds.has(String(edge.source)) || !nodeIds.has(String(edge.target)) || !finite(edge.weight, 0, 1)) issues.push({ path: `edges.${index}`, code: 'invalid-reference', message: 'Edge must reference local nodes with bounded weight.' });
      });
      if (!HEX.test(String(value.color))) bad('color');
      break;
    }
    case 'shader-image-reveal':
      asset('imageAsset', value.imageAsset);
      if (!safeText(value.alt, 180) || value.shaderId !== 'image-soft-wipe-v1' || !object(value.uniforms)) bad('shader');
      else {
        exactKeys(value.uniforms, ['progress', 'softness', 'displacement', 'grain'], 'uniforms.', issues);
        if (!finite(value.uniforms.progress, 0, 1) || !finite(value.uniforms.softness, 0.01, 0.5) || !finite(value.uniforms.displacement, 0, 1) || !finite(value.uniforms.grain, 0, 0.25)) bad('uniforms');
      }
      break;
    case 'shader-ambient-field':
      if (value.shaderId !== 'ambient-flow-v1' || !object(value.uniforms)) bad('shader');
      else {
        exactKeys(value.uniforms, ['scale', 'speed', 'warp', 'noise', 'colorA', 'colorB'], 'uniforms.', issues);
        if (!finite(value.uniforms.scale, 0.25, 8) || !finite(value.uniforms.speed, 0, 2) || !finite(value.uniforms.warp, 0, 2) || !finite(value.uniforms.noise, 0, 1) || !HEX.test(String(value.uniforms.colorA)) || !HEX.test(String(value.uniforms.colorB))) bad('uniforms');
      }
  }
  return { valid: issues.length === 0, issues };
}

function probeWebGl2(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true }));
  } catch {
    return false;
  }
}

export function resolveCreativeSceneCapability(input: CreativeCapabilityInput): CreativeSceneCapability {
  const viewport = input.viewport ?? 'desktop';
  const fallback = (reason: CreativeSceneCapability['reason']): CreativeSceneCapability => ({
    eligible: false,
    reason,
    dpr: 1,
    maxBackingPixels: 0,
    maxTextureBytes: 0,
  });
  if (typeof window === 'undefined' || typeof document === 'undefined') return fallback('ssr');
  if (input.snapshot) return fallback('snapshot');
  if (input.printing) return fallback('print');
  if (input.forcedColors) return fallback('forced-colors');
  if (input.reducedMotion) return fallback('reduced-motion');
  if (input.saveData) return fallback('save-data');
  if (input.effectiveType === '2g' || input.effectiveType === 'slow-2g') return fallback('slow-connection');
  if (input.deviceMemory !== undefined && input.deviceMemory < 4) return fallback('low-memory');
  if (viewport === 'phone') return fallback('phone');
  if (input.visible === false) return fallback('offscreen');
  if (input.documentHidden) return fallback('hidden');
  if (input.runtimeEngine === 'webgl-three' && !(input.webgl2 ?? probeWebGl2())) return fallback('webgl-unavailable');
  const tablet = viewport === 'tablet';
  const dpr = Math.min(input.dpr ?? window.devicePixelRatio ?? 1, tablet ? 1.5 : 2);
  return {
    eligible: true,
    dpr,
    maxBackingPixels: tablet ? 1_500_000 : 2_500_000,
    maxTextureBytes: tablet ? 48 * 1024 * 1024 : 64 * 1024 * 1024,
  };
}

export function visualEngineMeta(config: VisualEngineConfig) {
  return VISUAL_ENGINE_CATALOG[config.engineId];
}
