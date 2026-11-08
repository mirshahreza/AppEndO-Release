import type { AppEndooSemanticPlan } from '../../api/contracts/appendoo/semanticPlan.types';
import type { ChangeNode } from '../../api/contracts/appendoo/changeGraph.types';
import type { BuilderContext, BuilderValidationResult } from '../../api/contracts/appendoo/builderProtocol.types';
import { assertBuilderInputSufficient } from './semanticPlanAuthorityGates';

export const validateBuilderSemanticInputSufficiency = (
  plan: AppEndooSemanticPlan | undefined,
  changeNode: ChangeNode,
): BuilderValidationResult => {
  if (!plan) {
    return {
      ok: false,
      phase: 'validate',
      errors: ['Semantic plan is required for builder input sufficiency validation.'],
      warnings: [],
    };
  }

  const sufficiency = assertBuilderInputSufficient(plan, changeNode.operationType);
  if (!sufficiency.ok) {
    return {
      ok: false,
      phase: 'validate',
      errors: sufficiency.errors,
      warnings: [],
    };
  }

  return {
    ok: true,
    phase: 'validate',
    errors: [],
    warnings: [],
  };
};

export const validateBuilderContextWithPlan = (
  context: BuilderContext,
  paths: string[],
  plan: AppEndooSemanticPlan | undefined,
  baseValidate: (context: BuilderContext, paths: string[]) => BuilderValidationResult,
): BuilderValidationResult => {
  const base = baseValidate(context, paths);
  if (!base.ok) {
    return base;
  }

  return validateBuilderSemanticInputSufficiency(plan, context.changeNode);
};
