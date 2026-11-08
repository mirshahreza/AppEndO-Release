import { describe, expect, it } from 'vitest';
import { probeVerificationEngineScaffold } from '../verificationEngineHealth';

describe('verificationEngineHealth', () => {
  it('passes verification engine depth probe', () => {
    const probe = probeVerificationEngineScaffold();
    expect(probe.ok).toBe(true);
    expect(probe.implementedGraderCount).toBeGreaterThanOrEqual(13);
  });
});
