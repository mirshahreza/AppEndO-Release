import type { Request } from 'express';
import { LogLevel, type MethodLogConfig } from '../../core/logging/Logger';
import { joinRoutePaths } from './systemApiRoutes';

export const parseLogLevel = (value: unknown): LogLevel => {
  const normalized = String(value || '').toUpperCase();
  if (normalized === LogLevel.ERROR) return LogLevel.ERROR;
  if (normalized === LogLevel.WARN) return LogLevel.WARN;
  if (normalized === LogLevel.INFO) return LogLevel.INFO;
  return LogLevel.DEBUG;
};

export const resolveHttpMethodLogId = (req: Request): string => {
  const method = String(req.method || 'GET').toUpperCase();
  const route = req as Request & { route?: { path?: string } };
  const routePath = typeof route.route?.path === 'string'
    ? joinRoutePaths(req.baseUrl || '', route.route.path)
    : (req.originalUrl.split('?')[0] || req.path || '/');
  return `HTTP ${method} ${routePath}`;
};

const LOG_SANITIZE_MAX_TEXT_BYTES = 4096;
const LOG_SANITIZE_MAX_DEPTH = 10;

const SENSITIVE_HEADER_KEYS = new Set(['cookie', 'authorization']);
const SENSITIVE_FIELD_KEYS = new Set([
  'password',
  'newpassword',
  'currentpassword',
  'confirmpassword',
  'passwordhash',
  'refreshtoken',
  'accesstoken',
  'privatekey',
  'passphrase',
  'passwordcipher',
  'privatekeycipher',
  'passphrasecipher',
]);

type PayloadSanitizeStats = {
  removedBinaryFields: number;
  removedLargeTextFields: number;
  removedCircularFields: number;
  removedDeepFields: number;
  redactedSensitiveFields: number;
};

const isSensitiveFieldKey = (key: string) => SENSITIVE_FIELD_KEYS.has(key.toLowerCase());

const isSensitiveHeaderKey = (key: string) => SENSITIVE_HEADER_KEYS.has(key.toLowerCase());

const isSerializedBufferObject = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return record.type === 'Buffer' && Array.isArray(record.data);
};

const isBinaryLike = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (Buffer.isBuffer(value)) return true;
  if (value instanceof ArrayBuffer) return true;
  if (ArrayBuffer.isView(value)) return true;
  if (isSerializedBufferObject(value)) return true;
  return false;
};

const sanitizePayloadValue = (
  value: unknown,
  stats: PayloadSanitizeStats,
  seen: WeakSet<object>,
  depth: number,
): unknown | undefined => {
  if (value === null || value === undefined) return value;

  if (isBinaryLike(value)) {
    stats.removedBinaryFields += 1;
    return undefined;
  }

  const valueType = typeof value;
  if (valueType === 'string') {
    if (Buffer.byteLength(value as string, 'utf8') > LOG_SANITIZE_MAX_TEXT_BYTES) {
      stats.removedLargeTextFields += 1;
      return undefined;
    }
    return value;
  }

  if (valueType === 'number' || valueType === 'boolean' || valueType === 'bigint') {
    return value;
  }

  if (valueType !== 'object') {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const obj = value as object;
  if (seen.has(obj)) {
    stats.removedCircularFields += 1;
    return undefined;
  }

  if (depth >= LOG_SANITIZE_MAX_DEPTH) {
    stats.removedDeepFields += 1;
    return undefined;
  }

  seen.add(obj);
  try {
    if (Array.isArray(value)) {
      const outputArray: unknown[] = [];
      for (const item of value) {
        const sanitizedItem = sanitizePayloadValue(item, stats, seen, depth + 1);
        if (sanitizedItem !== undefined) {
          outputArray.push(sanitizedItem);
        }
      }
      return outputArray;
    }

    const outputObject: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveFieldKey(key) || isSensitiveHeaderKey(key)) {
        stats.redactedSensitiveFields += 1;
        outputObject[key] = '[REDACTED]';
        continue;
      }
      const sanitizedNested = sanitizePayloadValue(nestedValue, stats, seen, depth + 1);
      if (sanitizedNested !== undefined) {
        outputObject[key] = sanitizedNested;
      }
    }
    return outputObject;
  } finally {
    seen.delete(obj);
  }
};

export const sanitizeClientPayloadForLog = (payload: unknown) => {
  const stats: PayloadSanitizeStats = {
    removedBinaryFields: 0,
    removedLargeTextFields: 0,
    removedCircularFields: 0,
    removedDeepFields: 0,
    redactedSensitiveFields: 0,
  };
  const sanitized = sanitizePayloadValue(payload, stats, new WeakSet<object>(), 0);
  const hasOmissions = Object.values(stats).some((count) => count > 0);
  return {
    sanitized,
    stats: hasOmissions ? stats : null,
  };
};

export const sanitizeMethodLogConfigs = (raw: unknown): Record<string, Partial<MethodLogConfig>> => {
  if (!raw || typeof raw !== 'object') return {};
  const input = raw as Record<string, unknown>;
  const output: Record<string, Partial<MethodLogConfig>> = {};

  Object.entries(input).forEach(([id, value]) => {
    if (!id || typeof value !== 'object' || value === null) return;
    const safeValue = value as Record<string, unknown>;
    output[id] = {
      enabled: typeof safeValue.enabled === 'boolean' ? safeValue.enabled : undefined,
      minLevel: parseLogLevel(safeValue.minLevel),
    };
  });

  return output;
};
