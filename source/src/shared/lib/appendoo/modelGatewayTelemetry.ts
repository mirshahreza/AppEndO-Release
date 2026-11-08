import type { ModelGatewayTelemetryRecord } from '../../api/contracts/ai/appendooGateway.types';

export const MODEL_GATEWAY_REDACTED = '[REDACTED]';

const SECRET_PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /\bsk-[A-Za-z0-9]{20,}\b/g,
  /\b(api[_-]?key|apikey)\s*[:=]\s*["']?[\w-]{8,}/gi,
  /\b(password|secret|token)\s*[:=]\s*["']?[^\s"']{4,}/gi,
  /\bAuthorization:\s*Bearer\s+\S+/gi,
];

const redactSecretPatterns = (text: string): { text: string; redactedFieldCount: number } => {
  let redactedFieldCount = 0;
  let output = text;

  for (const pattern of SECRET_PATTERNS) {
    output = output.replace(pattern, () => {
      redactedFieldCount += 1;
      return MODEL_GATEWAY_REDACTED;
    });
  }

  return { text: output, redactedFieldCount };
};

export const redactGatewayTelemetryString = (
  value: string | undefined,
): { text: string | undefined; redactedFieldCount: number } => {
  if (!value?.trim()) {
    return { text: value, redactedFieldCount: 0 };
  }

  return redactSecretPatterns(value);
};

export const sanitizeModelGatewayTelemetryRecord = (
  record: ModelGatewayTelemetryRecord,
  promptSnippet?: string,
): ModelGatewayTelemetryRecord => {
  const redactedRetry = redactGatewayTelemetryString(record.retryReason);
  const redactedPrompt = redactGatewayTelemetryString(promptSnippet);

  return {
    ...record,
    retryReason: redactedRetry.text,
    redactedFieldCount: (record.redactedFieldCount ?? 0)
      + redactedRetry.redactedFieldCount
      + redactedPrompt.redactedFieldCount,
  };
};

const MAX_TELEMETRY_BUFFER = 100;
const telemetryBuffer: ModelGatewayTelemetryRecord[] = [];

/** AE-2.3 — in-memory telemetry sink with secret redaction (scaffold). */
export const recordModelGatewayTelemetry = (
  record: ModelGatewayTelemetryRecord,
  promptSnippet?: string,
): ModelGatewayTelemetryRecord => {
  const sanitized = sanitizeModelGatewayTelemetryRecord(record, promptSnippet);
  telemetryBuffer.push(sanitized);
  if (telemetryBuffer.length > MAX_TELEMETRY_BUFFER) {
    telemetryBuffer.shift();
  }
  return sanitized;
};

export const getModelGatewayTelemetryRecords = (): readonly ModelGatewayTelemetryRecord[] => (
  [...telemetryBuffer]
);

export const resetModelGatewayTelemetryForTests = (): void => {
  telemetryBuffer.length = 0;
};

export const probeModelGatewayTelemetryRedaction = (): { ok: boolean; failures: string[] } => {
  const failures: string[] = [];
  const sample = redactGatewayTelemetryString(
    'Authorization: Bearer secret-token-123 api_key=super-secret sk-abcdefghijklmnopqrstuvwxyz1234567890',
  );

  if (!sample.text.includes(MODEL_GATEWAY_REDACTED)) {
    failures.push('Expected secret patterns to be redacted.');
  }
  if (sample.text.includes('secret-token-123') || sample.text.includes('super-secret')) {
    failures.push('Redacted telemetry still contains secret values.');
  }

  return { ok: failures.length === 0, failures };
};
