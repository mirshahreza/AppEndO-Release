import { describe, expect, it } from 'vitest';
import {
  getAppendooCutoverHealth,
  probeEngineeringRoutingCutover,
} from '../appendooCutoverHealth';

describe('appendooCutoverHealth', () => {
  it('reports V3 cutover enabled with v1 apply reopened (p-63)', () => {
    const health = getAppendooCutoverHealth();
    expect(health.cutoverEnabled).toBe(true);
    expect(health.v1DirectWriteBlocked).toBe(false);
  });

  it('probes engineering routing auto-apply block', () => {
    const probe = probeEngineeringRoutingCutover();
    expect(probe.ok).toBe(true);
  });
});
