import type { LogRetentionSettings } from '../settings/retention';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export type LogSummaryItem = {
  id: number;
  timestamp: string;
  actor: string;
  callSuccess: number | null;
  failureReason: string | null;
  durationMs: number | null;
  level: LogLevel;
  context: string;
  message: string;
  messageSize: number;
  hasMeta: number;
  metaSize: number;
  createdAt?: string;
  createdBy?: number | null;
  updatedAt?: string | null;
  updatedBy?: number | null;
};

export type LogDetailItem = {
  id: number;
  timestamp: string;
  actor: string;
  callSuccess: number | null;
  failureReason: string | null;
  durationMs: number | null;
  level: LogLevel;
  context: string;
  message: string;
  meta?: unknown;
  createdAt?: string;
  createdBy?: number | null;
  updatedAt?: string | null;
  updatedBy?: number | null;
};

export type LogViewerSettings = {
  viewerLimit: number;
  visibleLevels: Record<LogLevel, boolean>;
  includeArchivedAllowed?: boolean;
  recordEventsIncludeArchivedAllowed?: boolean;
  logRetention?: LogRetentionSettings;
};

export type LogsListParams = {
  limit: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  level?: LogLevel | LogLevel[];
  actor?: string;
  context?: string;
  folder?: string;
  functionName?: string;
  key?: string;
  timestampFrom?: string;
  timestampTo?: string;
  duration?: string;
  callSuccess?: 'true' | 'false';
  requestId?: string;
  includeArchived?: boolean;
  offset?: number;
  where?: string;
};
