import { describe, expect, it } from 'vitest';
import { buildSemanticPlan, buildSemanticPlanScaffold } from '../semanticPlanBuilder';
import {
  ChangeGraphCompileForbiddenError,
  compileChangeGraphFromPlan,
} from '../changeGraphCompiler';
import { resolvePlanActionPolicy } from '../semanticPlanAuthorityGates';
import { serverFunctionsScope } from '../../../../server/services/ai/__tests__/e2eEngineeringPipeline.helpers';
import { buildGeSfUi001ContextPack, GE_SF_UI_001_PROMPT } from '../goldenEvalServerFunctionUi';

describe('semanticPlanBuilder', () => {
  it('builds ASP from context pack targets as non-approvable scaffold', () => {
    const plan = buildSemanticPlanScaffold({
      applicationScope: {
        kind: 'platform',
        scopeKey: 'platform:studio:page:users',
        mountId: 'studio',
        pageKey: 'users',
      },
      contextPack: {
        contextPackId: 'ctxpack:test:1',
        revision: 1,
        applicationScopeRef: 'platform:studio:page:users',
        indexVersions: { knowledgeRegistry: '1', retrievalPolicy: '1' },
        tokenBudget: 8000,
        primaryTargets: [{
          targetId: 'page:users',
          kind: 'page',
          label: 'Users',
          ref: 'users',
        }],
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
        selectionExplanations: [{
          reasonCode: 'EXACT_TARGET',
          evidenceId: 'page:users',
          summary: 'Primary page target.',
        }],
      },
      userPrompt: 'Add export action to users grid',
    });

    expect(plan.planId).toMatch(/^asp:/);
    expect(plan.authority).toBe('SCAFFOLD');
    expect(resolvePlanActionPolicy(plan).canApprove).toBe(false);
    expect(() => compileChangeGraphFromPlan(plan)).toThrow(ChangeGraphCompileForbiddenError);
  });

  it('V5 P11 § V5-24 — buildSemanticPlan attaches a real contextItemRefs audit trail, wired end-to-end', () => {
    const plan = buildSemanticPlan({
      applicationScope: {
        kind: 'platform',
        scopeKey: 'platform:studio:page:users',
        mountId: 'studio',
        pageKey: 'users',
      },
      contextPack: {
        contextPackId: 'ctxpack:test:2',
        revision: 1,
        applicationScopeRef: 'platform:studio:page:users',
        indexVersions: { knowledgeRegistry: '1', retrievalPolicy: '1' },
        tokenBudget: 8000,
        primaryTargets: [{ targetId: 'page:users', kind: 'page', label: 'Users', ref: 'users' }],
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
        selectionExplanations: [
          { reasonCode: 'EXACT_TARGET', evidenceId: 'page:users', summary: 'Primary page target.' },
          { reasonCode: 'SIMILAR_FEATURE', evidenceId: 'unrelated:candidate', summary: 'Considered, not used.' },
        ],
      },
      userPrompt: 'Add export action to users grid',
    });

    expect(plan.contextItemRefs).toBeDefined();
    expect(plan.contextItemRefs!.find((r) => r.contextItemId === 'page:users')?.utilized).toBe(true);
    expect(plan.contextItemRefs!.find((r) => r.contextItemId === 'unrelated:candidate')?.utilized).toBe(false);
  });

  it('builds validated server-function UI plan with UISemanticDesign', () => {
    const plan = buildSemanticPlan({
      applicationScope: serverFunctionsScope(),
      contextPack: buildGeSfUi001ContextPack(),
      userPrompt: GE_SF_UI_001_PROMPT,
    });

    expect(plan.authority).toBe('VALIDATED');
    expect(plan.status).toBe('READY_FOR_APPROVAL');
    expect(plan.uiSemanticDesign).toBeTruthy();
    expect(plan.proposedArtifacts.some((artifact) => artifact.kind === 'page')).toBe(true);

    const graph = compileChangeGraphFromPlan(plan);
    expect(graph.nodes.length).toBe(plan.proposedArtifacts.length);
  });

  it('adds CREATE_PAGE artifact when UI intent targets an open server function', () => {
    const plan = buildSemanticPlan({
      applicationScope: serverFunctionsScope(),
      contextPack: {
        contextPackId: 'ctxpack:test:sum',
        revision: 1,
        applicationScopeRef: 'platform:studio:page:server-functions',
        indexVersions: { knowledgeRegistry: '1', retrievalPolicy: '1' },
        tokenBudget: 8000,
        primaryTargets: [{
          targetId: 'function:math.sum-two-numbers',
          kind: 'function',
          label: 'sum-two-numbers',
          ref: 'math.sum-two-numbers',
        }],
        dependencies: [],
        governance: [],
        businessRules: [],
        permissions: ['server-function:math.sum-two-numbers:execute'],
        structuralEvidence: [
          'contract:math.sum-two-numbers:input',
          'contract:math.sum-two-numbers:output',
        ],
        similarImplementations: ['src/features/math/components/SumTwoNumbersCalculator.tsx'],
        trustedPatterns: [],
        engineeringStandards: [],
        capabilityEvidence: [],
        capabilityGaps: [],
        relevantChanges: [],
        excludedCandidates: [],
        unresolvedTerms: [],
        conflicts: [],
        selectionExplanations: [{
          reasonCode: 'EXACT_TARGET',
          evidenceId: 'function:math.sum-two-numbers',
          summary: 'Open server function.',
        }],
      },
      userPrompt: 'Build a user interface for this function with two number inputs',
    });

    const pageArtifacts = plan.proposedArtifacts.filter((artifact) => artifact.kind === 'page');
    expect(pageArtifacts).toHaveLength(1);
    expect(pageArtifacts[0]?.action).toBe('create');
    expect(plan.uiSemanticDesign?.boundOperations[0]?.serverFunctionRef.ref).toBe('math.sum-two-numbers');
    expect(resolvePlanActionPolicy(plan).canApprove).toBe(true);

    const graph = compileChangeGraphFromPlan(plan);
    const createPageNode = graph.nodes.find((node) => node.operationType === 'CREATE_PAGE');
    expect(createPageNode?.inputs?.evidenceIds).toContain('function:math.sum-two-numbers');
  });
});
