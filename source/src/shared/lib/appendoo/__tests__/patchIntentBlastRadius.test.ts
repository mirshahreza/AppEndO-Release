import { describe, expect, it, beforeEach } from 'vitest';
import { indexStructuralFile, resetCodebaseStructuralIndexForTests } from '../codebaseStructuralScaffold';
import { computeSemanticBlastRadius, deriveVerificationScope } from '../patchIntentBlastRadius';

/**
 * V5 Phase P06 section 13.2 DoD: a small diff on a shared symbol must produce high risk and a
 * large verification scope — changing a widely-referenced ("shared") symbol must produce high risk
 * and a large verification scope; an unused/local symbol must not.
 */
describe('V5 P06 § 13.2 DoD — SemanticBlastRadius reflects real reference fan-out, not diff size', () => {
  beforeEach(() => {
    resetCodebaseStructuralIndexForTests();
  });

  it('a symbol referenced by many real files gets HIGH/CRITICAL blast radius and a large verification scope', () => {
    indexStructuralFile('src/shared/lib/sharedHelper.ts', 'export function sharedHelper() { return 1; }');
    indexStructuralFile('src/features/a/moduleA.ts', 'import { sharedHelper } from "../../shared/lib/sharedHelper";\nsharedHelper();');
    indexStructuralFile('src/features/b/moduleB.ts', 'import { sharedHelper } from "../../shared/lib/sharedHelper";\nsharedHelper();');
    indexStructuralFile('src/features/c/moduleC.ts', 'import { sharedHelper } from "../../shared/lib/sharedHelper";\nsharedHelper();');
    indexStructuralFile('workspace/server-functions/custom/x.ts', 'sharedHelper();');

    const blastRadius = computeSemanticBlastRadius({
      changedSymbols: ['sharedHelper'],
      changedFilePaths: ['src/shared/lib/sharedHelper.ts'],
    });

    expect(blastRadius.publicApiImpact).toBe(true);
    expect(blastRadius.affectedServerFunctions.length).toBeGreaterThan(0);
    expect(['HIGH', 'CRITICAL']).toContain(blastRadius.level);

    const verificationScope = deriveVerificationScope(blastRadius);
    expect(verificationScope.requiredCheckCount).toBeGreaterThanOrEqual(3);
    expect(verificationScope.requiresManualReview).toBe(true);
  });

  it('a symbol with no other real references gets LOW blast radius and a small verification scope', () => {
    indexStructuralFile('src/shared/lib/onlyUsedHere.ts', 'export function unusedElsewhereHelper() { return 2; }');

    const blastRadius = computeSemanticBlastRadius({
      changedSymbols: ['unusedElsewhereHelper'],
      changedFilePaths: ['src/shared/lib/onlyUsedHere.ts'],
    });

    expect(blastRadius.level).toBe('LOW');
    const verificationScope = deriveVerificationScope(blastRadius);
    expect(verificationScope.requiredCheckCount).toBe(1);
    expect(verificationScope.requiresManualReview).toBe(false);
  });

  it('touching a schema/auth-shaped path is always treated as security/data-boundary sensitive regardless of reference count', () => {
    indexStructuralFile('src/core/auth/session.ts', 'export function validateSession() { return true; }');

    const blastRadius = computeSemanticBlastRadius({
      changedSymbols: ['validateSession'],
      changedFilePaths: ['src/core/auth/session.ts'],
    });

    expect(blastRadius.securitySensitive).toBe(true);
    expect(blastRadius.level).toBe('CRITICAL');
  });

  it('honestly reports transitiveDependents as unmeasured rather than fabricating zero', () => {
    const blastRadius = computeSemanticBlastRadius({ changedSymbols: ['x'], changedFilePaths: [] });
    expect(blastRadius.transitiveDependentsComputed).toBe(false);
    expect(blastRadius.transitiveDependents).toEqual([]);
  });
});
