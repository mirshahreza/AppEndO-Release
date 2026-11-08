import { describe, expect, it } from 'vitest';
import {
  formatEngineeringPipelineAgentResultMessage,
  shouldAutoExecuteEngineeringPipelineInAgent,
} from '../engineeringPipelineAgentRun';
import type { EngineeringPipelineRunResult } from '../engineeringPipeline.service';

const deployedUiResult = (): EngineeringPipelineRunResult => ({
  plan: {
    planId: 'asp:test',
    revision: 1,
    applicationScopeRef: 'platform:studio:page:server-functions',
    contextPackId: 'ctxpack:test',
    objective: 'Build UI',
    scope: 'platform:studio:page:server-functions',
    resolvedTargets: [],
    requirements: [],
    assumptions: [],
    nonGoals: [],
    proposedArtifacts: [{
      artifactId: 'artifact:page:math-sum-two-numbers-calculator',
      kind: 'page',
      title: 'UI for sum-two-numbers',
      action: 'create',
      targetRef: 'math-sum-two-numbers-calculator',
      evidenceIds: ['function:math.sum-two-numbers'],
    }],
    artifactModifications: [],
    permissions: [],
    requiredCapabilities: [],
    capabilityGaps: [],
    appliedStandards: [],
    selectedPatterns: [],
    acceptanceCriteria: [],
    risks: [],
    conflicts: [],
    requestedOutcomes: [],
    compositionCandidates: [],
    createdAt: '2026-07-11T00:00:00.000Z',
  },
  planSummary: { artifactCount: 1, capabilityGapCount: 0, reuseSummary: { reusedCount: 0, adaptedCount: 0, newBuildCount: 1 } },
  changeGraph: {
    changeGraphId: 'cg:test',
    changeSetId: 'cs:test',
    applicationScopeRef: 'platform:studio:page:server-functions',
    revision: 1,
    compilerVersion: 'test',
    nodes: [],
    edges: [],
  },
  changeGraphSummary: {
    changeGraphId: 'cg:test',
    nodeCount: 1,
    plannedCount: 0,
    readyCount: 0,
    verifiedCount: 1,
    failedCount: 0,
    compilerVersion: 'test',
  },
  changeSetId: 'cs:test',
  contextPack: {
    contextPackId: 'ctxpack:test',
    revision: 1,
    applicationScopeRef: 'platform:studio:page:server-functions',
    indexVersions: {},
    tokenBudget: 8000,
    primaryTargets: [],
    dependencies: [],
    governance: [],
    businessRules: [],
    permissions: [],
    structuralEvidence: [],
    similarImplementations: [],
    trustedPatterns: [],
    engineeringStandards: [],
    capabilityEvidence: [],
    capabilityGaps: [],
    relevantChanges: [],
    excludedCandidates: [],
    unresolvedTerms: [],
    conflicts: [],
    selectionExplanations: [],
  },
  executedNodeCount: 1,
  failedNodeCount: 0,
  reconciledNodeCount: 1,
  deployable: true,
  promotionState: 'DEPLOYED',
  designerHandoff: [{
    layoutId: 'math-sum-two-numbers-calculator',
    name: 'UI for sum-two-numbers',
    componentPath: 'math/ui-for-sum-two-numbers',
  }],
});

describe('engineeringPipelineAgentRun', () => {
  it('auto-executes only for agent implement + engineering pipeline', () => {
    expect(shouldAutoExecuteEngineeringPipelineInAgent({
      mode: 'agent',
      executionProfile: 'agent_implement',
      useEngineeringPipeline: true,
    })).toBe(true);
    expect(shouldAutoExecuteEngineeringPipelineInAgent({
      mode: 'ask',
      executionProfile: 'ask_lookup',
      useEngineeringPipeline: false,
    })).toBe(false);
    expect(shouldAutoExecuteEngineeringPipelineInAgent({
      mode: 'agent',
      executionProfile: 'agent_lookup',
      useEngineeringPipeline: false,
    })).toBe(false);
  });

  it('formats a deployed result without asking for approval', () => {
    const message = formatEngineeringPipelineAgentResultMessage(deployedUiResult());
    expect(message).toContain('Done');
    expect(message).toContain('math/ui-for-sum-two-numbers');
    expect(message).not.toContain('Approve');
  });
});
