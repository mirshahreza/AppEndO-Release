import type { LogsListQuery } from '../../../shared/api/contracts/logs/listQuery';
import type { Prisma } from '../../../generated/prisma/client';
import {
  buildCaseInsensitiveContains,
  fromUserId,
  parseDateEnd,
  parseDateStart,
  prisma,
  readControlPlaneProvider,
  toUserId,
} from '../users/prismaHelpers';
import {
  listWhereTreeToIr,
  parseListWhereTreeParam,
} from '../../../shared/ui/list-filter/listWhereFilter';
import { listWhereIrToPrisma } from '../../../shared/ui/list-filter/listWhereQuery';
import { DEFAULT_WHERE_OPERATORS } from '../../../shared/ui/where-builder/whereBuilderModel';
import { LOGS_LIST_WHERE_COLUMNS } from './logsListWhere';

export type AppLogListRow = {
  id: number;
  timestamp: string;
  actor: string | null;
  callSuccess: boolean | null;
  failureReason: string | null;
  durationMs: number | null;
  level: string;
  context: string;
  message: string;
  messageSize: number;
  hasMeta: boolean;
  metaSize: number;
};

export type AppLogDetailRow = {
  id: number;
  timestamp: string;
  actor: string | null;
  callSuccess: boolean | null;
  failureReason: string | null;
  durationMs: number | null;
  level: string;
  context: string;
  message: string;
  hasMeta?: boolean;
  hasmeta?: boolean;
  metaJson?: string | null;
  metajson?: string | null;
};

const SORT_COLUMN_MAP: Record<string, keyof Prisma.BaseAppLogOrderByWithRelationInput> = {
  level: 'level',
  actor: 'actor',
  context: 'context',
  timestamp: 'createdAt',
  durationMs: 'durationMs',
  folder: 'message',
  functionName: 'message',
  key: 'message',
};

const toIsoString = (value: Date | null | undefined): string =>
  value instanceof Date ? value.toISOString() : String(value ?? '');

const mapCallSuccess = (value: number | null): boolean | null => {
  if (value === null || value === undefined) return null;
  return value === 1;
};

const mapListRow = (row: {
  id: bigint;
  createdAt: Date | null;
  actor: string;
  callSuccess: number | null;
  failureReason: string | null;
  durationMs: number | null;
  level: string;
  context: string;
  message: string;
  messageSize: number;
  hasMeta: number;
  metaSize: number;
}): AppLogListRow => ({
  id: fromUserId(row.id),
  timestamp: toIsoString(row.createdAt),
  actor: row.actor,
  callSuccess: mapCallSuccess(row.callSuccess),
  failureReason: row.failureReason,
  durationMs: row.durationMs,
  level: row.level,
  context: row.context,
  message: row.message,
  messageSize: row.messageSize,
  hasMeta: row.hasMeta === 1,
  metaSize: row.metaSize,
});

const listSelect = {
  id: true,
  createdAt: true,
  actor: true,
  callSuccess: true,
  failureReason: true,
  durationMs: true,
  level: true,
  context: true,
  message: true,
  messageSize: true,
  hasMeta: true,
  metaSize: true,
} as const;

const buildLevelWhere = (level: LogsListQuery['level']): Prisma.BaseAppLogWhereInput => {
  if (!level) return {};
  if (Array.isArray(level)) {
    if (level.length === 0) return { id: { equals: BigInt(-1) } };
    return { level: { in: level } };
  }
  return { level };
};

const buildContainsFilter = (value: string): Prisma.StringFilter | string => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return '';
  return buildCaseInsensitiveContains(trimmed, readControlPlaneProvider());
};

const LOGS_WHERE_FIELDS = Object.keys(LOGS_LIST_WHERE_COLUMNS).map((id) => ({ id, label: id }));

const buildLogsWhere = (query: LogsListQuery): Prisma.BaseAppLogWhereInput => {
  const provider = readControlPlaneProvider();
  if (query.where) {
    const tree = parseListWhereTreeParam(query.where, LOGS_WHERE_FIELDS, DEFAULT_WHERE_OPERATORS);
    const compiled = listWhereIrToPrisma(
      tree ? listWhereTreeToIr(tree, DEFAULT_WHERE_OPERATORS) : null,
      LOGS_LIST_WHERE_COLUMNS,
      (value) => buildCaseInsensitiveContains(value, provider),
    );
    return (compiled ?? {}) as Prisma.BaseAppLogWhereInput;
  }

  const where: Prisma.BaseAppLogWhereInput = {
    ...buildLevelWhere(query.level),
  };

  const actorFilter = (query.actor ?? '').trim().toLowerCase();
  const contextFilter = (query.context ?? '').trim().toLowerCase();
  const folderFilter = (query.folder ?? '').trim().toLowerCase();
  const functionFilter = (query.functionName ?? '').trim().toLowerCase();
  const keyFilter = (query.key ?? '').trim().toLowerCase();
  const durationFilter = (query.duration ?? '').trim();
  const timestampFrom = (query.timestampFrom ?? '').trim();
  const timestampTo = (query.timestampTo ?? '').trim();

  if (actorFilter) {
    where.actor = buildContainsFilter(actorFilter);
  }
  if (contextFilter) {
    where.context = buildContainsFilter(contextFilter);
  }
  if (folderFilter) {
    where.message = buildContainsFilter(`/${folderFilter}/`);
  }
  if (functionFilter) {
    where.message = buildContainsFilter(functionFilter);
  } else if (keyFilter) {
    where.message = buildContainsFilter(keyFilter);
  }
  if (durationFilter && /^\d+$/.test(durationFilter)) {
    where.durationMs = Number(durationFilter);
  }
  if (timestampFrom || timestampTo) {
    where.createdAt = {
      ...(timestampFrom ? { gte: parseDateStart(timestampFrom) } : {}),
      ...(timestampTo ? { lte: parseDateEnd(timestampTo) } : {}),
    };
  }
  if (query.callSuccess === 'true') {
    where.callSuccess = 1;
  } else if (query.callSuccess === 'false') {
    where.callSuccess = 0;
  }
  const requestId = (query.requestId ?? '').trim();
  if (requestId && /^[A-Za-z0-9._:-]{8,128}$/.test(requestId)) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { metaJson: { contains: `"requestId":"${requestId}"` } },
        ],
      },
    ];
  }

  return where;
};

const buildOrderBy = (query: LogsListQuery): Prisma.BaseAppLogOrderByWithRelationInput[] => {
  const sortColumn = SORT_COLUMN_MAP[query.sortBy ?? ''] ?? 'id';
  const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';
  const primary = { [sortColumn]: sortDir } as Prisma.BaseAppLogOrderByWithRelationInput;
  // SQL Server rejects duplicate ORDER BY columns; PostgreSQL tolerates them.
  if (sortColumn === 'id') {
    return [primary];
  }
  return [primary, { id: 'desc' }];
};

export async function listAppLogsWithLevel(
  levelFilter: string,
  contextFilter: string,
  actorFilter: string,
  limit: number,
) {
  const contextNeedle = contextFilter.trim().toLowerCase();
  const actorNeedle = actorFilter.trim().toLowerCase();
  const rows = await prisma().baseAppLog.findMany({
    where: {
      level: levelFilter,
      ...(contextNeedle ? { context: buildContainsFilter(contextNeedle) } : {}),
      ...(actorNeedle ? { actor: buildContainsFilter(actorNeedle) } : {}),
    },
    select: listSelect,
    orderBy: { id: 'desc' },
    take: limit,
  });
  return rows.map(mapListRow);
}

export async function listAppLogs(
  contextFilter: string,
  actorFilter: string,
  limit: number,
) {
  const contextNeedle = contextFilter.trim().toLowerCase();
  const actorNeedle = actorFilter.trim().toLowerCase();
  const rows = await prisma().baseAppLog.findMany({
    where: {
      ...(contextNeedle ? { context: buildContainsFilter(contextNeedle) } : {}),
      ...(actorNeedle ? { actor: buildContainsFilter(actorNeedle) } : {}),
    },
    select: listSelect,
    orderBy: { id: 'desc' },
    take: limit,
  });
  return rows.map(mapListRow);
}

export async function listAppLogsFiltered(query: LogsListQuery): Promise<{
  items: AppLogListRow[];
  totalCount: number;
}> {
  const where = buildLogsWhere(query);
  const skip = query.offset ?? 0;
  const [rows, totalCount] = await Promise.all([
    prisma().baseAppLog.findMany({
      where,
      select: listSelect,
      orderBy: buildOrderBy(query),
      take: query.limit,
      skip,
    }),
    prisma().baseAppLog.count({ where }),
  ]);
  return { items: rows.map(mapListRow), totalCount };
}

export async function countAppLogsByLevelsSince(levels: string[], sinceIso: string): Promise<number> {
  if (levels.length === 0) return 0;

  return prisma().baseAppLog.count({
    where: {
      level: { in: levels },
      createdAt: { gte: new Date(sinceIso) },
    },
  });
}

export async function findAppLogById(id: number) {
  const row = await prisma().baseAppLog.findUnique({
    where: { id: toUserId(id) },
    select: {
      id: true,
      createdAt: true,
      actor: true,
      callSuccess: true,
      failureReason: true,
      durationMs: true,
      level: true,
      context: true,
      message: true,
      hasMeta: true,
      metaJson: true,
    },
  });
  if (!row) return undefined;

  const hasMeta = row.hasMeta === 1;
  return {
    id: fromUserId(row.id),
    timestamp: toIsoString(row.createdAt),
    actor: row.actor,
    callSuccess: mapCallSuccess(row.callSuccess),
    failureReason: row.failureReason,
    durationMs: row.durationMs,
    level: row.level,
    context: row.context,
    message: row.message,
    hasMeta,
    hasmeta: hasMeta,
    metaJson: row.metaJson,
    metajson: row.metaJson,
  } satisfies AppLogDetailRow;
}

export async function clearAppLogs() {
  await prisma().baseAppLog.deleteMany();
}
