import { expect } from 'vitest';
import type { AiPageContext } from '../../../../shared/api/contracts/ai/pageContext';
import type { ApplicationScopeRef } from '../../../../shared/api/contracts/appendoo/applicationScope.types';
import {
  engineeringPipelineService,
  type EngineeringPipelineRunResult,
  type RunEngineeringPipelineInput,
} from '../../appendoo/engineeringPipeline.service';
import { semanticPlanApprovalService } from '../../appendoo/semanticPlanApproval.service';
import { GE_SF_UI_001_PROMPT } from '../../../../shared/lib/appendoo/goldenEvalServerFunctionUi';

export { GE_SF_UI_001_PROMPT };

export type EngineeringPipelineE2EInput = Omit<
  RunEngineeringPipelineInput,
  'executeBuilders' | 'requiresApproval'
> & {
  approvedBy?: string;
};

export const runEngineeringPipelineE2E = (
  input: EngineeringPipelineE2EInput,
): { scaffold: EngineeringPipelineRunResult; executed: EngineeringPipelineRunResult } => {
  const scaffold = engineeringPipelineService.runScaffold({
    ...input,
    executeBuilders: true,
    requiresApproval: true,
  });

  expect(scaffold.planActionPolicy.canApprove).toBe(true);

  const bindingId = scaffold.approvalBinding?.bindingId;
  expect(bindingId).toBeTruthy();

  semanticPlanApprovalService.approve(bindingId!, input.approvedBy ?? 'e2e-test');

  const executed = engineeringPipelineService.executeApprovedBinding(bindingId!);
  return { scaffold, executed };
};

export const runEngineeringPipelineBlockedScaffold = (
  input: EngineeringPipelineE2EInput,
): EngineeringPipelineRunResult => {
  const scaffold = engineeringPipelineService.runScaffold({
    ...input,
    executeBuilders: true,
    requiresApproval: true,
  });

  expect(scaffold.plan.authority).toBe('SCAFFOLD');
  expect(scaffold.planActionPolicy.canApprove).toBe(false);
  expect(scaffold.approvalBinding).toBeUndefined();
  expect(scaffold.executedNodeCount).toBe(0);
  return scaffold;
};

export const assertEngineeringPipelineGraderSummary = (
  executed: EngineeringPipelineRunResult,
): void => {
  expect(executed.verificationGraderSummary).toBeDefined();
  expect(executed.verificationGraderSummary!.length).toBeGreaterThan(0);
  expect(executed.verificationRunId).toMatch(/^verify:/);
  expect(executed.deployable).toBe(true);
  expect(executed.promotionState).toBe('DEPLOYED');
};

export const serverFunctionsScope = (): ApplicationScopeRef => ({
  kind: 'platform',
  scopeKey: 'platform:studio:page:server-functions',
  mountId: 'studio',
  pageKey: 'server-functions',
});

export const usersScope = (): ApplicationScopeRef => ({
  kind: 'platform',
  scopeKey: 'platform:studio:page:users',
  mountId: 'studio',
  pageKey: 'users',
});

export const serverFunctionsPageContext = (): AiPageContext => ({
  path: '/us/studio/server-functions',
  pageLabel: 'Server Functions',
  pageKey: 'server-functions',
});

export const usersPageContext = (): AiPageContext => ({
  path: '/us/studio/users',
  pageLabel: 'Users',
  pageKey: 'users',
});

export const sumTwoNumbersPageContext = (): AiPageContext => ({
  path: '/us/studio/server-functions/math/sum-two-numbers',
  pageLabel: 'Server Functions',
  pageKey: 'server-functions',
  functionId: 'math.sum-two-numbers',
  functionName: 'sum-two-numbers',
});

export const designerPageContext = (layoutId: string): AiPageContext => ({
  path: '/client-components',
  pageLabel: 'Designer',
  pageKey: 'client-components',
  layoutId,
  selectedNodeId: layoutId,
});
