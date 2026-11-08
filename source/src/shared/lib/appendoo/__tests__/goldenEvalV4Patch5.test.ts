import { describe, expect, it } from 'vitest';
import {
  evaluateV4Patch5GovernanceGates,
  probeV4Patch5GovernanceHealth,
} from '../goldenEvalAcceptancePrompts';

describe('goldenEval V4-PATCH-5 governance gates', () => {
  it('passes P5.1–P5.3 and deadlock probes', () => {
    const results = evaluateV4Patch5GovernanceGates();
    expect(results.every((result) => result.passed), results.flatMap((r) => r.failures).join('; ')).toBe(true);
    expect(probeV4Patch5GovernanceHealth().ok).toBe(true);
  });
});
