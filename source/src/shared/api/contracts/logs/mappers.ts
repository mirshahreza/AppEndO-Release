import type { LogDetailItem, LogLevel, LogSummaryItem, LogViewerSettings } from './types';
import { DEFAULT_VISIBLE_LEVELS, LOG_LEVELS, LOG_LEVEL_SETTINGS_FIELD } from './constants';
import { parseLogRetentionSettings, retentionAllowsIncludeArchived } from '../settings/retention';

const toNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

export const normalizeLogLevel = (value: unknown): LogLevel => {
  const normalized = String(value || '').toUpperCase();
  if (normalized === 'DEBUG') return 'DEBUG';
  if (normalized === 'WARN') return 'WARN';
  if (normalized === 'ERROR') return 'ERROR';
  return 'INFO';
};

export const normalizeLogSummaryItem = (input: unknown): LogSummaryItem => {
  const row = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  return {
    id: toNullableNumber(row.id) ?? 0,
    timestamp: String(row.timestamp ?? ''),
    actor: String(row.actor ?? 'SYSTEM'),
    callSuccess: toNullableNumber(row.callSuccess ?? row.callsuccess),
    failureReason: row.failureReason !== undefined
      ? (row.failureReason === null ? null : String(row.failureReason))
      : (row.failurereason === null || row.failurereason === undefined ? null : String(row.failurereason)),
    durationMs: toNullableNumber(row.durationMs ?? row.durationms),
    level: normalizeLogLevel(row.level),
    context: String(row.context ?? ''),
    message: String(row.message ?? ''),
    messageSize: toNullableNumber(row.messageSize ?? row.messagesize) ?? 0,
    hasMeta: toNullableNumber(row.hasMeta ?? row.hasmeta) ?? 0,
    metaSize: toNullableNumber(row.metaSize ?? row.metasize) ?? 0,
  };
};

export const normalizeLogDetailItem = (input: unknown): LogDetailItem => {
  const row = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  return {
    id: toNullableNumber(row.id) ?? 0,
    timestamp: String(row.timestamp ?? ''),
    actor: String(row.actor ?? 'SYSTEM'),
    callSuccess: toNullableNumber(row.callSuccess ?? row.callsuccess),
    failureReason: row.failureReason !== undefined
      ? (row.failureReason === null ? null : String(row.failureReason))
      : (row.failurereason === null || row.failurereason === undefined ? null : String(row.failurereason)),
    durationMs: toNullableNumber(row.durationMs ?? row.durationms),
    level: normalizeLogLevel(row.level),
    context: String(row.context ?? ''),
    message: String(row.message ?? ''),
    meta: row.meta,
  };
};

export const mapLogViewerSettings = (data: unknown): Partial<LogViewerSettings> => {
  if (!data || typeof data !== 'object') {
    return {};
  }

  const record = data as Record<string, unknown>;
  const limitValue = Number(record.logViewerLimit);
  const partial: Partial<LogViewerSettings> = {};

  if (Number.isFinite(limitValue) && limitValue > 0) {
    partial.viewerLimit = Math.round(limitValue);
  }

  const visibleLevels = { ...DEFAULT_VISIBLE_LEVELS };

  LOG_LEVELS.forEach((level) => {
    const value = record[LOG_LEVEL_SETTINGS_FIELD[level]];

    if (typeof value === 'boolean') {
      visibleLevels[level] = value;
    }
  });

  partial.visibleLevels = visibleLevels;
  const retention = parseLogRetentionSettings(record.logRetention, record.logRetentionDays);
  partial.logRetention = retention;
  partial.includeArchivedAllowed = retentionAllowsIncludeArchived(retention.appLogs);
  partial.recordEventsIncludeArchivedAllowed = retentionAllowsIncludeArchived(retention.recordEvents);

  return partial;
};

export const buildLogDetailFallback = (
  id: number,
  payload: { error?: string; meta?: unknown },
  mode: 'api' | 'network',
): LogDetailItem => {
  if (mode === 'network') {
    return {
      id,
      timestamp: '',
      actor: 'SYSTEM',
      callSuccess: 0,
      failureReason: 'Network error while loading log details.',
      durationMs: null,
      level: 'ERROR',
      context: 'LogAPI',
      message: 'Network error while loading log details.',
      meta: payload.meta,
    };
  }

  return {
    id,
    timestamp: '',
    actor: 'SYSTEM',
    callSuccess: 0,
    failureReason: payload.error || 'Unable to load log details.',
    durationMs: null,
    level: 'INFO',
    context: 'LogAPI',
    message: payload.error || 'Unable to load log details.',
    meta: payload.meta,
  };
};
