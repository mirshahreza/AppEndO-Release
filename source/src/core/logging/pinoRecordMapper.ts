import { LogLevel, type LogRecord } from './Logger';
import type { AuthAuditQueueEntry } from './authAuditRecordDbMapper';

const PINO_LEVEL_LABELS: Record<number, LogLevel> = {
  10: LogLevel.DEBUG,
  20: LogLevel.DEBUG,
  30: LogLevel.INFO,
  40: LogLevel.WARN,
  50: LogLevel.ERROR,
  60: LogLevel.ERROR,
};

export const normalizePinoLevelLabel = (value: unknown): LogLevel => {
  if (typeof value === 'string') {
    const upper = value.toUpperCase();
    if (upper in LogLevel) {
      return upper as LogLevel;
    }
  }
  if (typeof value === 'number' && PINO_LEVEL_LABELS[value]) {
    return PINO_LEVEL_LABELS[value];
  }
  return LogLevel.INFO;
};

export const mapPinoObjectToLogRecord = (obj: Record<string, unknown>): LogRecord => ({
  timestamp: typeof obj.time === 'string' ? obj.time : new Date().toISOString(),
  actor: typeof obj.actor === 'string' ? obj.actor : 'SYSTEM',
  callSuccess: typeof obj.callSuccess === 'boolean'
    ? obj.callSuccess
    : (obj.callSuccess === null ? null : null),
  failureReason: typeof obj.failureReason === 'string' ? obj.failureReason : null,
  durationMs: typeof obj.durationMs === 'number' && Number.isFinite(obj.durationMs)
    ? obj.durationMs
    : null,
  level: normalizePinoLevelLabel(obj.level),
  context: typeof obj.context === 'string' ? obj.context : 'UnknownContext',
  message: typeof obj.msg === 'string' ? obj.msg : '',
  meta: obj.meta,
});

export const mapPinoObjectToAuthAuditEntry = (obj: Record<string, unknown>): AuthAuditQueueEntry => ({
  userId: typeof obj.userId === 'number' ? obj.userId : null,
  email: typeof obj.email === 'string' ? obj.email : null,
  eventType: typeof obj.eventType === 'string' ? obj.eventType : 'UNKNOWN',
  success: obj.success === true,
  reason: typeof obj.reason === 'string' ? obj.reason : null,
  ipAddress: typeof obj.ipAddress === 'string' ? obj.ipAddress : null,
  userAgent: typeof obj.userAgent === 'string' ? obj.userAgent : null,
  metadataJson: typeof obj.metadataJson === 'string' ? obj.metadataJson : null,
});

export const logRecordToPinoBindings = (entry: LogRecord): Record<string, unknown> => ({
  actor: entry.actor,
  callSuccess: entry.callSuccess,
  failureReason: entry.failureReason,
  durationMs: entry.durationMs,
  context: entry.context,
  meta: entry.meta,
});
