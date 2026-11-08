import type { WorkflowModel } from '../awm/types';
import { workflowModelSchema } from '../awm/schemas';
import { WORKFLOW_ERROR_REGISTRY } from '../errors';
import type { PublicationValidationResult, ValidationIssue } from './validationTypes';
import { runStructuralValidation } from './rules/structuralValidation';
import { runParallelValidation } from './rules/parallelValidation';
import { runExpressionValidation, runVariableWriteConflictValidation, runPureFunctionAvailabilityValidation } from './rules/expressionValidation';
import { runPolicyLimitValidation } from './rules/policyLimitValidation';
import { runActionResolutionValidation } from './rules/actionResolutionValidation';
import { runSubflowValidation } from './rules/subflowValidation';
import { runWorkItemFormValidation } from './rules/workItemFormValidation';

/**
 * Publication validator orchestrator — sole authority per
 * docs/standards/workflow-engine-testing.md (doc 05 §13)
 * every registered rule module against one candidate AWM and returns a closed PASSED/FAILED
 * result plus the resolved Action bindings a PASSED result needs for the resolved snapshot
 * (`resolvedSnapshot.ts`). This is the same validator draft-preview validation (doc 02 section 17)
 * and publication use, per doc 11 section 25's requirement that authoring and publication share
 * one validation authority.
 *
 * Rule ordering matters for readability of the returned issue list only — every rule module is
 * independent and does not depend on another module's issues to run correctly, except that
 * expression/parallel/variable-conflict rules are skipped when structuralValidation already
 * detected a cycle (dominance and region analysis require an acyclic topological order).
 */
export async function validateWorkflowDraftForPublication(model: WorkflowModel, ownerScopeKey: string): Promise<PublicationValidationResult> {
  const shapeCheck = workflowModelSchema.safeParse(model);
  if (!shapeCheck.success) {
    return {
      status: 'FAILED',
      issues: [{ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM, severity: 'ERROR', message: 'Draft failed canonical AWM shape validation.', details: { issues: shapeCheck.error.issues } }],
      actionBindings: [],
    };
  }
  const parsedModel = shapeCheck.data as WorkflowModel;

  const issues: ValidationIssue[] = [];
  const structural = runStructuralValidation(parsedModel);
  issues.push(...structural.issues);

  if (structural.order !== null) {
    const parallel = runParallelValidation(parsedModel, structural.graph, structural.reachable);
    issues.push(...parallel.issues);
    issues.push(...runExpressionValidation(parsedModel, structural.graph, structural.order));
    issues.push(...runVariableWriteConflictValidation(parsedModel, parallel.membership));
  }

  issues.push(...runPureFunctionAvailabilityValidation(parsedModel));
  issues.push(...runPolicyLimitValidation(parsedModel));
  issues.push(...(await runSubflowValidation(parsedModel, ownerScopeKey)));
  issues.push(...runWorkItemFormValidation(parsedModel));

  // Action resolution only runs once the graph/policy shape is sound — resolving Actions against
  // an already-invalid graph would produce noisy secondary issues with no diagnostic value.
  let actionBindings: PublicationValidationResult['actionBindings'] = [];
  if (!issues.some((i) => i.severity === 'ERROR')) {
    const actionResolution = runActionResolutionValidation(parsedModel);
    issues.push(...actionResolution.issues);
    actionBindings = actionResolution.actionBindings;
  }

  const status = issues.some((i) => i.severity === 'ERROR') ? 'FAILED' : 'PASSED';
  return { status, issues, actionBindings: status === 'PASSED' ? actionBindings : [] };
}
