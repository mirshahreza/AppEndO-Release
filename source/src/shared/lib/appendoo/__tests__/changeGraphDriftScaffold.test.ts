import { describe, expect, it } from 'vitest';
import { compileChangeGraphFromPlan } from '../changeGraphCompiler';
import { buildSemanticPlan } from '../semanticPlanBuilder';
import { buildGeSfUi001ContextPack, GE_SF_UI_001_PROMPT } from '../goldenEvalServerFunctionUi';
import {
  annotateChangeGraphCapabilitySnapshot,
  validateChangeGraphCapabilityDrift,
  validateChangeGraphDrift,
} from '../changeGraphDriftScaffold';

describe('changeGraphDriftScaffold', () => {
  it('detects capability snapshot drift', () => {
    const plan = buildSemanticPlan({
      applicationScope: {
        kind: 'platform',
        scopeKey: 'platform:studio:page:server-functions',
        mountId: 'studio',
        pageKey: 'server-functions',
      },
      contextPack: buildGeSfUi001ContextPack(),
      userPrompt: GE_SF_UI_001_PROMPT,
    });
    const graph = annotateChangeGraphCapabilitySnapshot(compileChangeGraphFromPlan(plan));

    expect(validateChangeGraphDrift(graph).ok).toBe(true);

    const drifted = validateChangeGraphCapabilityDrift(
      graph.nodes,
      graph.nodes[0]?.capabilitySnapshotVersion ?? 'old',
      'changed-snapshot',
    );
    expect(drifted.length).toBeGreaterThan(0);
  });
});
