import { describe, expect, it } from 'vitest';
import { resolveRequiredVerificationLevel, resolveDeployable } from '../verificationLadder';
import type { SemanticBlastRadius } from '../patchIntentBlastRadius';

const buildBlastRadius = (overrides: Partial<SemanticBlastRadius> = {}): SemanticBlastRadius => ({
  changedSymbols: ['x'],
  directCallers: [],
  transitiveDependents: [],
  transitiveDependentsComputed: false,
  affectedServerFunctions: [],
  affectedDesignerBindings: [],
  publicApiImpact: false,
  securitySensitive: false,
  dataBoundaryImpact: false,
  score: 0,
  level: 'LOW',
  ...overrides,
});

describe('V5 P07 § V5-10 — resolveRequiredVerificationLevel (policy from blast radius)', () => {
  it('CRITICAL blast radius requires L5 (full AppEndO semantic verification)', () => {
    expect(resolveRequiredVerificationLevel(buildBlastRadius({ level: 'CRITICAL' }))).toBe('L5');
  });
  it('LOW blast radius with no callers only requires L1', () => {
    expect(resolveRequiredVerificationLevel(buildBlastRadius({ level: 'LOW', directCallers: [] }))).toBe('L1');
  });
  it('LOW blast radius WITH at least one caller requires L2 (targeted test), not just L1', () => {
    expect(resolveRequiredVerificationLevel(buildBlastRadius({ level: 'LOW', directCallers: [{ path: 'a.ts', startLine: 1 }] }))).toBe('L2');
  });
});

describe('V5 P07 § V5-10 DoD — resolveDeployable (no longer path-graders-only)', () => {
  it('is NOT deployable if structural graders pass but the required ladder level was not reached', () => {
    expect(resolveDeployable({ structuralGradersPassed: true, requiredLevel: 'L4', reachedLevel: 'L1' })).toBe(false);
  });
  it('is NOT deployable if the ladder level was reached but structural graders failed', () => {
    expect(resolveDeployable({ structuralGradersPassed: false, requiredLevel: 'L1', reachedLevel: 'L5' })).toBe(false);
  });
  it('is deployable only when both structural graders pass AND the required level was reached', () => {
    expect(resolveDeployable({ structuralGradersPassed: true, requiredLevel: 'L2', reachedLevel: 'L3' })).toBe(true);
  });
});
