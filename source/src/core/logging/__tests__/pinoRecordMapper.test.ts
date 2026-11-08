import { describe, expect, it } from 'vitest';
import { LogLevel } from '../Logger';
import {
  logRecordToPinoBindings,
  mapPinoObjectToAuthAuditEntry,
  mapPinoObjectToLogRecord,
} from '../pinoRecordMapper';

describe('pinoRecordMapper', () => {
  it('maps pino NDJSON objects to app log records', () => {
    expect(mapPinoObjectToLogRecord({
      time: '2026-06-13T12:00:00.000Z',
      level: 'INFO',
      msg: 'Server started',
      actor: 'SYSTEM',
      callSuccess: true,
      failureReason: null,
      durationMs: 12,
      context: 'Server',
      meta: { port: 3000 },
    })).toEqual({
      timestamp: '2026-06-13T12:00:00.000Z',
      actor: 'SYSTEM',
      callSuccess: true,
      failureReason: null,
      durationMs: 12,
      level: LogLevel.INFO,
      context: 'Server',
      message: 'Server started',
      meta: { port: 3000 },
    });
  });

  it('maps log records to pino bindings', () => {
    expect(logRecordToPinoBindings({
      timestamp: '2026-06-13T12:00:00.000Z',
      actor: 'SYSTEM',
      callSuccess: null,
      failureReason: null,
      durationMs: null,
      level: LogLevel.WARN,
      context: 'CacheManager',
      message: 'miss',
      meta: { key: 'x' },
    })).toEqual({
      actor: 'SYSTEM',
      callSuccess: null,
      failureReason: null,
      durationMs: null,
      context: 'CacheManager',
      meta: { key: 'x' },
    });
  });

  it('maps pino NDJSON objects to auth audit entries', () => {
    expect(mapPinoObjectToAuthAuditEntry({
      userId: 7,
      email: 'user@example.com',
      eventType: 'LOGIN_SUCCESS',
      success: true,
      reason: null,
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
      metadataJson: '{"source":"test"}',
    })).toEqual({
      userId: 7,
      email: 'user@example.com',
      eventType: 'LOGIN_SUCCESS',
      success: true,
      reason: null,
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
      metadataJson: '{"source":"test"}',
    });
  });
});
