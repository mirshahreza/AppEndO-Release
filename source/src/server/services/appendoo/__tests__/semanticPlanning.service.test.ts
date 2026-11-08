import { describe, expect, it } from 'vitest';
import { semanticPlanningService } from '../semanticPlanning.service';
import { MATH_SUM_TWO_NUMBERS_FIXTURE } from '../../../../shared/lib/appendoo/serverFunctionContractFixtures';
import { GE_SF_UI_001_PROMPT } from '../../../../shared/lib/appendoo/goldenEvalServerFunctionUi';
import { serverFunctionsScope } from '../../ai/__tests__/e2eEngineeringPipeline.helpers';

describe('semanticPlanningService', () => {
  it('builds plan and change graph from context input', () => {
    // A generic prompt with no resolvable function target only ever reaches the
    // AE-HARDEN scaffold path, which is deliberately non-authoritative (no changeGraph
    // can compile from it — see semanticPlanBuilder.ts). Route through the one vertical
    // slice that is actually implemented (server-function UI planning) so this test
    // exercises a real, compilable plan instead of asserting on scaffold-only fields.
    const result = semanticPlanningService.buildPlanFromContextInput({
      applicationScope: serverFunctionsScope(),
      pageContext: {
        path: '/us/studio/server-functions/math/sum-two-numbers',
        pageLabel: 'Sum Two Numbers',
        pageKey: 'server-functions',
        functionId: MATH_SUM_TWO_NUMBERS_FIXTURE.canonicalId,
      },
      userPrompt: GE_SF_UI_001_PROMPT,
    });

    expect(result.contextPack.contextPackId).toMatch(/^ctxpack:/);
    expect(result.planSummary.planId).toBe(result.plan.planId);
    expect(result.changeGraph?.nodes.length).toBeGreaterThan(0);
  });
});
