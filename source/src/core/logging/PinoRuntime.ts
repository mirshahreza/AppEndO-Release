import fs from 'fs';
import path from 'path';
import pino from 'pino';
import type { Pool } from 'pg';
import { readRuntimeSettings } from '../../server/config/settingsFile';
import { logger, LogLevel, type LogRecord, type MethodLogConfig } from './Logger';
import {
  flushLogPersistence as flushBatchPersistence,
  getAuthAuditDbBatcher,
  getLogDbBatcher,
  tryInitLogPersistence,
  shutdownLogPersistence as shutdownBatchPersistence,
} from './logPersistenceRuntime';
import {
  normalizeLogDbPersistenceSettings,
  type LogDbPersistenceSettings,
} from './logPersistenceConfig';
import { createPinoAuthAuditDbStream, createPinoLogDbStream } from './pinoDbStreams';
import { logRecordToPinoBindings } from './pinoRecordMapper';

export type LoggingSettings = {
  methodConfigs?: Record<string, Partial<MethodLogConfig>>;
  dbPersistence?: LogDbPersistenceSettings;
};

const levelToPino = (level: LogLevel): pino.Level => {
  switch (level) {
    case LogLevel.DEBUG:
      return 'debug';
    case LogLevel.INFO:
      return 'info';
    case LogLevel.WARN:
      return 'warn';
    case LogLevel.ERROR:
      return 'error';
    default:
      return 'info';
  }
};

const buildPinoOptions = (level: string): pino.LoggerOptions => ({
  level,
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { level: label.toUpperCase() };
    },
  },
});

let pinoInstance: pino.Logger | null = null;
let authAuditPinoInstance: pino.Logger | null = null;
let fileDestination: pino.DestinationStream | null = null;

export const getLogFilePath = () => path.join(process.cwd(), 'logs', 'app.log');

export const getPinoLogger = (): pino.Logger | null => pinoInstance;

export const getAuthAuditPinoLogger = (): pino.Logger | null => authAuditPinoInstance;

export const initPinoRuntime = (pool?: Pool, settings?: LogDbPersistenceSettings) => {
  const persistenceReady = tryInitLogPersistence(pool, settings);

  const logDbBatcher = getLogDbBatcher();
  const authAuditDbBatcher = getAuthAuditDbBatcher();
  if (persistenceReady && (!logDbBatcher || !authAuditDbBatcher)) {
    throw new Error('Log persistence batchers failed to initialize.');
  }

  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const persistence = normalizeLogDbPersistenceSettings(settings);
  const runtimeLevel = readRuntimeSettings().logLevel || 'debug';

  fileDestination = pino.destination({
    dest: getLogFilePath(),
    sync: false,
    mkdir: true,
  });

  pinoInstance = pino(
    buildPinoOptions(runtimeLevel),
    pino.multistream([
      { stream: fileDestination },
      ...(logDbBatcher
        ? [{
            level: levelToPino(persistence.minLevel),
            stream: createPinoLogDbStream(logDbBatcher),
          }]
        : []),
    ]),
  );

  authAuditPinoInstance = authAuditDbBatcher
    ? pino(
      buildPinoOptions('info'),
      createPinoAuthAuditDbStream(authAuditDbBatcher),
    )
    : null;

  logger.setSink((entry: LogRecord) => {
    if (!pinoInstance) return;
    pinoInstance[levelToPino(entry.level)](logRecordToPinoBindings(entry), entry.message);
  });
};

const flushPinoDestinations = (): void => {
  pinoInstance?.flush();
  authAuditPinoInstance?.flush();
  try {
    fileDestination?.flushSync?.();
  } catch {
    // sonic-boom may not be ready during early test shutdown.
  }
};

export const flushLogPersistence = async (): Promise<void> => {
  flushPinoDestinations();
  await flushBatchPersistence();
};

export const shutdownLogPersistence = async (): Promise<void> => {
  flushPinoDestinations();
  await shutdownBatchPersistence();
  pinoInstance = null;
  authAuditPinoInstance = null;
  fileDestination = null;
};

export const readLoggingSettings = (settingsPath: string): LoggingSettings => {
  if (!fs.existsSync(settingsPath)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as Record<string, unknown>;
    const logging = (raw.logging || {}) as LoggingSettings;
    return logging;
  } catch {
    return {};
  }
};

export const writeLoggingSettings = (settingsPath: string, patch: LoggingSettings) => {
  const existing = fs.existsSync(settingsPath)
    ? JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    : {};

  const merged = {
    ...existing,
    logging: {
      ...(existing.logging || {}),
      ...patch,
    },
  };

  fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2));
};
