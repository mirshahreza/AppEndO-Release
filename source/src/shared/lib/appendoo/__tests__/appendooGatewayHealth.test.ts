import { describe, expect, it } from 'vitest';
import { probeAppendooGatewayScaffold } from '../appendooGatewayHealth';

describe('appendooGatewayHealth', () => {
  it('reports gateway scaffold health', () => {
    const health = probeAppendooGatewayScaffold();
    expect(health.ok).toBe(true);
    expect(health.taskProfilePolicyCount).toBeGreaterThanOrEqual(11);
    expect(health.promptTemplateCount).toBeGreaterThanOrEqual(4);
    expect(health.telemetryRedactionOk).toBe(true);
    expect(health.failures).toEqual([]);
  });
});
