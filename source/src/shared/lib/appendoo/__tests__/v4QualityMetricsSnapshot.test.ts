import { describe, expect, it } from 'vitest';
import { buildV4QualityMetricsSnapshot, probeV4QualityMetricsHealth } from '../v4QualityMetricsSnapshot';

describe('v4QualityMetricsSnapshot (§13.1)', () => {
  it('passes health probe', () => {
    expect(probeV4QualityMetricsHealth().ok).toBe(true);
  });

  it('builds dev-gate snapshot from WF-4 E2E', async () => {
    const snapshot = await buildV4QualityMetricsSnapshot();
    expect(snapshot.source).toBe('dev_gate');
    expect(snapshot.productionBaselinePending).toBe(true);
    expect(snapshot.metrics.deadlockProbeOk).toBe(true);
    expect(snapshot.metrics.perceivedLatencyInstrumentationOk).toBe(true);
    expect((snapshot.metrics.retrievalOperationCountGate ?? 0)).toBeGreaterThanOrEqual(1);
  });
});
