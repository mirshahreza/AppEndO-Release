import { describe, expect, it } from 'vitest';
import {
  classifyMutationRisk,
  resolveGovernanceDepth,
  resolveFailureBlockThreshold,
  defaultOperationalPolicyEngine,
  type PolicySelectInput,
} from '../operationalPolicyEngine';
import { createInitialOperationalState } from '../operationalState';
import type { TaskContract } from '../taskContract';

const buildTaskContract = (overrides: Partial<Pick<TaskContract, 'mutationExpectation' | 'ambiguity'>> = {}) => ({
  mutationExpectation: 'EXPECTED' as const,
  ambiguity: { isAmbiguous: false },
  ...overrides,
});

const buildInput = (overrides: Partial<PolicySelectInput> = {}): PolicySelectInput => ({
  taskContract: buildTaskContract(),
  state: { failureSignatures: [], draftToolCount: 0 },
  hasSourceEvidence: false,
  workflowNudgeCount: 0,
  governanceDepth: 'AUTO',
  ...overrides,
});

describe('V5 P03 § T7 — classifyMutationRisk / resolveGovernanceDepth', () => {
  it('classifies schema/migration/auth-shaped targets as HIGH risk', () => {
    expect(classifyMutationRisk('prisma/schema.prisma')).toBe('HIGH');
    expect(classifyMutationRisk('src/server/db/migrations/0001_init.sql')).toBe('HIGH');
    expect(classifyMutationRisk('src/core/auth/session.ts')).toBe('HIGH');
    expect(classifyMutationRisk('settings.json')).toBe('HIGH');
  });

  it('classifies an ordinary source file as LOW risk', () => {
    expect(classifyMutationRisk('src/shared/ui/AppButton.tsx')).toBe('LOW');
  });

  it('DoD: governanceDepth=LEAN escalates to THOROUGH for a risky change', () => {
    expect(resolveGovernanceDepth('LEAN', 'HIGH')).toBe('THOROUGH');
  });

  it('does not escalate LEAN for a low-risk change', () => {
    expect(resolveGovernanceDepth('LEAN', 'LOW')).toBe('LEAN');
  });

  it('never loosens AUTO/THOROUGH regardless of risk', () => {
    expect(resolveGovernanceDepth('AUTO', 'HIGH')).toBe('AUTO');
    expect(resolveGovernanceDepth('THOROUGH', 'LOW')).toBe('THOROUGH');
  });

  it('THOROUGH is stricter (lower threshold) than AUTO, which is stricter than LEAN', () => {
    expect(resolveFailureBlockThreshold('THOROUGH')).toBeLessThan(resolveFailureBlockThreshold('AUTO'));
    expect(resolveFailureBlockThreshold('AUTO')).toBeLessThan(resolveFailureBlockThreshold('LEAN'));
  });
});

describe('V5 P03 § V5-5 DoD — OperationalPolicyEngine.select() action-class fixtures', () => {
  it('recommends RECOVER when an unrecovered repeated failure signature exists', () => {
    const state = { ...createInitialOperationalState('t', 'a'), failureSignatures: [
      { signature: 'draft_file_patch:x.ts', toolName: 'draft_file_patch', target: 'x.ts', occurrences: 2 },
    ] };
    const actionClass = defaultOperationalPolicyEngine.select(buildInput({ state }));
    expect(actionClass).toBe('RECOVER');
  });

  it('recommends CLARIFY when the task is materially ambiguous and nothing has been drafted', () => {
    const actionClass = defaultOperationalPolicyEngine.select(buildInput({
      taskContract: buildTaskContract({ ambiguity: { isAmbiguous: true, reason: 'no functionId named' } }),
    }));
    expect(actionClass).toBe('CLARIFY');
  });

  it('recommends EXPLORE when a mutation is expected but no source evidence has been gathered yet', () => {
    const actionClass = defaultOperationalPolicyEngine.select(buildInput({ hasSourceEvidence: false }));
    expect(actionClass).toBe('EXPLORE');
  });

  it('recommends EDIT once source evidence exists, mutation is expected, and nothing drafted yet', () => {
    const actionClass = defaultOperationalPolicyEngine.select(buildInput({ hasSourceEvidence: true }));
    expect(actionClass).toBe('EDIT');
  });

  it('recommends VERIFY once a draft exists', () => {
    const actionClass = defaultOperationalPolicyEngine.select(buildInput({
      hasSourceEvidence: true,
      state: { failureSignatures: [], draftToolCount: 1 },
    }));
    expect(actionClass).toBe('VERIFY');
  });

  it('recommends ABSTAIN after a nudge has already been offered and evidence was gathered but nothing was drafted', () => {
    const actionClass = defaultOperationalPolicyEngine.select(buildInput({
      hasSourceEvidence: true,
      workflowNudgeCount: 1,
    }));
    expect(actionClass).toBe('ABSTAIN');
  });

  it('does NOT recommend ABSTAIN before any nudge has been offered (first attempt still gets a chance)', () => {
    const actionClass = defaultOperationalPolicyEngine.select(buildInput({
      hasSourceEvidence: true,
      workflowNudgeCount: 0,
    }));
    expect(actionClass).toBe('EDIT');
  });

  it('recommends COMPLETE for a no-mutation-expected task once source evidence exists', () => {
    const actionClass = defaultOperationalPolicyEngine.select(buildInput({
      taskContract: buildTaskContract({ mutationExpectation: 'NOT_EXPECTED' }),
      hasSourceEvidence: true,
    }));
    expect(actionClass).toBe('COMPLETE');
  });
});
