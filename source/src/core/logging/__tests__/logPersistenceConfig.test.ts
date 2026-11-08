import { describe, expect, it } from 'vitest';
import { LogLevel } from '../Logger';
import {
  DEFAULT_LOG_DB_PERSISTENCE,
  mapLogDbPersistenceFromSettings,
  normalizeLogDbPersistenceSettings,
} from '../logPersistenceConfig';

describe('logPersistenceConfig', () => {
  it('maps flat logs settings fields to persistence config', () => {
    expect(mapLogDbPersistenceFromSettings({
      logDbPersistMinLevel: 'WARN',
      logDbBatchSize: 25,
      logDbFlushIntervalMs: 200,
      logDbMaxQueueSize: 1000,
    })).toEqual({
      minLevel: LogLevel.WARN,
      batchSize: 25,
      flushIntervalMs: 200,
      maxQueueSize: 1000,
    });
  });

  it('maps nested dbPersistence fields', () => {
    expect(mapLogDbPersistenceFromSettings({
      minLevel: LogLevel.ERROR,
      batchSize: 10,
    })).toEqual({
      minLevel: LogLevel.ERROR,
      batchSize: 10,
      flushIntervalMs: undefined,
      maxQueueSize: undefined,
    });
  });

  it('clamps out-of-range values to allowed bounds', () => {
    expect(normalizeLogDbPersistenceSettings({
      minLevel: 'INVALID' as LogLevel,
      batchSize: 0,
      flushIntervalMs: -1,
      maxQueueSize: 999_999,
    })).toEqual({
      ...DEFAULT_LOG_DB_PERSISTENCE,
      batchSize: 1,
      flushIntervalMs: 25,
      maxQueueSize: 50_000,
    });
  });
});
