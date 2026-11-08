import { useQuery } from '@tanstack/react-query';
import { apiGet, apiPost, formatApiErrorMessage, isApiError } from '../client';

export type RetentionJobScope = 'logs' | 'recordEvents';

export type RetentionDestinationItem = {
  id: string;
  name: string;
  type: string;
};

export type RetentionFamilyCounts = {
  matched: number;
  skippedHold: number;
  copied: number;
  deleted: number;
  bytesEstimate: number;
};

export type RetentionDryRunResult = {
  dryRun: boolean;
  scope: string;
  families: Record<string, RetentionFamilyCounts>;
};

export type RetentionRunResult = {
  jobIds: number[];
};

export const FAMILY_LABEL: Record<string, string> = {
  appLogs: 'App logs',
  authAudit: 'Auth audit',
  recordEvents: 'Record events',
  userMessageDispatches: 'User message dispatches',
};

export const retentionQueryKeys = {
  destinations: () => ['retention', 'destinations'] as const,
};

function readFamilyCounts(raw: unknown): RetentionFamilyCounts {
  const record = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  return {
    matched: Number(record.matched) || 0,
    skippedHold: Number(record.skippedHold) || 0,
    copied: Number(record.copied) || 0,
    deleted: Number(record.deleted) || 0,
    bytesEstimate: Number(record.bytesEstimate) || 0,
  };
}

export function parseRetentionDryRun(payload: Record<string, unknown>): RetentionDryRunResult {
  const familiesRaw = payload.families && typeof payload.families === 'object'
    ? payload.families as Record<string, unknown>
    : {};
  const families: Record<string, RetentionFamilyCounts> = {};
  for (const [name, value] of Object.entries(familiesRaw)) {
    families[name] = readFamilyCounts(value);
  }
  return {
    dryRun: payload.dryRun !== false,
    scope: typeof payload.scope === 'string' ? payload.scope : '',
    families,
  };
}

export function summarizeRetentionDryRun(payload: Record<string, unknown>): string {
  const parsed = parseRetentionDryRun(payload);
  const parts = Object.entries(parsed.families).map(([name, family]) => (
    `${FAMILY_LABEL[name] ?? name}: ${family.matched} matched, ${family.skippedHold} skipped`
  ));
  return parts.length > 0 ? parts.join(' · ') : 'No matching rows.';
}

export async function fetchRetentionDestinations(): Promise<RetentionDestinationItem[]> {
  const { data } = await apiGet<{ items?: RetentionDestinationItem[] }>('/api/retention/destinations');
  return Array.isArray(data.items) ? data.items : [];
}

export function useRetentionDestinationsQuery(enabled = true) {
  return useQuery({
    queryKey: retentionQueryKeys.destinations(),
    queryFn: fetchRetentionDestinations,
    enabled,
    staleTime: 60_000,
  });
}

export async function postRetentionDryRun(scope: RetentionJobScope): Promise<RetentionDryRunResult> {
  const { data, response } = await apiPost<Record<string, unknown>>('/api/retention/dry-run', { scope });
  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Dry-run failed.');
  }
  return parseRetentionDryRun(data);
}

export async function postRetentionRun(scope: RetentionJobScope): Promise<RetentionRunResult> {
  const { data, response } = await apiPost<{ jobIds?: number[]; error?: string }>('/api/retention/run', { scope });
  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to enqueue retention.');
  }
  const jobIds = Array.isArray(data.jobIds)
    ? data.jobIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))
    : [];
  return { jobIds };
}

export function retentionActionErrorMessage(error: unknown, fallback: string): string {
  return isApiError(error) ? formatApiErrorMessage(error) : (error instanceof Error ? error.message : fallback);
}
