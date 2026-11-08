export type RetentionAction = 'discard' | 'offload';
export type OffloadMode = 'same-type-db' | 'json-files';
export type RetentionFamily = 'appLogs' | 'authAudit' | 'recordEvents' | 'userMessageDispatches';
export type RetentionJobScope = 'logs' | 'recordEvents' | 'all';

export const RETENTION_DAY_OPTIONS = [7, 30, 90, 180] as const;
export const AUTH_AUDIT_FOLLOW_APP_LOGS = 'follow-app-logs';

export type RetentionOffload = {
  mode: OffloadMode;
  connectionId?: string;
  filePathRef?: string;
};

export type RetentionPolicy = {
  action: RetentionAction;
  olderThanDays?: number;
  followAppLogsAge?: boolean;
  offload?: RetentionOffload;
};

export type LogRetentionSettings = {
  appLogs: RetentionPolicy;
  authAudit: RetentionPolicy;
  recordEvents: RetentionPolicy;
  userMessageDispatches: RetentionPolicy;
};

const DEFAULT_OFFLOAD: RetentionOffload = {
  mode: 'json-files',
};

export const DEFAULT_LOG_RETENTION: LogRetentionSettings = {
  appLogs: {
    action: 'offload',
    olderThanDays: 30,
    offload: { ...DEFAULT_OFFLOAD },
  },
  authAudit: {
    action: 'offload',
    followAppLogsAge: true,
    offload: { ...DEFAULT_OFFLOAD },
  },
  recordEvents: {
    action: 'offload',
    olderThanDays: 30,
    offload: { ...DEFAULT_OFFLOAD },
  },
  userMessageDispatches: {
    action: 'offload',
    olderThanDays: 90,
    offload: { ...DEFAULT_OFFLOAD },
  },
};

const isMode = (value: unknown): value is OffloadMode => (
  value === 'same-type-db' || value === 'json-files'
);

const positiveDays = (value: unknown, fallback?: number): number | undefined => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.round(parsed);
};

const parseOffload = (raw: unknown, fallback: RetentionOffload | undefined): RetentionOffload | undefined => {
  const base = fallback ? { ...fallback } : { ...DEFAULT_OFFLOAD };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return base;
  }
  const record = raw as Record<string, unknown>;
  const requestedMode = isMode(record.mode) ? record.mode : base.mode;
  const connectionId = typeof record.connectionId === 'string' ? record.connectionId.trim() : base.connectionId;
  const filePathRef = typeof record.filePathRef === 'string' ? record.filePathRef.trim() : base.filePathRef;
  const mode: OffloadMode = requestedMode === 'same-type-db' && !connectionId
    ? 'json-files'
    : requestedMode;
  return {
    mode,
    ...(mode === 'same-type-db' && connectionId ? { connectionId } : {}),
    ...(filePathRef ? { filePathRef } : {}),
  };
};

const parseFamily = (
  raw: unknown,
  fallback: RetentionPolicy,
  options: { allowFollowAppLogs?: boolean },
): RetentionPolicy => {
  const record = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  const olderThanDays = positiveDays(record.olderThanDays, fallback.olderThanDays);
  const followAppLogsAge = options.allowFollowAppLogs
    ? record.followAppLogsAge !== false
    : undefined;
  const offload = parseOffload(record.offload, fallback.offload);
  return {
    action: 'offload',
    ...(olderThanDays ? { olderThanDays } : {}),
    ...(followAppLogsAge !== undefined ? { followAppLogsAge } : {}),
    ...(offload ? { offload } : {}),
  };
};

export function parseLogRetentionSettings(
  raw: unknown,
  logRetentionDays?: unknown,
): LogRetentionSettings {
  const record = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  const fallbackDays = positiveDays(logRetentionDays, DEFAULT_LOG_RETENTION.appLogs.olderThanDays);
  const appLogsFallback: RetentionPolicy = {
    ...DEFAULT_LOG_RETENTION.appLogs,
    olderThanDays: fallbackDays,
  };
  const parsed: LogRetentionSettings = {
    appLogs: parseFamily(record.appLogs, appLogsFallback, {}),
    authAudit: parseFamily(record.authAudit, DEFAULT_LOG_RETENTION.authAudit, {
      allowFollowAppLogs: true,
    }),
    recordEvents: parseFamily(record.recordEvents, DEFAULT_LOG_RETENTION.recordEvents, {}),
    userMessageDispatches: parseFamily(
      record.userMessageDispatches,
      DEFAULT_LOG_RETENTION.userMessageDispatches,
      {},
    ),
  };
  const withLogsGroup: LogRetentionSettings = {
    ...parsed,
    authAudit: {
      ...parsed.authAudit,
      action: 'offload',
      followAppLogsAge: true,
    },
  };
  const sharedDays = resolveSharedRetentionDays(withLogsGroup);
  return applySharedOffload(
    applySharedAge(withLogsGroup, sharedDays),
    resolveSharedRetentionOffload(withLogsGroup),
  );
}

const RETENTION_FAMILY_ORDER: RetentionFamily[] = ['appLogs', 'authAudit', 'recordEvents', 'userMessageDispatches'];

export function resolveSharedRetentionDays(settings: LogRetentionSettings): number {
  const fallback = DEFAULT_LOG_RETENTION.appLogs.olderThanDays ?? 30;
  const days = settings.appLogs.olderThanDays
    ?? settings.recordEvents.olderThanDays
    ?? settings.userMessageDispatches.olderThanDays
    ?? settings.authAudit.olderThanDays
    ?? fallback;
  return RETENTION_DAY_OPTIONS.includes(days as typeof RETENTION_DAY_OPTIONS[number])
    ? days
    : fallback;
}

const applySharedAge = (
  settings: LogRetentionSettings,
  olderThanDays: number,
): LogRetentionSettings => ({
  appLogs: { ...settings.appLogs, olderThanDays },
  authAudit: { ...settings.authAudit, followAppLogsAge: true, olderThanDays },
  recordEvents: { ...settings.recordEvents, olderThanDays },
  userMessageDispatches: { ...settings.userMessageDispatches, olderThanDays },
});

export function resolveSharedRetentionOffload(settings: LogRetentionSettings): RetentionOffload {
  const policies = RETENTION_FAMILY_ORDER.map((family) => settings[family]);
  const withConnection = policies.find((policy) => (
    policy.offload?.mode === 'same-type-db' && Boolean(policy.offload.connectionId?.trim())
  ));
  if (withConnection?.offload) {
    return { ...withConnection.offload };
  }
  const withOffload = policies.find((policy) => policy.offload)?.offload;
  return withOffload ? { ...withOffload } : { ...DEFAULT_OFFLOAD };
}

const applySharedOffload = (
  settings: LogRetentionSettings,
  offload: RetentionOffload,
): LogRetentionSettings => ({
  appLogs: { ...settings.appLogs, action: 'offload', offload: { ...offload } },
  authAudit: { ...settings.authAudit, action: 'offload', offload: { ...offload } },
  recordEvents: { ...settings.recordEvents, action: 'offload', offload: { ...offload } },
  userMessageDispatches: { ...settings.userMessageDispatches, action: 'offload', offload: { ...offload } },
});

export const AUTH_AUDIT_DISCARD_MESSAGE = 'Auth audit cannot be discarded.';

export function isAuthAuditDiscard(settings: { authAudit?: { action?: unknown } }): boolean {
  return settings.authAudit?.action === 'discard';
}

/** True when Studio may search the cold copy (same-type-db Keep). */
export function retentionAllowsIncludeArchived(policy: RetentionPolicy): boolean {
  return policy.action === 'offload' && policy.offload?.mode === 'same-type-db';
}

export function resolveRetentionOlderThanDays(
  policy: RetentionPolicy,
  appLogsDays: number | undefined,
): number | undefined {
  if (policy.followAppLogsAge) {
    return appLogsDays;
  }
  return policy.olderThanDays;
}

export function isSameTypeDbOffload(policy: RetentionPolicy): boolean {
  return policy.action === 'offload' && policy.offload?.mode === 'same-type-db';
}

export function isJsonFilesOffload(policy: RetentionPolicy): boolean {
  return policy.action === 'offload' && policy.offload?.mode === 'json-files';
}
