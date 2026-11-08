import { HttpError } from '../errors/HttpError';
import type { ActorContext } from '../types/requestContext';
import { enqueueRetentionJob } from '../domain/jobs/jobRepository';
import {
  authenticateArchiveDestination,
  listLogArchiveDestinations,
} from '../domain/retention/archiveSequelizeFactory';
import {
  executeRetention,
  LOG_RETENTION_JOB_TYPE,
  RECORD_EVENT_RETENTION_JOB_TYPE,
} from '../domain/retention/retentionExecutor';
import { loadLogRetentionSettings } from '../domain/retention/retentionSettings';
import {
  retentionAllowsIncludeArchived,
  type RetentionJobScope,
} from '../../shared/api/contracts/settings/retention';

const isAdmin = (actor: ActorContext | null | undefined): boolean => (
  Boolean(actor?.isAdmin || actor?.role === 'ADMIN')
);

const assertAdmin = (actor: ActorContext | null | undefined): void => {
  if (!isAdmin(actor)) {
    throw new HttpError(403, 'Retention actions require ADMIN.');
  }
};

const parseScope = (raw: unknown): RetentionJobScope => {
  if (raw === 'logs' || raw === 'recordEvents' || raw === 'all') return raw;
  return 'all';
};

export async function listDestinations(actor: ActorContext | null | undefined) {
  assertAdmin(actor);
  return { items: listLogArchiveDestinations() };
}

export async function testDestination(actor: ActorContext | null | undefined, body: unknown) {
  assertAdmin(actor);
  const connectionId = String((body as { connectionId?: unknown } | null)?.connectionId ?? '').trim();
  if (!connectionId) {
    throw new HttpError(400, 'Archive destination is not configured.');
  }
  await authenticateArchiveDestination(connectionId);
  return { success: true as const };
}

export async function dryRunRetention(actor: ActorContext | null | undefined, body: unknown) {
  assertAdmin(actor);
  const scope = parseScope((body as { scope?: unknown } | null)?.scope);
  const settings = loadLogRetentionSettings();
  const jobId = 0;
  if (scope === 'logs' || scope === 'all') {
    const logs = await executeRetention({ scope: 'logs', dryRun: true, jobId, deps: { settings } });
    if (scope === 'logs') return logs;
    const events = await executeRetention({
      scope: 'recordEvents',
      dryRun: true,
      jobId,
      deps: { settings },
    });
    return {
      dryRun: true,
      scope: 'all' as const,
      families: { ...logs.families, ...events.families },
    };
  }
  return executeRetention({ scope: 'recordEvents', dryRun: true, jobId, deps: { settings } });
}

export async function runRetention(actor: ActorContext, body: unknown) {
  assertAdmin(actor);
  const scope = parseScope((body as { scope?: unknown } | null)?.scope);
  const jobIds: number[] = [];
  if (scope === 'logs' || scope === 'all') {
    jobIds.push(await enqueueRetentionJob({
      jobType: LOG_RETENTION_JOB_TYPE,
      dryRun: false,
      createdBy: actor.userId,
    }));
  }
  if (scope === 'recordEvents' || scope === 'all') {
    jobIds.push(await enqueueRetentionJob({
      jobType: RECORD_EVENT_RETENTION_JOB_TYPE,
      dryRun: false,
      createdBy: actor.userId,
    }));
  }
  return { success: true as const, jobIds };
}

export function includeArchivedFlags() {
  const settings = loadLogRetentionSettings();
  return {
    appLogs: retentionAllowsIncludeArchived(settings.appLogs),
    recordEvents: retentionAllowsIncludeArchived(settings.recordEvents),
  };
}
