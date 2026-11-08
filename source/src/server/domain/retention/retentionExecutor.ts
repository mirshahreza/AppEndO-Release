import { Op, type Sequelize, type WhereOptions } from 'sequelize';
import path from 'node:path';
import { HttpError } from '../../errors/HttpError';
import { getControlPlaneSequelize } from '../../db/controlPlaneSequelize';
import { listEdgeModels } from '../../services/data-api/edgeModelStore';
import { getEdgeModelStudioMeta } from '../../services/data-api/edgeModelStudioMetaStore';
import {
  AUTH_AUDIT_DISCARD_MESSAGE,
  isJsonFilesOffload,
  isSameTypeDbOffload,
  resolveRetentionOlderThanDays,
  type LogRetentionSettings,
  type RetentionFamily,
  type RetentionPolicy,
} from '../../../shared/api/contracts/settings/retention';
import { emitRecordEvent } from '../record-events/emitRecordEvent';
import {
  getRecordEventHoldModel,
  getRecordEventModel,
  type RecordEventRow,
} from '../record-events/recordEventSequelizeModels';
import { getUserMessageDispatchModel } from '../user-message-dispatches/userMessageDispatchSequelizeModels';
import {
  getArchiveAppLogModel,
  getArchiveAuthAuditModel,
  getArchiveRecordEventModel,
  getArchiveUserMessageDispatchModel,
  getHotAppLogModel,
  getHotAuthAuditModel,
} from './archiveSequelizeModels';
import { openArchiveSequelize } from './archiveSequelizeFactory';
import { GzipJsonlWriter } from './jsonlWriter';
import { loadLogRetentionSettings } from './retentionSettings';

export const LOG_RETENTION_JOB_TYPE = 'log_retention';
export const RECORD_EVENT_RETENTION_JOB_TYPE = 'record_event_retention';
export const RECORD_EVENT_PURGE_JOB_TYPE = 'record_event_purge';

const BATCH_SIZE = 200;
const DAY_MS = 24 * 60 * 60 * 1000;
const STUB_KINDS = ['history.erased', 'history.archived'] as const;
const DEFAULT_JSON_ARCHIVE_DIRECTORY = path.join(process.cwd(), 'workspace', 'retention-archive');

export type RetentionFamilyResult = {
  matched: number;
  skippedHold: number;
  copied: number;
  deleted: number;
  bytesEstimate: number;
};

export type RetentionRunResult = {
  dryRun: boolean;
  scope: 'logs' | 'recordEvents';
  families: Partial<Record<RetentionFamily, RetentionFamilyResult>>;
};

export type RetentionExecutorDeps = {
  now?: Date;
  hotSequelize?: Sequelize;
  archiveSequelize?: Sequelize | null;
  jsonDirectory?: string;
  settings?: LogRetentionSettings;
  failCopy?: boolean;
};

const emptyFamily = (): RetentionFamilyResult => ({
  matched: 0,
  skippedHold: 0,
  copied: 0,
  deleted: 0,
  bytesEstimate: 0,
});

const subjectKey = (kind: string, id: string): string => `${kind}::${id}`;

const cutoffFromDays = (days: number | undefined, now: Date): Date | null => {
  if (!days || days < 1) return null;
  return new Date(now.getTime() - days * DAY_MS);
};

const estimateBytes = (rows: unknown[]): number => {
  try {
    return Buffer.byteLength(JSON.stringify(rows), 'utf8');
  } catch {
    return 0;
  }
};

const listLegalHoldSubjectKinds = (): string[] => {
  try {
    return [...new Set(
      listEdgeModels()
        .filter((model) => Boolean(getEdgeModelStudioMeta(model.id).history?.legalHold))
        .map((model) => model.objectName),
    )];
  } catch {
    return [];
  }
};

const assertAuthPolicy = (policy: RetentionPolicy): void => {
  if (policy.action === 'discard') {
    throw new HttpError(400, AUTH_AUDIT_DISCARD_MESSAGE);
  }
};

const requireDestination = async (
  policy: RetentionPolicy,
  deps: RetentionExecutorDeps,
): Promise<{ archiveSequelize?: Sequelize; jsonDirectory?: string }> => {
  if (policy.action !== 'offload') {
    return {};
  }
  if (isSameTypeDbOffload(policy)) {
    if (deps.archiveSequelize) {
      return { archiveSequelize: deps.archiveSequelize };
    }
    if (deps.archiveSequelize === null) {
      throw new Error('Archive destination is not configured.');
    }
    const sequelize = await openArchiveSequelize(policy.offload?.connectionId);
    return { archiveSequelize: sequelize };
  }
  if (isJsonFilesOffload(policy)) {
    const directory = (deps.jsonDirectory ?? policy.offload?.filePathRef ?? DEFAULT_JSON_ARCHIVE_DIRECTORY).trim();
    if (!directory) {
      throw new Error('Archive destination is not configured.');
    }
    return { jsonDirectory: directory };
  }
  throw new Error('Archive destination is not configured.');
};

const copyAndDelete = async <T extends { id: number }>(input: {
  rows: T[];
  dryRun: boolean;
  failCopy: boolean;
  policy: RetentionPolicy;
  jsonWriter?: GzipJsonlWriter;
  now: Date;
  jobId: number;
  destroy: (ids: number[]) => Promise<number>;
  bulkCreate?: (rows: Array<T & { archivedAt: Date; archiveJobId: number }>) => Promise<void>;
  destCount?: (ids: number[]) => Promise<number>;
}): Promise<{ copied: number; deleted: number; bytesEstimate: number }> => {
  const bytesEstimate = estimateBytes(input.rows);
  if (input.dryRun || input.rows.length === 0) {
    return { copied: 0, deleted: 0, bytesEstimate };
  }
  const ids = input.rows.map((row) => Number(row.id));
  if (input.policy.action !== 'offload') {
    throw new Error('Retention must copy to the destination before deleting hot rows.');
  }
  if (input.failCopy) {
    throw new Error('Archive copy failed.');
  }
  if (isSameTypeDbOffload(input.policy)) {
    if (!input.bulkCreate || !input.destCount) {
      throw new Error('Archive destination is not configured.');
    }
    await input.bulkCreate(input.rows.map((row) => ({
      ...row,
      archivedAt: input.now,
      archiveJobId: input.jobId,
    })));
    const copied = await input.destCount(ids);
    if (copied !== input.rows.length) {
      throw new Error('Archive copy verification failed.');
    }
  } else if (isJsonFilesOffload(input.policy)) {
    if (!input.jsonWriter) {
      throw new Error('Archive destination is not configured.');
    }
    await input.jsonWriter.append(input.rows);
  } else {
    throw new Error('Archive destination is not configured.');
  }
  const deleted = await input.destroy(ids);
  return {
    copied: input.rows.length,
    deleted,
    bytesEstimate,
  };
};

const runAppLogs = async (
  policy: RetentionPolicy,
  deps: RetentionExecutorDeps,
  jobId: number,
  dryRun: boolean,
  now: Date,
): Promise<RetentionFamilyResult> => {
  const result = emptyFamily();
  const cutoff = cutoffFromDays(policy.olderThanDays, now);
  if (!cutoff) return result;
  const dest = dryRun ? {} : await requireDestination(policy, deps);
  const hot = getHotAppLogModel(deps.hotSequelize ?? getControlPlaneSequelize());
  const where: WhereOptions = { createdAt: { [Op.lt]: cutoff } };
  result.matched = await hot.count({ where });
  if (dryRun) return result;
  const Archive = dest.archiveSequelize ? getArchiveAppLogModel(dest.archiveSequelize) : null;
  const writer = dest.jsonDirectory
    ? new GzipJsonlWriter(dest.jsonDirectory, 'appLogs', jobId)
    : undefined;
  try {
    for (;;) {
      const rows = (await hot.findAll({
        where,
        order: [['id', 'ASC']],
        limit: BATCH_SIZE,
      })).map((row) => row.get({ plain: true }));
      if (rows.length === 0) break;
      const batch = await copyAndDelete({
        rows,
        dryRun,
        failCopy: Boolean(deps.failCopy),
        policy,
        jsonWriter: writer,
        now,
        jobId,
        destroy: (ids) => hot.destroy({ where: { id: { [Op.in]: ids } } }),
        bulkCreate: Archive
          ? async (payload) => {
            await Archive.bulkCreate(payload as never[], { ignoreDuplicates: true });
          }
          : undefined,
        destCount: Archive
          ? (ids) => Archive.count({ where: { id: { [Op.in]: ids } } })
          : undefined,
      });
      result.copied += batch.copied;
      result.deleted += batch.deleted;
      result.bytesEstimate += batch.bytesEstimate;
    }
  } finally {
    await writer?.close();
  }
  return result;
};

const runAuthAudit = async (
  policy: RetentionPolicy,
  appLogDays: number | undefined,
  deps: RetentionExecutorDeps,
  jobId: number,
  dryRun: boolean,
  now: Date,
): Promise<RetentionFamilyResult> => {
  assertAuthPolicy(policy);
  const result = emptyFamily();
  const days = resolveRetentionOlderThanDays(policy, appLogDays);
  const cutoff = cutoffFromDays(days, now);
  if (!cutoff) return result;
  const dest = dryRun ? {} : await requireDestination(policy, deps);
  const hot = getHotAuthAuditModel(deps.hotSequelize ?? getControlPlaneSequelize());
  const where: WhereOptions = { createdAt: { [Op.lt]: cutoff } };
  result.matched = await hot.count({ where });
  if (dryRun) return result;
  const Archive = dest.archiveSequelize ? getArchiveAuthAuditModel(dest.archiveSequelize) : null;
  const writer = dest.jsonDirectory
    ? new GzipJsonlWriter(dest.jsonDirectory, 'authAudit', jobId)
    : undefined;
  try {
    for (;;) {
      const rows = (await hot.findAll({
        where,
        order: [['id', 'ASC']],
        limit: BATCH_SIZE,
      })).map((row) => row.get({ plain: true }));
      if (rows.length === 0) break;
      const batch = await copyAndDelete({
        rows,
        dryRun,
        failCopy: Boolean(deps.failCopy),
        policy,
        jsonWriter: writer,
        now,
        jobId,
        destroy: (ids) => hot.destroy({ where: { id: { [Op.in]: ids } } }),
        bulkCreate: Archive
          ? async (payload) => {
            await Archive.bulkCreate(payload as never[], { ignoreDuplicates: true });
          }
          : undefined,
        destCount: Archive
          ? (ids) => Archive.count({ where: { id: { [Op.in]: ids } } })
          : undefined,
      });
      result.copied += batch.copied;
      result.deleted += batch.deleted;
      result.bytesEstimate += batch.bytesEstimate;
    }
  } finally {
    await writer?.close();
  }
  return result;
};

const loadHoldKeys = async (): Promise<Set<string>> => {
  const holds = await getRecordEventHoldModel().findAll();
  return new Set(holds.map((row) => subjectKey(row.subjectKind, row.subjectId)));
};

const runRecordEvents = async (
  policy: RetentionPolicy,
  deps: RetentionExecutorDeps,
  jobId: number,
  dryRun: boolean,
  now: Date,
): Promise<RetentionFamilyResult> => {
  const result = emptyFamily();
  const dest = dryRun ? {} : await requireDestination(policy, deps);
  const Model = getRecordEventModel(deps.hotSequelize);
  const holdKeys = await loadHoldKeys();
  const legalHoldKinds = new Set(listLegalHoldSubjectKinds());
  const cutoff = cutoffFromDays(policy.olderThanDays, now);
  if (!cutoff) return result;

  const takeCandidates = async (afterId: number): Promise<RecordEventRow[]> => {
    const rows = await Model.findAll({
      where: {
        ...where,
        id: { [Op.gt]: afterId },
        eventKind: { [Op.notIn]: [...STUB_KINDS] },
      },
      order: [['id', 'ASC']],
      limit: BATCH_SIZE,
    });
    return rows.map((row) => row.get({ plain: true }) as RecordEventRow);
  };

  const where: WhereOptions = {
    occurredAt: { [Op.lt]: cutoff },
    ...(legalHoldKinds.size > 0 ? { subjectKind: { [Op.notIn]: [...legalHoldKinds] } } : {}),
  };

  if (dryRun) {
    let afterId = 0;
    for (;;) {
      const candidates = await takeCandidates(afterId);
      if (candidates.length === 0) break;
      afterId = Number(candidates[candidates.length - 1].id);
      for (const row of candidates) {
        if (legalHoldKinds.has(row.subjectKind) || holdKeys.has(subjectKey(row.subjectKind, row.subjectId))) {
          result.skippedHold += 1;
          continue;
        }
        result.matched += 1;
        result.bytesEstimate += estimateBytes([row]);
      }
      if (candidates.length < BATCH_SIZE) break;
    }
    return result;
  }

  const Archive = dest.archiveSequelize ? getArchiveRecordEventModel(dest.archiveSequelize) : null;
  const writer = dest.jsonDirectory
    ? new GzipJsonlWriter(dest.jsonDirectory, 'recordEvents', jobId)
    : undefined;
  const bySubject = new Map<string, RecordEventRow[]>();
  try {
    let afterId = 0;
    for (;;) {
      const candidates = await takeCandidates(afterId);
      if (candidates.length === 0) break;
      afterId = Number(candidates[candidates.length - 1].id);
      const kept: RecordEventRow[] = [];
      for (const row of candidates) {
        if (legalHoldKinds.has(row.subjectKind) || holdKeys.has(subjectKey(row.subjectKind, row.subjectId))) {
          result.skippedHold += 1;
          continue;
        }
        kept.push(row);
      }
      result.matched += kept.length;
      if (kept.length === 0) {
        if (candidates.length < BATCH_SIZE) break;
        continue;
      }
      const batch = await copyAndDelete({
        rows: kept,
        dryRun,
        failCopy: Boolean(deps.failCopy),
        policy,
        jsonWriter: writer,
        now,
        jobId,
        destroy: (ids) => Model.destroy({ where: { id: { [Op.in]: ids } } }),
        bulkCreate: Archive
          ? async (payload) => {
            await Archive.bulkCreate(payload as never[], { ignoreDuplicates: true });
          }
          : undefined,
        destCount: Archive
          ? (ids) => Archive.count({ where: { id: { [Op.in]: ids } } })
          : undefined,
      });
      result.copied += batch.copied;
      result.deleted += batch.deleted;
      result.bytesEstimate += batch.bytesEstimate;
      for (const row of kept) {
        const key = subjectKey(row.subjectKind, row.subjectId);
        const list = bySubject.get(key) ?? [];
        list.push(row);
        bySubject.set(key, list);
      }
      if (candidates.length < BATCH_SIZE) break;
    }
  } finally {
    await writer?.close();
  }

  if (policy.action === 'offload') {
    const offloadMode = policy.offload?.mode ?? 'json-files';
    for (const rows of bySubject.values()) {
      const seqs = rows.map((row) => Number(row.subjectSeq));
      await emitRecordEvent({
        subjectKind: rows[0].subjectKind,
        subjectId: rows[0].subjectId,
        eventKind: 'history.archived',
        source: 'patch',
        outcome: 'success',
        actorKind: 'system',
        historyEnabled: true,
        payload: {
          fromSeq: Math.min(...seqs),
          toSeq: Math.max(...seqs),
          offloadMode,
          archivedAt: now.toISOString(),
        },
      });
    }
  }

  return result;
};

const runUserMessageDispatches = async (
  policy: RetentionPolicy,
  deps: RetentionExecutorDeps,
  jobId: number,
  dryRun: boolean,
  now: Date,
): Promise<RetentionFamilyResult> => {
  const result = emptyFamily();
  const cutoff = cutoffFromDays(policy.olderThanDays, now);
  if (!cutoff) return result;
  const dest = dryRun ? {} : await requireDestination(policy, deps);
  const Model = getUserMessageDispatchModel(deps.hotSequelize);
  const where: WhereOptions = { createdAt: { [Op.lt]: cutoff } };
  result.matched = await Model.count({ where });
  if (dryRun) return result;

  const Archive = dest.archiveSequelize ? getArchiveUserMessageDispatchModel(dest.archiveSequelize) : null;
  const writer = dest.jsonDirectory
    ? new GzipJsonlWriter(dest.jsonDirectory, 'userMessageDispatches', jobId)
    : undefined;
  try {
    for (;;) {
      const rows = (await Model.findAll({
        where,
        order: [['id', 'ASC']],
        limit: BATCH_SIZE,
      })).map((row) => row.get({ plain: true }));
      if (rows.length === 0) break;
      const batch = await copyAndDelete({
        rows: rows as Array<{ id: number }>,
        dryRun,
        failCopy: Boolean(deps.failCopy),
        policy,
        jsonWriter: writer,
        now,
        jobId,
        destroy: (ids) => Model.destroy({ where: { id: { [Op.in]: ids } } }),
        bulkCreate: Archive
          ? async (payload) => {
            await Archive.bulkCreate(payload as never[], { ignoreDuplicates: true });
          }
          : undefined,
        destCount: Archive
          ? (ids) => Archive.count({ where: { id: { [Op.in]: ids } } })
          : undefined,
      });
      result.copied += batch.copied;
      result.deleted += batch.deleted;
      result.bytesEstimate += batch.bytesEstimate;
      if (rows.length < BATCH_SIZE) break;
    }
  } finally {
    await writer?.close();
  }
  return result;
};

export async function executeRetention(input: {
  scope: 'logs' | 'recordEvents';
  dryRun: boolean;
  jobId: number;
  deps?: RetentionExecutorDeps;
}): Promise<RetentionRunResult> {
  const settings = input.deps?.settings ?? loadLogRetentionSettings();
  const now = input.deps?.now ?? new Date();
  const families: RetentionRunResult['families'] = {};
  if (input.scope === 'logs') {
    families.appLogs = await runAppLogs(
      settings.appLogs,
      input.deps ?? {},
      input.jobId,
      input.dryRun,
      now,
    );
    families.authAudit = await runAuthAudit(
      settings.authAudit,
      settings.appLogs.olderThanDays,
      input.deps ?? {},
      input.jobId,
      input.dryRun,
      now,
    );
  } else {
    families.recordEvents = await runRecordEvents(
      settings.recordEvents,
      input.deps ?? {},
      input.jobId,
      input.dryRun,
      now,
    );
    families.userMessageDispatches = await runUserMessageDispatches(
      settings.userMessageDispatches,
      input.deps ?? {},
      input.jobId,
      input.dryRun,
      now,
    );
  }
  return {
    dryRun: input.dryRun,
    scope: input.scope,
    families,
  };
}

export async function runRetentionJob(input: {
  scope: 'logs' | 'recordEvents';
  dryRun: boolean;
  jobId: number;
  deps?: RetentionExecutorDeps;
}): Promise<RetentionRunResult> {
  return executeRetention(input);
}

/** Alias used by the legacy `record_event_purge` job type. */
export async function runRecordEventPurge(deps?: RetentionExecutorDeps): Promise<RetentionRunResult> {
  return executeRetention({
    scope: 'recordEvents',
    dryRun: false,
    jobId: 0,
    deps,
  });
}
