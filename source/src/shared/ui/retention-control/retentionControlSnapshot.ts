import type { RetentionFamily, RetentionPolicy } from '../../api/contracts/settings/retention';
import type { RetentionDestinationItem } from '../../api/queries/retention';

export type RetentionAgeKind = 'days' | 'follow-app-logs';

export type RetentionDestinationKind = 'none' | 'same-type-db' | 'json-files';

export type RetentionFamilySnapshot = {
  family: RetentionFamily;
  action: 'discard' | 'offload';
  age: { kind: RetentionAgeKind; days?: number };
  destination: {
    kind: RetentionDestinationKind;
    connectionName?: string | null;
    filePath?: string | null;
  };
};

export const LOGS_CONTROL_FAMILIES: RetentionFamily[] = ['appLogs', 'authAudit'];
export const RECORD_EVENTS_CONTROL_FAMILIES: RetentionFamily[] = ['recordEvents', 'userMessageDispatches'];

export function resolveRetentionConnectionName(
  connectionId: string | undefined,
  destinations: RetentionDestinationItem[],
): string | null {
  const id = connectionId?.trim();
  if (!id) return null;
  return destinations.find((item) => item.id === id)?.name ?? null;
}

export function buildRetentionFamilySnapshot(
  family: RetentionFamily,
  policy: RetentionPolicy,
  destinations: RetentionDestinationItem[],
  appLogsDays?: number,
): RetentionFamilySnapshot {
  const days = policy.followAppLogsAge ? appLogsDays : policy.olderThanDays;
  const age: RetentionFamilySnapshot['age'] = policy.followAppLogsAge
    ? { kind: 'follow-app-logs', days }
    : { kind: 'days', days };

  if (policy.action !== 'offload' || !policy.offload) {
    return {
      family,
      action: 'discard',
      age,
      destination: { kind: 'none' },
    };
  }

  if (policy.offload.mode === 'json-files') {
    return {
      family,
      action: 'offload',
      age,
      destination: {
        kind: 'json-files',
        filePath: policy.offload.filePathRef?.trim() || null,
      },
    };
  }

  return {
    family,
    action: 'offload',
    age,
    destination: {
      kind: 'same-type-db',
      connectionName: resolveRetentionConnectionName(policy.offload.connectionId, destinations),
    },
  };
}

export function formatRetentionBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${Math.round(bytes)} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
