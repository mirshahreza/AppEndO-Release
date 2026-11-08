/**
 * E2E Engineering Pipeline WF-4.1 — generic CRUD prompts fail closed until vertical depth exists.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { engineeringPipelineService } from '../../appendoo/engineeringPipeline.service';
import { semanticPlanApprovalService } from '../../appendoo/semanticPlanApproval.service';
import { closeSharedCheckpointDb } from '../../../../shared/lib/appendoo/changeGraphCheckpointSqliteBacking';
import {
  runEngineeringPipelineBlockedScaffold,
  usersPageContext,
  usersScope,
} from './e2eEngineeringPipeline.helpers';

describe('E2E Engineering Pipeline WF-4.1 write pipeline smoke', () => {
  beforeEach(() => {
    engineeringPipelineService.resetForTests();
    semanticPlanApprovalService.resetForTests();
  });

  afterEach(() => {
    closeSharedCheckpointDb();
  });

  it('CRUD layout engineering prompt remains blocked as scaffold', () => {
    const scaffold = runEngineeringPipelineBlockedScaffold({
      applicationScope: usersScope(),
      pageContext: usersPageContext(),
      userPrompt: 'Create a standard Users Create/Edit CRUD form with validation fields',
    });

    expect(scaffold.plan.authority).toBe('SCAFFOLD');
    expect(scaffold.approvalBinding).toBeUndefined();
  });
});
