/**
 * E2E Engineering Pipeline WF-4 — generic full-stack prompts fail closed; vertical slice remains available.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { engineeringPipelineService } from '../../appendoo/engineeringPipeline.service';
import { semanticPlanApprovalService } from '../../appendoo/semanticPlanApproval.service';
import { closeSharedCheckpointDb } from '../../../../shared/lib/appendoo/changeGraphCheckpointSqliteBacking';
import {
  assertEngineeringPipelineGraderSummary,
  GE_SF_UI_001_PROMPT,
  runEngineeringPipelineBlockedScaffold,
  runEngineeringPipelineE2E,
  serverFunctionsPageContext,
  serverFunctionsScope,
  sumTwoNumbersPageContext,
  usersPageContext,
  usersScope,
} from './e2eEngineeringPipeline.helpers';

describe('E2E Engineering Pipeline WF-4 full-stack sequential', () => {
  beforeEach(() => {
    engineeringPipelineService.resetForTests();
    semanticPlanApprovalService.resetForTests();
  });

  afterEach(() => {
    closeSharedCheckpointDb();
  });

  it('blocks generic backend/UI prompts but keeps exact server-function UI slice green', () => {
    const backend = runEngineeringPipelineBlockedScaffold({
      applicationScope: serverFunctionsScope(),
      pageContext: serverFunctionsPageContext(),
      userPrompt: 'Add items API backend server function',
    });
    expect(backend.plan.authority).toBe('SCAFFOLD');

    engineeringPipelineService.resetForTests();
    semanticPlanApprovalService.resetForTests();

    const frontend = runEngineeringPipelineBlockedScaffold({
      applicationScope: usersScope(),
      pageContext: usersPageContext(),
      userPrompt: 'Build Items CRUD UI bound to the API',
    });
    expect(frontend.plan.authority).toBe('SCAFFOLD');

    engineeringPipelineService.resetForTests();
    semanticPlanApprovalService.resetForTests();

    const verticalSlice = runEngineeringPipelineE2E({
      applicationScope: serverFunctionsScope(),
      pageContext: sumTwoNumbersPageContext(),
      userPrompt: GE_SF_UI_001_PROMPT,
    });
    assertEngineeringPipelineGraderSummary(verticalSlice.executed);
  });
});
