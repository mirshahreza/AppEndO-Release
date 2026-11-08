import type { EngineRuntimeModule, VisualEngineId } from './types';

type RuntimeLoader = () => Promise<EngineRuntimeModule>;

const loadCanvas: RuntimeLoader = () => import('./canvasRuntime');
const loadThree: RuntimeLoader = () => import('./threeRuntime');

export const VISUAL_ENGINE_LAZY_REGISTRY: Readonly<Record<VisualEngineId, RuntimeLoader>> = {
  'canvas-particle-system': loadCanvas,
  'canvas-vector-field': loadCanvas,
  'three-product-stage': loadThree,
  'three-model-orbit': loadThree,
  'three-spatial-gallery': loadThree,
  'three-data-constellation': loadThree,
  'shader-image-reveal': loadThree,
  'shader-ambient-field': loadThree,
};

export function loadVisualEngineRuntime(id: VisualEngineId): Promise<EngineRuntimeModule> {
  return VISUAL_ENGINE_LAZY_REGISTRY[id]();
}
