import { describe, expect, it } from 'vitest';
import type { ContextPack } from '../../../api/contracts/appendoo/contextPack.types';
import type { AppEndooSemanticPlan } from '../../../api/contracts/appendoo/semanticPlan.types';
import {
  approveApprovalBinding,
  computeApprovalFingerprint,
  createPendingApprovalBinding,
  validateApprovalBindingForExecution,
} from '../semanticPlanApproval';

const sampleContextPack = (): ContextPack => ({
  contextPackId: 'cp:test:1',
  revision: 1,
  applicationScopeRef: 'platform:studio:page:users',
  indexVersions: {
    knowledgeRegistry: 'kr:1',
    retrievalPolicy: 'rp:1',
    capabilitySnapshot: 'cap:1',
  },
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
});

const samplePlan = (contextPack: ContextPack): AppEndooSemanticPlan => ({
  planId: 'asp:test:1',
  revision: 1,
  applicationScopeRef: contextPack.applicationScopeRef,
  contextPackId: contextPack.contextPackId,
  objective: 'Add export action',
  scope: contextPack.applicationScopeRef,
  resolvedTargets: [],
  requirements: [],
  assumptions: [],
  nonGoals: [],
  proposedArtifacts: [],
  artifactModifications: [],
  permissions: [],
  requiredCapabilities: [],
  capabilityGaps: [],
  appliedStandards: [],
  selectedPatterns: [],
  acceptanceCriteria: [],
  risks: [],
  conflicts: [],
  createdAt: '2026-07-11T00:00:00.000Z',
});

describe('semanticPlanApproval', () => {
  it('creates immutable fingerprint from plan and context revisions', () => {
    const contextPack = sampleContextPack();
    const plan = samplePlan(contextPack);
    const binding = createPendingApprovalBinding(plan, contextPack);

    expect(binding.status).toBe('pending');
    expect(binding.fingerprint).toBe(computeApprovalFingerprint(plan, contextPack));
  });

  it('requires approved status before execution', () => {
    const contextPack = sampleContextPack();
    const plan = samplePlan(contextPack);
    const binding = createPendingApprovalBinding(plan, contextPack);

    const pending = validateApprovalBindingForExecution(binding, plan, contextPack);
    expect(pending.ok).toBe(false);
    expect(pending.errors).toContain('ASP approval is pending.');

    const approved = approveApprovalBinding(binding, 'user:1');
    const validation = validateApprovalBindingForExecution(approved, plan, contextPack);
    expect(validation.ok).toBe(true);
  });

  it('marks binding stale when context revision drifts', () => {
    const contextPack = sampleContextPack();
    const plan = samplePlan(contextPack);
    const binding = approveApprovalBinding(createPendingApprovalBinding(plan, contextPack), 'user:1');
    const driftedContext = { ...contextPack, revision: 2 };

    const validation = validateApprovalBindingForExecution(binding, plan, driftedContext);
    expect(validation.ok).toBe(false);
    expect(validation.staleReason).toBe('CONTEXT_STALE');
  });

  it('marks binding stale when capability snapshot drifts', () => {
    const contextPack = sampleContextPack();
    const plan = samplePlan(contextPack);
    const binding = approveApprovalBinding(createPendingApprovalBinding(plan, contextPack), 'user:1');
    const driftedContext = {
      ...contextPack,
      indexVersions: {
        ...contextPack.indexVersions,
        capabilitySnapshot: 'cap:2',
      },
    };

    const validation = validateApprovalBindingForExecution(binding, plan, driftedContext);
    expect(validation.ok).toBe(false);
    expect(validation.staleReason).toBe('CAPABILITY_STALE');
  });
});
