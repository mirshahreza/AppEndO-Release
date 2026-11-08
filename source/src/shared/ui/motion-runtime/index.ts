export { APP_CREATIVE_MOTION_ALLOWLIST, CREATIVE_MOTION_CATALOG } from './catalog';
export { CreativeMotionTarget } from './CreativeMotionTarget';
export { CreativeMotionProvider, useCreativeMotionHost } from './provider';
export { resolveCreativeMotion } from './resolver';
export { buildCreativeMotionSelectionConfig } from './selectionConfig';
export type { CreativeMotionSelection } from './selectionConfig';
export {
  resolveMotionEnvironment,
  useCreativeMotion,
  useRouteCrossfade,
} from './runtime';
export {
  CREATIVE_MOTION_IDS,
} from './types';
export type {
  AuthoringTier,
  CostTier,
  CreativeMotionConfig,
  CreativeMotionDecision,
  CreativeMotionEnvironment,
  CreativeMotionExecutionEngine,
  CreativeMotionExperience,
  CreativeMotionFallback,
  CreativeMotionId,
  CreativeMotionIntensity,
  CreativeMotionMetadata,
  CreativeMotionProviderProps,
  CreativeMotionTargetProps,
  CreativeMotionTrigger,
  CreativeMotionViewport,
  RuntimeEngine,
} from './types';
export {
  isCreativeMotionId,
  isValidRuntimeTuple,
  validateCreativeMotionConfig,
  validateCreativeMotionMetadata,
} from './validation';
export type { CreativeMotionValidation } from './validation';
