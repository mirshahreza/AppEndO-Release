/**
 * E2E — sum-two-numbers UI via engineering pipeline (realistic AppEndoo panel scenario).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { engineeringPipelineService } from '../../appendoo/engineeringPipeline.service';
import { semanticPlanApprovalService } from '../../appendoo/semanticPlanApproval.service';
import { closeSharedCheckpointDb } from '../../../../shared/lib/appendoo/changeGraphCheckpointSqliteBacking';
import {
  assertEngineeringPipelineGraderSummary,
  runEngineeringPipelineE2E,
  serverFunctionsScope,
  sumTwoNumbersPageContext,
  usersPageContext,
  usersScope,
  GE_SF_UI_001_PROMPT,
} from './e2eEngineeringPipeline.helpers';
import {
  resolveEffectiveUserIntent,
  detectUIIntent,
} from '../../../../shared/lib/detectCodingIntent';
import { resolveTurnExecutionProfile } from '../../../../core/ai/agent/turnExecutionProfile';
import { routeAssistantRequest } from '../../../domain/ai/assistantRequestRouter';

describe('E2E Engineering Pipeline sum-two-numbers UI', () => {
  beforeEach(() => {
    engineeringPipelineService.resetForTests();
    semanticPlanApprovalService.resetForTests();
  });

  afterEach(() => {
    closeSharedCheckpointDb();
  });

  it('continuation on open function routes to pipeline and deploys after approval', () => {
    const pageContext = sumTwoNumbersPageContext();
    const messages = [
      { role: 'user', content: 'try again' },
    ];
    const userPrompt = resolveEffectiveUserIntent(messages, pageContext);
    expect(detectUIIntent(userPrompt)).toBe(true);

    const executionProfile = resolveTurnExecutionProfile('agent', 'try again');
    expect(executionProfile).toBe('agent_implement');

    const routing = routeAssistantRequest({
      mode: 'agent',
      userPrompt,
      executionProfile,
      pageContext,
    });
    expect(routing.useEngineeringPipeline).toBe(false);

    const { scaffold, executed } = runEngineeringPipelineE2E({
      applicationScope: serverFunctionsScope(),
      pageContext,
      userPrompt: userPrompt || GE_SF_UI_001_PROMPT,
    });

    expect(scaffold.contextPack.primaryTargets.some((target) => target.ref === 'math.sum-two-numbers')).toBe(true);
    expect(scaffold.approvalBinding?.bindingId).toBeTruthy();
    expect(scaffold.plan.proposedArtifacts.some((artifact) => (
      artifact.kind === 'page' && artifact.action === 'create'
    ))).toBe(true);
    assertEngineeringPipelineGraderSummary(executed);
  });

  it('builds sum-two-numbers UI when prompted from an unrelated page', () => {
    const pageContext = usersPageContext();
    const userPrompt = 'Build a user interface for math.sum-two-numbers';

    const routing = routeAssistantRequest({
      mode: 'agent',
      userPrompt,
      executionProfile: resolveTurnExecutionProfile('agent', userPrompt),
      pageContext,
    });
    expect(routing.useEngineeringPipeline).toBe(false);

    const { scaffold } = runEngineeringPipelineE2E({
      applicationScope: usersScope(),
      pageContext,
      userPrompt,
    });

    expect(scaffold.contextPack.primaryTargets.some((target) => target.ref === 'math.sum-two-numbers')).toBe(true);
    expect(scaffold.plan.proposedArtifacts.some((artifact) => (
      artifact.kind === 'page' && artifact.action === 'create'
    ))).toBe(true);
  });
});
