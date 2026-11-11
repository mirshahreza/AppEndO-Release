import type { LogLevel } from './types';

export const LOG_LEVELS: LogLevel[] = ['INFO', 'WARN', 'ERROR', 'DEBUG'];

export type LogLevelSettingsField =
  | 'logLevelInfoEnabled'
  | 'logLevelWarnEnabled'
  | 'logLevelErrorEnabled'
  | 'logLevelDebugEnabled';

export const LOG_LEVEL_SETTINGS_FIELD: Record<LogLevel, LogLevelSettingsField> = {
  INFO: 'logLevelInfoEnabled',
  WARN: 'logLevelWarnEnabled',
  ERROR: 'logLevelErrorEnabled',
  DEBUG: 'logLevelDebugEnabled',
};

export const DEFAULT_VISIBLE_LEVELS: Record<LogLevel, boolean> = {
  INFO: true,
  WARN: true,
  ERROR: true,
  DEBUG: true,
};

export const DEFAULT_LEVEL_FILTER: LogLevel = 'INFO';

export const DEFAULT_LEVEL_FILTERS: Record<LogLevel, boolean> = {
  INFO: true,
  WARN: false,
  ERROR: false,
  DEBUG: false,
};
