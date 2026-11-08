import { describe, expect, it } from 'vitest';
import {
  MODEL_GATEWAY_REDACTED,
  probeModelGatewayTelemetryRedaction,
  recordModelGatewayTelemetry,
  redactGatewayTelemetryString,
  resetModelGatewayTelemetryForTests,
  sanitizeModelGatewayTelemetryRecord,
} from '../modelGatewayTelemetry';

describe('modelGatewayTelemetry', () => {
  it('redacts bearer tokens and api keys from telemetry strings', () => {
    const result = redactGatewayTelemetryString(
      'Authorization: Bearer abc123 api_key=super-secret sk-abcdefghijklmnopqrstuvwxyz1234567890',
    );

    expect(result.text).toContain(MODEL_GATEWAY_REDACTED);
    expect(result.text).not.toContain('abc123');
    expect(result.text).not.toContain('super-secret');
    expect(result.redactedFieldCount).toBeGreaterThan(0);
  });

  it('records sanitized telemetry without secret prompt values', () => {
    resetModelGatewayTelemetryForTests();

    const record = recordModelGatewayTelemetry({
      taskProfile: 'TOOL_SESSION',
      modelId: 'gpt-test',
      invokeKind: 'tool_session',
      latencyMs: 12,
      attemptCount: 1,
      retryReason: 'Bearer leaked-token',
    }, 'password=hidden-value');

    expect(record.redactedFieldCount).toBeGreaterThan(0);
    expect(record.retryReason).toContain(MODEL_GATEWAY_REDACTED);
  });

  it('passes telemetry redaction health probe', () => {
    const probe = probeModelGatewayTelemetryRedaction();
    expect(probe.ok).toBe(true);
    expect(probe.failures).toEqual([]);
  });

  it('sanitizes structured telemetry records', () => {
    const sanitized = sanitizeModelGatewayTelemetryRecord({
      taskProfile: 'GENERAL_CHAT',
      modelId: 'gpt-test',
      invokeKind: 'text',
      latencyMs: 5,
      attemptCount: 1,
      retryReason: 'token=abc123',
    });

    expect(sanitized.retryReason).toContain(MODEL_GATEWAY_REDACTED);
  });
});
