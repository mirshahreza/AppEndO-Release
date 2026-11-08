import { LogLevel } from './Logger';

export type DbBatchSettings = {
  batchSize?: number;
  flushIntervalMs?: number;
  maxQueueSize?: number;
};

export type LogDbPersistenceSettings = DbBatchSettings & {
  minLevel?: LogLevel;
};

export const DEFAULT_DB_BATCH_SETTINGS: Required<DbBatchSettings> = {
  batchSize: 50,
  flushIntervalMs: 100,
  maxQueueSize: 5000,
};

export const DEFAULT_LOG_DB_PERSISTENCE: Required<LogDbPersistenceSettings> = {
  ...DEFAULT_DB_BATCH_SETTINGS,
  minLevel: LogLevel.INFO,
};

const LOG_LEVEL_WEIGHT: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 10,
  [LogLevel.INFO]: 20,
  [LogLevel.WARN]: 30,
  [LogLevel.ERROR]: 40,
};

export const normalizeDbBatchSettings = (
  input?: DbBatchSettings,
): Required<DbBatchSettings> => ({
  batchSize: clampInt(input?.batchSize, DEFAULT_DB_BATCH_SETTINGS.batchSize, 1, 500),
  flushIntervalMs: clampInt(input?.flushIntervalMs, DEFAULT_DB_BATCH_SETTINGS.flushIntervalMs, 25, 5000),
  maxQueueSize: clampInt(input?.maxQueueSize, DEFAULT_DB_BATCH_SETTINGS.maxQueueSize, 100, 50_000),
});

export const normalizeLogDbPersistenceSettings = (
  input?: LogDbPersistenceSettings,
): Required<LogDbPersistenceSettings> => ({
  ...normalizeDbBatchSettings(input),
  minLevel: input?.minLevel && LOG_LEVEL_WEIGHT[input.minLevel]
    ? input.minLevel
    : DEFAULT_LOG_DB_PERSISTENCE.minLevel,
});

export const shouldPersistLogToDb = (level: LogLevel, minLevel: LogLevel): boolean =>
  LOG_LEVEL_WEIGHT[level] >= LOG_LEVEL_WEIGHT[minLevel];

export type LogDbPersistenceSettingsInput = {
  logDbPersistMinLevel?: unknown;
  logDbBatchSize?: unknown;
  logDbFlushIntervalMs?: unknown;
  logDbMaxQueueSize?: unknown;
};

export const mapLogDbPersistenceFromSettings = (
  input?: LogDbPersistenceSettingsInput | LogDbPersistenceSettings,
): LogDbPersistenceSettings => {
  if (!input || typeof input !== 'object') {
    return {};
  }

  const minLevelRaw = 'logDbPersistMinLevel' in input
    ? input.logDbPersistMinLevel
    : ('minLevel' in input ? input.minLevel : undefined);

  const batchSizeRaw = 'logDbBatchSize' in input
    ? input.logDbBatchSize
    : ('batchSize' in input ? input.batchSize : undefined);

  const flushIntervalMsRaw = 'logDbFlushIntervalMs' in input
    ? input.logDbFlushIntervalMs
    : ('flushIntervalMs' in input ? input.flushIntervalMs : undefined);

  const maxQueueSizeRaw = 'logDbMaxQueueSize' in input
    ? input.logDbMaxQueueSize
    : ('maxQueueSize' in input ? input.maxQueueSize : undefined);

  const minLevel = typeof minLevelRaw === 'string' && LOG_LEVEL_WEIGHT[minLevelRaw as LogLevel]
    ? minLevelRaw as LogLevel
    : undefined;

  return {
    minLevel,
    batchSize: parseOptionalInt(batchSizeRaw),
    flushIntervalMs: parseOptionalInt(flushIntervalMsRaw),
    maxQueueSize: parseOptionalInt(maxQueueSizeRaw),
  };
};

const clampInt = (value: unknown, fallback: number, min: number, max: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
};

const parseOptionalInt = (value: unknown): number | undefined => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.floor(parsed);
};
