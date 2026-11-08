import type { BuilderPhase } from '../../api/contracts/appendoo/builderProtocol.types';
import { DEFAULT_BUILDER_REGISTRY } from '../../api/contracts/appendoo/builderProtocol.types';

export const BUILDER_ORCHESTRATION_VERSION = '1.0.0';

export const BUILDER_PHASE_ORDER: BuilderPhase[] = [
  'validate',
  'preview',
  'execute',
  'reconcile',
  'rollback',
];

export type BuilderOrchestrationPolicy = {
  version: string;
  maxParallelBranches: number;
  requirePreviewBeforeExecute: boolean;
  requireWorkspaceIsolation: boolean;
  allowedPhases: BuilderPhase[];
};

export const DEFAULT_BUILDER_ORCHESTRATION_POLICY: BuilderOrchestrationPolicy = {
  version: BUILDER_ORCHESTRATION_VERSION,
  maxParallelBranches: 4,
  requirePreviewBeforeExecute: true,
  requireWorkspaceIsolation: true,
  allowedPhases: ['validate', 'preview', 'execute', 'reconcile', 'rollback'],
};

export const summarizeBuilderOrchestration = (
  policy: BuilderOrchestrationPolicy = DEFAULT_BUILDER_ORCHESTRATION_POLICY,
) => ({
  version: policy.version,
  registeredBuilderCount: DEFAULT_BUILDER_REGISTRY.length,
  phaseOrder: BUILDER_PHASE_ORDER,
  maxParallelBranches: policy.maxParallelBranches,
});

export const isAllowedBuilderPhase = (
  phase: BuilderPhase,
  policy: BuilderOrchestrationPolicy = DEFAULT_BUILDER_ORCHESTRATION_POLICY,
): boolean => policy.allowedPhases.includes(phase);

export const getNextBuilderPhase = (
  current: BuilderPhase | null,
): BuilderPhase | null => {
  if (!current) return BUILDER_PHASE_ORDER[0] ?? null;
  const index = BUILDER_PHASE_ORDER.indexOf(current);
  if (index < 0 || index >= BUILDER_PHASE_ORDER.length - 1) return null;
  return BUILDER_PHASE_ORDER[index + 1] ?? null;
};
