import { describe, expect, it } from 'vitest';
import type { AppEndooSemanticPlan } from '../../../api/contracts/appendoo/semanticPlan.types';
import {
  extractServerFunctionIdFromPlan,
  formatServerFunctionUiPipelineReadyMessage,
  isServerFunctionUiPipelinePlan,
} from '../serverFunctionUiPipeline';

const samplePlan = (evidenceIds: string[]): AppEndooSemanticPlan => ({
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
    evidenceIds,
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
});

describe('serverFunctionUiPipeline', () => {
  it('detects server-function UI plans', () => {
    expect(isServerFunctionUiPipelinePlan(samplePlan(['function:math.sum-two-numbers']))).toBe(true);
    expect(isServerFunctionUiPipelinePlan(samplePlan(['page:users']))).toBe(false);
  });

  it('formats approval guidance for the detected function', () => {
    const message = formatServerFunctionUiPipelineReadyMessage(
      samplePlan(['function:math.sum-two-numbers']),
    );
    expect(message).toContain('math.sum-two-numbers');
    expect(extractServerFunctionIdFromPlan(samplePlan(['function:math.sum-two-numbers']))).toBe('math.sum-two-numbers');
  });
});
