import { Op } from 'sequelize';
import type { LogsListQuery } from '../../../shared/api/contracts/logs/listQuery';
import type { RecordEventListQuery } from '../../../shared/api/contracts/record-events';
import {
  isSameTypeDbOffload,
  retentionAllowsIncludeArchived,
} from '../../../shared/api/contracts/settings/retention';
import type { RecordEventRow } from '../record-events/recordEventSequelizeModels';
import {
  getArchiveAppLogModel,
  getArchiveRecordEventModel,
  type ArchiveAppLogRow,
  type ArchiveRecordEventRow,
} from './archiveSequelizeModels';
import { openArchiveSequelize } from './archiveSequelizeFactory';
import { loadLogRetentionSettings } from './retentionSettings';
import {
  listWhereTreeToIr,
  parseListWhereTreeParam,
} from '../../../shared/ui/list-filter/listWhereFilter';
import { listWhereIrToSequelize } from '../../../shared/ui/list-filter/listWhereQuery';
import { DEFAULT_WHERE_OPERATORS } from '../../../shared/ui/where-builder/whereBuilderModel';
import { LOGS_LIST_WHERE_COLUMNS } from '../logs/logsListWhere';
import { RECORD_EVENTS_LIST_WHERE_COLUMNS } from '../record-events/recordEventsListWhere';

const ARCHIVE_QUERY_TIMEOUT_MS = 4_000;

const withTimeout = async <T>(promise: Promise<T>): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Archive unavailable')), ARCHIVE_QUERY_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const mapArchiveLogRow = (row: ArchiveAppLogRow) => ({
  id: Number(row.id),
  timestamp: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt ?? ''),
  actor: row.actor,
  callSuccess: row.callSuccess == null ? null : row.callSuccess === 1,
  failureReason: row.failureReason,
  durationMs: row.durationMs,
  level: row.level,
  context: row.context,
  message: row.message,
  messageSize: row.messageSize,
  hasMeta: row.hasMeta === 1,
  metaSize: row.metaSize,
  archived: true as const,
});

export async function listArchivedAppLogs(query: LogsListQuery): Promise<{
  items: ReturnType<typeof mapArchiveLogRow>[];
  totalCount: number;
  unavailable: boolean;
}> {
  const settings = loadLogRetentionSettings();
  if (!retentionAllowsIncludeArchived(settings.appLogs)) {
    return { items: [], totalCount: 0, unavailable: false };
  }
  try {
    const sequelize = await withTimeout(openArchiveSequelize(settings.appLogs.offload?.connectionId));
    const Model = getArchiveAppLogModel(sequelize);
    const where: Record<string, unknown> = {};
    if (query.where) {
      const fields = Object.keys(LOGS_LIST_WHERE_COLUMNS).map((id) => ({ id, label: id }));
      const tree = parseListWhereTreeParam(query.where, fields, DEFAULT_WHERE_OPERATORS);
      const compiled = listWhereIrToSequelize(
        tree ? listWhereTreeToIr(tree, DEFAULT_WHERE_OPERATORS) : null,
        LOGS_LIST_WHERE_COLUMNS,
        Op as unknown as Record<string, symbol>,
      );
      if (compiled) Object.assign(where, compiled);
    } else {
      if (query.level) {
        where.level = Array.isArray(query.level) ? { [Op.in]: query.level } : query.level;
      }
      if (query.actor) where.actor = { [Op.like]: `%${query.actor}%` };
      if (query.context) where.context = { [Op.like]: `%${query.context}%` };
      if (query.requestId) {
        const requestId = query.requestId.replace(/"/g, '');
        where.metaJson = { [Op.like]: `%"requestId":"${requestId}"%` };
      }
    }
    const windowLimit = Math.max((query.limit || 200) + (query.offset ?? 0), 1);
    const [rows, totalCount] = await Promise.all([
      withTimeout(Model.findAll({
        where,
        order: [['createdAt', 'DESC']],
        limit: windowLimit,
      })),
      withTimeout(Model.count({ where })),
    ]);
    return {
      items: rows.map((row) => mapArchiveLogRow(row.get({ plain: true }) as ArchiveAppLogRow)),
      totalCount,
      unavailable: false,
    };
  } catch {
    return { items: [], totalCount: 0, unavailable: true };
  }
}

export async function findArchivedAppLogById(id: number): Promise<{
  id: number;
  timestamp: string;
  actor: string | null;
  callSuccess: boolean | null;
  failureReason: string | null;
  durationMs: number | null;
  level: string;
  context: string;
  message: string;
  hasMeta: boolean;
  metaJson: string | null;
} | null> {
  const settings = loadLogRetentionSettings();
  if (!isSameTypeDbOffload(settings.appLogs)) return null;
  try {
    const sequelize = await withTimeout(openArchiveSequelize(settings.appLogs.offload?.connectionId));
    const row = await withTimeout(getArchiveAppLogModel(sequelize).findByPk(id));
    if (!row) return null;
    const plain = row.get({ plain: true }) as ArchiveAppLogRow;
    return {
      id: Number(plain.id),
      timestamp: plain.createdAt instanceof Date ? plain.createdAt.toISOString() : String(plain.createdAt ?? ''),
      actor: plain.actor,
      callSuccess: plain.callSuccess == null ? null : plain.callSuccess === 1,
      failureReason: plain.failureReason,
      durationMs: plain.durationMs,
      level: plain.level,
      context: plain.context,
      message: plain.message,
      hasMeta: plain.hasMeta === 1,
      metaJson: plain.metaJson,
    };
  } catch {
    return null;
  }
}

export async function hasArchivedHttpLogForRequestId(requestId: string): Promise<boolean | 'unavailable'> {
  const settings = loadLogRetentionSettings();
  if (!isSameTypeDbOffload(settings.appLogs)) return false;
  const sanitized = requestId.replace(/[^A-Za-z0-9._:-]/g, '');
  if (!sanitized) return false;
  try {
    const sequelize = await withTimeout(openArchiveSequelize(settings.appLogs.offload?.connectionId));
    const row = await withTimeout(getArchiveAppLogModel(sequelize).findOne({
      where: { metaJson: { [Op.like]: `%"requestId":"${sanitized}"%` } },
      attributes: ['id'],
    }));
    return Boolean(row);
  } catch {
    return 'unavailable';
  }
}

export async function listArchivedRecordEventRows(
  query: RecordEventListQuery,
): Promise<{ items: RecordEventRow[]; totalCount: number; unavailable: boolean }> {
  const settings = loadLogRetentionSettings();
  if (!retentionAllowsIncludeArchived(settings.recordEvents)) {
    return { items: [], totalCount: 0, unavailable: false };
  }
  try {
    const sequelize = await withTimeout(openArchiveSequelize(settings.recordEvents.offload?.connectionId));
    const Model = getArchiveRecordEventModel(sequelize);
    const where: Record<string, unknown> = {};
    if (query.subjectKind) where.subjectKind = query.subjectKind;
    if (query.subjectId) where.subjectId = query.subjectId;
    if (query.where) {
      const fields = Object.keys(RECORD_EVENTS_LIST_WHERE_COLUMNS).map((id) => ({ id, label: id }));
      const tree = parseListWhereTreeParam(query.where, fields, DEFAULT_WHERE_OPERATORS);
      const compiled = listWhereIrToSequelize(
        tree ? listWhereTreeToIr(tree, DEFAULT_WHERE_OPERATORS) : null,
        RECORD_EVENTS_LIST_WHERE_COLUMNS,
        Op as unknown as Record<string, symbol>,
      );
      if (compiled) Object.assign(where, compiled);
    } else {
      if (query.eventKind) where.eventKind = query.eventKind;
      if (query.outcome) where.outcome = query.outcome;
      if (query.field) where.field = query.field;
    }
    const windowLimit = Math.max((query.limit ?? 100) + (query.offset ?? 0), 1);
    const [rows, totalCount] = await Promise.all([
      withTimeout(Model.findAll({
        where,
        order: [['occurredAt', 'DESC'], ['subjectSeq', 'DESC']],
        limit: windowLimit,
      })),
      withTimeout(Model.count({ where })),
    ]);
    return {
      items: rows.map((row) => row.get({ plain: true }) as ArchiveRecordEventRow as unknown as RecordEventRow),
      totalCount,
      unavailable: false,
    };
  } catch {
    return { items: [], totalCount: 0, unavailable: true };
  }
}
