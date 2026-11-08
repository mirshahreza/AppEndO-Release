import type { AppEndooSemanticPlan } from '../../api/contracts/appendoo/semanticPlan.types';

export const isServerFunctionUiPipelinePlan = (plan: AppEndooSemanticPlan): boolean => (
  plan.proposedArtifacts.some((artifact) => (
    artifact.kind === 'page'
    && artifact.action === 'create'
    && artifact.evidenceIds.some((evidenceId) => evidenceId.startsWith('function:'))
  ))
);

export const extractServerFunctionIdFromPlan = (plan: AppEndooSemanticPlan): string | null => {
  for (const artifact of plan.proposedArtifacts) {
    if (artifact.kind !== 'page' || artifact.action !== 'create') {
      continue;
    }
    for (const evidenceId of artifact.evidenceIds) {
      if (evidenceId.startsWith('function:')) {
        const functionId = evidenceId.slice('function:'.length).trim();
        if (functionId) {
          return functionId;
        }
      }
    }
  }
  return null;
};

export const formatServerFunctionUiPipelineReadyMessage = (plan: AppEndooSemanticPlan): string => {
  const functionId = extractServerFunctionIdFromPlan(plan);
  const target = functionId ?? 'the requested server function';
  return `Building UI for ${target}…`;
};
