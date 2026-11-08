import { describe, expect, it } from 'vitest';
import { runTargetBindingCriticCheck } from '../planCriticCheck';
import type { ResolvedTargetBinding } from '../../../api/contracts/appendoo/semanticPlanAuthority.types';

const validBinding = (): ResolvedTargetBinding => ({
  artifactRef: { targetKind: 'function', targetId: 'ft-1', ref: 'math.sum-two-numbers' },
  artifactType: 'SERVER_FUNCTION',
  canonicalId: 'math.sum-two-numbers',
  versionOrFingerprint: 'fp-1',
  resolutionMethod: 'EXACT_TARGET',
  evidenceRefs: ['ft-1'],
  confidence: 1,
});

describe('V5 P11 § V5-18 — runTargetBindingCriticCheck (deterministic critic pass)', () => {
  it('passes a real, correctly-resolved EXACT_TARGET binding with no findings', () => {
    expect(runTargetBindingCriticCheck([validBinding()])).toEqual([]);
  });

  it('rejects a binding with a duplicated namespace prefix (the exact bug class P06 found and fixed)', () => {
    const blockers = runTargetBindingCriticCheck([
      { ...validBinding(), canonicalId: 'appendoo.appendoo.exportusers' },
    ]);
    expect(blockers).toHaveLength(1);
    expect(blockers[0].code).toBe('CRITIC_TARGET_BINDING_REJECTED');
  });

  it('rejects an EXACT_TARGET binding whose confidence is not 1 (internally inconsistent claim)', () => {
    const blockers = runTargetBindingCriticCheck([{ ...validBinding(), confidence: 0.6 }]);
    expect(blockers).toHaveLength(1);
    expect(blockers[0].code).toBe('CRITIC_TARGET_BINDING_REJECTED');
  });

  it('rejects an EXACT_TARGET binding with zero evidence refs', () => {
    const blockers = runTargetBindingCriticCheck([{ ...validBinding(), evidenceRefs: [] }]);
    expect(blockers).toHaveLength(1);
  });

  it('rejects an EXACT_TARGET binding whose canonicalId does not resolve to any known fixture — the literal DoD scenario ("wrong target binding")', () => {
    const blockers = runTargetBindingCriticCheck([
      { ...validBinding(), canonicalId: 'does.not-exist.anywhere' },
    ]);
    expect(blockers).toHaveLength(1);
    expect(blockers[0].question).toContain('does not independently resolve');
  });

  it('ignores non-EXACT_TARGET resolution methods (e.g. ambiguous/inferred bindings are handled by the planner\'s own gates, not this critic check)', () => {
    expect(runTargetBindingCriticCheck([{ ...validBinding(), resolutionMethod: 'INFERRED', confidence: 0.4 }])).toEqual([]);
  });

  it('ignores non-SERVER_FUNCTION artifact types', () => {
    expect(runTargetBindingCriticCheck([
      { ...validBinding(), artifactType: 'PAGE', canonicalId: 'not-a-real-fixture-id' },
    ])).toEqual([]);
  });

  it('handles undefined/empty bindings without throwing', () => {
    expect(runTargetBindingCriticCheck(undefined)).toEqual([]);
    expect(runTargetBindingCriticCheck([])).toEqual([]);
  });
});
