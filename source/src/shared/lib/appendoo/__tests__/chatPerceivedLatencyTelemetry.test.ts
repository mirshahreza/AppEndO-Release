import { describe, expect, it } from 'vitest';
import {
  beginPerceivedLatencyTurn,
  clearPerceivedLatencySamples,
  completePerceivedLatencyTurn,
  ingestPerceivedLatencySample,
  isPerceivedLatencyWithinTarget,
  PERCEIVED_LATENCY_TARGET_MS,
  probeChatPerceivedLatencyHealth,
  recordPerceivedLatencySample,
  summarizePerceivedLatency,
} from '../chatPerceivedLatencyTelemetry';

describe('chatPerceivedLatencyTelemetry (§13.1 / F.5)', () => {
  it('records submit-to-echo latency under target for immediate echo', () => {
    clearPerceivedLatencySamples();
    const sample = recordPerceivedLatencySample({
      submitStartedAtMs: 100,
      firstActivityAtMs: 132,
      activityKind: 'user_echo',
    });
    expect(sample.latencyMs).toBe(32);
    expect(isPerceivedLatencyWithinTarget(sample.latencyMs)).toBe(true);
    expect(summarizePerceivedLatency().p50Ms).toBe(32);
  });

  it('flags latency above target', () => {
    expect(isPerceivedLatencyWithinTarget(PERCEIVED_LATENCY_TARGET_MS)).toBe(false);
    expect(isPerceivedLatencyWithinTarget(PERCEIVED_LATENCY_TARGET_MS - 1)).toBe(true);
  });

  it('completes a turn from begin marker', () => {
    clearPerceivedLatencySamples();
    const started = beginPerceivedLatencyTurn();
    const sample = completePerceivedLatencyTurn(started, 'user_echo');
    expect(sample.activityKind).toBe('user_echo');
    expect(sample.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('ingests server-side samples', () => {
    clearPerceivedLatencySamples();
    ingestPerceivedLatencySample({ latencyMs: 42, activityKind: 'tool_start' });
    expect(summarizePerceivedLatency().sampleCount).toBe(1);
  });

  it('passes health probe', () => {
    expect(probeChatPerceivedLatencyHealth().ok).toBe(true);
  });
});
