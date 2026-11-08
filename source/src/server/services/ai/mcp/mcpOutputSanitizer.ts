import { MCP_STDIO_MAX_OUTPUT_BYTES } from './McpConnectionManager';

const INJECTION_PATTERNS: RegExp[] = [
  /<\s*system\b[^>]*>/gi,
  /<\s*\/\s*system\s*>/gi,
  /\[INST\]/gi,
  /\[\/INST\]/gi,
  /<<\s*SYS\s*>>/gi,
  /<\s*assistant\s*>/gi,
  /ignore\s+(all\s+)?previous\s+instructions/gi,
  /you\s+are\s+now\s+/gi,
];

const sanitizeString = (value: string): string => {
  let sanitized = value;
  INJECTION_PATTERNS.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, '[filtered]');
  });
  return sanitized;
};

const sanitizeMcpToolOutputValue = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return sanitizeString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMcpToolOutputValue(item));
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(record).map(([key, entry]) => [key, sanitizeMcpToolOutputValue(entry)]),
    );
  }

  return value;
};

const measureUtf8Bytes = (text: string): number => Buffer.byteLength(text, 'utf8');

const truncateToByteLimit = (serialized: string, maxBytes: number): string => {
  if (measureUtf8Bytes(serialized) <= maxBytes) return serialized;

  let low = 0;
  let high = serialized.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const slice = serialized.slice(0, mid);
    if (measureUtf8Bytes(slice) <= maxBytes) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return serialized.slice(0, low);
};

export const sanitizeMcpToolOutput = (
  value: unknown,
  maxBytes = MCP_STDIO_MAX_OUTPUT_BYTES,
): unknown => {
  const sanitized = sanitizeMcpToolOutputValue(value);

  try {
    const serialized = JSON.stringify(sanitized);
    if (measureUtf8Bytes(serialized) <= maxBytes) {
      return sanitized;
    }

    const previewBudget = Math.max(256, maxBytes - 256);
    const preview = truncateToByteLimit(serialized, previewBudget);
    return {
      _mcpOutputTruncated: true,
      originalBytes: measureUtf8Bytes(serialized),
      maxBytes,
      preview: `${preview}…`,
    };
  } catch {
    return {
      _mcpOutputTruncated: true,
      maxBytes,
      preview: 'MCP tool returned non-serializable output.',
    };
  }
};

export const summarizeMcpToolOutput = (value: unknown): string => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 240 ? `${trimmed.slice(0, 237)}…` : trimmed;
  }

  try {
    const serialized = JSON.stringify(value);
    return serialized.length > 240 ? `${serialized.slice(0, 237)}…` : serialized;
  } catch {
    return 'MCP tool returned non-serializable output.';
  }
};
