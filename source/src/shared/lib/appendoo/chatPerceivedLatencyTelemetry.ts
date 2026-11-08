/** §13.1 — client-side perceived latency from submit to first visible activity (F.5). */

export const PERCEIVED_LATENCY_TARGET_MS = 500;

export type PerceivedActivityKind =
  | 'user_echo'
  | 'thinking'
  | 'tool_start'
  | 'turn_profile'
  | 'request_routing';

export type PerceivedLatencySample = {
  latencyMs: number;
  activityKind: PerceivedActivityKind;
  recordedAt: string;
};

const MAX_BUFFER = 500;
const buffer: PerceivedLatencySample[] = [];

export const beginPerceivedLatencyTurn = (): number => (
  typeof performance !== 'undefined' ? performance.now() : Date.now()
);

export const isPerceivedLatencyWithinTarget = (latencyMs: number): boolean => (
  latencyMs >= 0 && latencyMs < PERCEIVED_LATENCY_TARGET_MS
);

export const recordPerceivedLatencySample = (input: {
  submitStartedAtMs: number;
  firstActivityAtMs?: number;
  activityKind: PerceivedActivityKind;
}): PerceivedLatencySample => {
  const firstActivityAtMs = input.firstActivityAtMs ?? beginPerceivedLatencyTurn();
  const latencyMs = Math.max(0, Math.round(firstActivityAtMs - input.submitStartedAtMs));
  const sample: PerceivedLatencySample = {
    latencyMs,
    activityKind: input.activityKind,
    recordedAt: new Date().toISOString(),
  };
  buffer.push(sample);
  if (buffer.length > MAX_BUFFER) {
    buffer.shift();
  }
  return sample;
};

export const ingestPerceivedLatencySample = (input: {
  latencyMs: number;
  activityKind: PerceivedActivityKind;
}): PerceivedLatencySample => {
  const sample: PerceivedLatencySample = {
    latencyMs: Math.max(0, Math.floor(input.latencyMs)),
    activityKind: input.activityKind,
    recordedAt: new Date().toISOString(),
  };
  buffer.push(sample);
  if (buffer.length > MAX_BUFFER) {
    buffer.shift();
  }
  return sample;
};

export const completePerceivedLatencyTurn = (
  submitStartedAtMs: number,
  activityKind: PerceivedActivityKind,
): PerceivedLatencySample => recordPerceivedLatencySample({
  submitStartedAtMs,
  activityKind,
});

export const getPerceivedLatencySamples = (): PerceivedLatencySample[] => [...buffer];

export const clearPerceivedLatencySamples = (): void => {
  buffer.length = 0;
};

const percentile = (values: number[], p: number): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? null;
};

export const summarizePerceivedLatency = (): {
  sampleCount: number;
  p50Ms: number | null;
  p95Ms: number | null;
  maxMs: number | null;
  underTargetRate: number | null;
} => {
  const values = buffer.map((sample) => sample.latencyMs);
  const underTarget = values.filter((value) => isPerceivedLatencyWithinTarget(value)).length;
  return {
    sampleCount: values.length,
    p50Ms: percentile(values, 50),
    p95Ms: percentile(values, 95),
    maxMs: values.length > 0 ? Math.max(...values) : null,
    underTargetRate: values.length > 0 ? underTarget / values.length : null,
  };
};

export const probeChatPerceivedLatencyHealth = (): { ok: boolean; failures: string[] } => {
  const failures: string[] = [];
  const backup = getPerceivedLatencySamples();
  clearPerceivedLatencySamples();

  try {
    const sample = recordPerceivedLatencySample({
      submitStartedAtMs: 0,
      firstActivityAtMs: 16,
      activityKind: 'user_echo',
    });
    if (!isPerceivedLatencyWithinTarget(sample.latencyMs)) {
      failures.push('Synthetic user_echo sample must be under perceived latency target.');
    }
    const summary = summarizePerceivedLatency();
    if (summary.sampleCount !== 1 || summary.p50Ms !== 16) {
      failures.push('Perceived latency summary failed on synthetic sample.');
    }
  } finally {
    clearPerceivedLatencySamples();
    backup.forEach((sample) => ingestPerceivedLatencySample(sample));
  }

  return { ok: failures.length === 0, failures };
};
