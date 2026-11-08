/**
 * E2E Engineering Pipeline WF-3 — designer modify-existing requests fail closed until vertical depth exists.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { engineeringPipelineService } from '../../appendoo/engineeringPipeline.service';
import { semanticPlanApprovalService } from '../../appendoo/semanticPlanApproval.service';
import { closeSharedCheckpointDb } from '../../../../shared/lib/appendoo/changeGraphCheckpointSqliteBacking';
import {
  designerPageContext,
  runEngineeringPipelineBlockedScaffold,
  usersScope,
} from './e2eEngineeringPipeline.helpers';

describe('E2E Engineering Pipeline WF-3 designer modify-existing', () => {
  beforeEach(() => {
    engineeringPipelineService.resetForTests();
    semanticPlanApprovalService.resetForTests();
  });

  afterEach(() => {
    closeSharedCheckpointDb();
  });

  it('layout pageContext remains blocked for generic designer planning', () => {
    const layoutId = 'wf3-existing-layout';
    const scaffold = runEngineeringPipelineBlockedScaffold({
      applicationScope: usersScope(),
      pageContext: designerPageContext(layoutId),
      userPrompt: 'Add Apply filter button to the existing designer layout',
    });

    expect(scaffold.contextPack.primaryTargets.some((target) => target.kind === 'layout')).toBe(true);
    expect(scaffold.plan.authority).toBe('SCAFFOLD');
    expect(scaffold.approvalBinding).toBeUndefined();
  });
});
