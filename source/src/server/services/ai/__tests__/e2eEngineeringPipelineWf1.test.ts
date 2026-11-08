/**
 * E2E Engineering Pipeline WF-1 — generic server-function requests fail closed until vertical depth exists.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { engineeringPipelineService } from '../../appendoo/engineeringPipeline.service';
import { semanticPlanApprovalService } from '../../appendoo/semanticPlanApproval.service';
import { closeSharedCheckpointDb } from '../../../../shared/lib/appendoo/changeGraphCheckpointSqliteBacking';
import {
  runEngineeringPipelineBlockedScaffold,
  serverFunctionsPageContext,
  serverFunctionsScope,
} from './e2eEngineeringPipeline.helpers';

describe('E2E Engineering Pipeline WF-1 server function', () => {
  beforeEach(() => {
    engineeringPipelineService.resetForTests();
    semanticPlanApprovalService.resetForTests();
  });

  afterEach(() => {
    closeSharedCheckpointDb();
  });

  it('blocks generic server-function planning from approval and execution', () => {
    const scaffold = runEngineeringPipelineBlockedScaffold({
      applicationScope: serverFunctionsScope(),
      pageContext: serverFunctionsPageContext(),
      userPrompt: 'Add a list items API server function',
    });

    expect(scaffold.plan.planId).toMatch(/^asp:/);
    expect(scaffold.plan.authority).toBe('SCAFFOLD');
    expect(scaffold.changeGraph).toBeUndefined();
    expect(scaffold.plan.blockingIssues?.some((issue) => issue.code === 'PLANNING_NOT_IMPLEMENTED')).toBe(true);
  });
});
