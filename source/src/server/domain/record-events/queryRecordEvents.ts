import { Op, QueryTypes, type WhereOptions } from 'sequelize';
import type { RecordEventListQuery, RecordEventPublicRow } from '../../../shared/api/contracts/record-events';
import { resolveRecordEventSubjectKinds } from '../../../shared/api/contracts/record-events/filterCatalog';
import { recordEventReasonLabelFromCatalog } from '../../../shared/lib/formatRecordEventValue';
import { resolveRecordEventFieldQuery } from '../../../shared/lib/recordEventHistoryFields';
import { formatProfileDisplayName } from '../../../shared/profile/profileDisplayName';
import { prisma, loadUsernameMap } from '../users/prismaHelpers';
import { getRecordEventModel, type RecordEventRow } from './recordEventSequelizeModels';
import { parseRecordEventStoredValue } from './recordEventRedact';
import {
  listWhereTreeToIr,
  parseListWhereTreeParam,
} from '../../../shared/ui/list-filter/listWhereFilter';
import { listWhereIrToSequelize } from '../../../shared/ui/list-filter/listWhereQuery';
import { DEFAULT_WHERE_OPERATORS } from '../../../shared/ui/where-builder/whereBuilderModel';
import { mergeDescendingPage } from '../../../shared/lib/mergeArchivePage';

const toNumber = (value: unknown): number | null => {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const parseJson = (raw: string | null): unknown => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
};

export const toPublicRecordEvent = (
  row: RecordEventRow,
  unmask: boolean,
): RecordEventPublicRow => {
  const clientJson = parseJson(row.clientJson) as { observed?: Record<string, unknown> } | null;
  const clockSkew = typeof clientJson?.observed?.clockSkewMinutes === 'number'
    ? clientJson.observed.clockSkewMinutes
    : null;
  return {
    id: String(row.id),
    subjectKind: row.subjectKind,
    subjectId: row.subjectId,
    occurredAt: row.occurredAt instanceof Date ? row.occurredAt.toISOString() : String(row.occurredAt),
    actorUserId: toNumber(row.actorUserId),
    actingAsUserId: toNumber(row.actingAsUserId),
    actorKind: row.actorKind as RecordEventPublicRow['actorKind'],
    outcome: row.outcome as RecordEventPublicRow['outcome'],
    source: row.source as RecordEventPublicRow['source'],
    sourceRef: row.sourceRef,
    requestId: row.requestId,
    eventKind: row.eventKind as RecordEventPublicRow['eventKind'],
    field: row.field,
    fromValue: parseRecordEventStoredValue(row.fromValue, unmask),
    toValue: parseRecordEventStoredValue(row.toValue, unmask),
    reasonCode: row.reasonCode,
    reasonText: row.reasonText,
    correlationId: row.correlationId,
    subjectSeq: Number(row.subjectSeq),
    clientChannel: row.clientChannel,
    clientInstallId: row.clientInstallId,
    clientJson: parseJson(row.clientJson),
    payload: parseJson(row.payload),
    clockSkewMinutes: clockSkew,
    projection: 'record',
  };
};

type ActorIdentity = {
  username: string | null;
  displayName: string | null;
};

type ActorIdentityRow = {
  id: number | string;
  username?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  company_name?: string | null;
  person_type_code?: string | null;
};

type ExtraReasonRow = {
  id: string;
  title_en?: string | null;
  title?: string | null;
};

const namedInClause = (ids: Array<number | string>, prefix: string) => ({
  placeholders: ids.map((_, index) => `:${prefix}${index}`).join(', '),
  replacements: Object.fromEntries(ids.map((id, index) => [`${prefix}${index}`, id])),
});

const rowValue = (row: Record<string, unknown>, key: string): unknown => {
  if (key in row) return row[key];
  const match = Object.keys(row).find((name) => name.toLowerCase() === key.toLowerCase());
  return match ? row[match] : undefined;
};

const loadActorIdentitiesFromSequelize = async (ids: number[]): Promise<Map<number, ActorIdentity>> => {
  const sequelize = getRecordEventModel().sequelize;
  if (!sequelize || ids.length === 0) return new Map();
  const { placeholders, replacements } = namedInClause(ids, 'actor');
  const rows = await sequelize.query<ActorIdentityRow>(
    `SELECT u.id AS id,
            u.username AS username,
            p.firstname AS firstname,
            p.lastname AS lastname,
            p.company_name AS company_name,
            p.person_type_code AS person_type_code
     FROM base_users u
     LEFT JOIN base_user_profiles p ON p.user_id = u.id
     WHERE u.id IN (${placeholders})`,
    { replacements, type: QueryTypes.SELECT },
  );
  const identities = new Map<number, ActorIdentity>();
  for (const row of rows) {
    const record = row as unknown as Record<string, unknown>;
    const id = toNumber(rowValue(record, 'id'));
    if (id == null) continue;
    identities.set(id, {
      username: String(rowValue(record, 'username') ?? '').trim() || null,
      displayName: formatProfileDisplayName({
        firstname: rowValue(record, 'firstname') as string | null,
        lastname: rowValue(record, 'lastname') as string | null,
        companyName: rowValue(record, 'company_name') as string | null,
        personTypeCode: rowValue(record, 'person_type_code') as string | null,
      }),
    });
  }
  return identities;
};

const loadActorIdentities = async (ids: number[]): Promise<Map<number, ActorIdentity>> => {
  if (ids.length === 0) return new Map();
  const identities = new Map<number, ActorIdentity>();
  try {
    const usernames = await loadUsernameMap(ids);
    for (const [id, username] of usernames) {
      identities.set(id, { username: username?.trim() || null, displayName: null });
    }
  } catch {
    // Prisma is unavailable in sqlite record-event unit tests.
  }
  const missing = ids.filter((id) => !identities.get(id)?.username);
  if (missing.length === 0) return identities;
  try {
    const fromSql = await loadActorIdentitiesFromSequelize(missing);
    for (const [id, row] of fromSql) {
      const current = identities.get(id);
      identities.set(id, {
        username: current?.username || row.username,
        displayName: row.displayName ?? current?.displayName ?? null,
      });
    }
  } catch {
    // Join tables may be absent in sqlite unit tests that do not seed users.
  }
  return identities;
};

const loadExtraReasonLabels = async (codes: string[]): Promise<Map<string, string>> => {
  const sequelize = getRecordEventModel().sequelize;
  if (!sequelize || codes.length === 0) return new Map();
  const { placeholders, replacements } = namedInClause(codes, 'reason');
  const rows = await sequelize.query<ExtraReasonRow>(
    `SELECT id, title_en, title
     FROM base_info
     WHERE id IN (${placeholders})`,
    { replacements, type: QueryTypes.SELECT },
  );
  return new Map(
    rows.map((row) => [row.id, (row.title_en || row.title || row.id).trim()]),
  );
};

const attachRecordEventParties = async (items: RecordEventPublicRow[]): Promise<RecordEventPublicRow[]> => {
  if (items.length === 0) return items;
  const withCatalog = items.map((item) => ({
    ...item,
    reasonLabel: item.reasonLabel ?? recordEventReasonLabelFromCatalog(item.reasonCode),
  }));
  const ids = [...new Set(
    withCatalog.flatMap((item) => [item.actorUserId, item.actingAsUserId])
      .filter((id): id is number => id != null),
  )];
  const codes = [...new Set(
    withCatalog
      .map((item) => item.reasonCode?.trim())
      .filter((code): code is string => Boolean(code)),
  )];
  const missingCodes = codes.filter((code) => !recordEventReasonLabelFromCatalog(code));
  const [identities, extraLabels] = await Promise.all([
    loadActorIdentities(ids).catch(() => new Map<number, ActorIdentity>()),
    loadExtraReasonLabels(missingCodes).catch(() => new Map<string, string>()),
  ]);
  return withCatalog.map((item) => {
    const actor = item.actorUserId != null ? identities.get(item.actorUserId) : undefined;
    const actingAs = item.actingAsUserId != null ? identities.get(item.actingAsUserId) : undefined;
    return {
      ...item,
      actorUsername: actor?.username ?? item.actorUsername ?? null,
      actorDisplayName: actor?.displayName ?? item.actorDisplayName ?? null,
      actingAsUsername: actingAs?.username ?? item.actingAsUsername ?? null,
      actingAsDisplayName: actingAs?.displayName ?? item.actingAsDisplayName ?? null,
      reasonLabel: item.reasonLabel || (item.reasonCode ? extraLabels.get(item.reasonCode) ?? null : null),
    };
  });
};

const authEventKind = (eventType: string, success: boolean): string => {
  const normalized = eventType.toLowerCase();
  if (normalized.includes('lock') && !normalized.includes('unlock')) return 'auth.lock';
  if (normalized.includes('unlock')) return 'auth.unlock';
  if (normalized.includes('fail') || !success) return 'auth.login_failed';
  return 'auth.login';
};

const compareOccurredAtDesc = (left: RecordEventPublicRow, right: RecordEventPublicRow) => (
  String(right.occurredAt).localeCompare(String(left.occurredAt))
);

const requestIdJsonFragment = (requestId: string): string => `"requestId":"${requestId}"`;

type AuthAuditListRow = {
  id: bigint | number;
  createdAt: Date | string;
  userId: bigint | number | null;
  success: boolean | null;
  eventType: string;
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadataJson: string | null;
};

const projectAuthAuditRow = (row: AuthAuditListRow, userId: number): RecordEventPublicRow => ({
  id: `auth:${String(row.id)}`,
  subjectKind: 'base_users',
  subjectId: String(userId),
  occurredAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  actorUserId: row.userId != null ? Number(row.userId) : null,
  actingAsUserId: null,
  actorKind: 'user',
  outcome: row.success ? 'success' : 'denied',
  source: 'patch',
  sourceRef: null,
  requestId: null,
  eventKind: authEventKind(row.eventType, Boolean(row.success)),
  field: null,
  fromValue: null,
  toValue: null,
  reasonCode: null,
  reasonText: row.reason ?? null,
  correlationId: `auth:${String(row.id)}`,
  subjectSeq: 0,
  clientChannel: null,
  clientInstallId: null,
  clientJson: {
    observed: {
      ip: row.ipAddress,
      userAgent: row.userAgent,
    },
    claimed: {},
  },
  payload: row.metadataJson ? parseJson(row.metadataJson) : { eventType: row.eventType },
  projection: 'auth',
});

export const listRecordEvents = async (
  query: RecordEventListQuery,
  options: { unmask?: boolean; includeAuth?: boolean } = {},
): Promise<{ items: RecordEventPublicRow[]; totalCount: number; archiveUnavailable?: boolean }> => {
  const Model = getRecordEventModel();
  const subjectKinds = resolveRecordEventSubjectKinds(query);
  if (subjectKinds === 'empty') {
    return { items: [], totalCount: 0 };
  }
  const baseWhere: WhereOptions = {};
  if (subjectKinds?.length === 1) baseWhere.subjectKind = subjectKinds[0];
  if (subjectKinds && subjectKinds.length > 1) baseWhere.subjectKind = { [Op.in]: subjectKinds };
  if (query.subjectId) baseWhere.subjectId = query.subjectId;
  if (query.actorUserId) baseWhere.actorUserId = query.actorUserId;
  if (query.actingAsUserId) baseWhere.actingAsUserId = query.actingAsUserId;
  if (query.clientChannel) baseWhere.clientChannel = query.clientChannel;
  const fieldQuery = resolveRecordEventFieldQuery({
    subjectKind: query.subjectKind,
    field: query.field,
  });
  if (!query.where) {
    if (query.eventKind) baseWhere.eventKind = query.eventKind;
    if (query.source) baseWhere.source = query.source;
    if (query.outcome) baseWhere.outcome = query.outcome;
    if (fieldQuery) baseWhere.field = fieldQuery;
    if (query.from || query.to) {
      baseWhere.occurredAt = {
        ...(query.from ? { [Op.gte]: new Date(query.from) } : {}),
        ...(query.to ? { [Op.lte]: new Date(query.to) } : {}),
      };
    }
  }
  let where: WhereOptions = baseWhere;
  if (query.where) {
    const fields = Object.keys(RECORD_EVENTS_LIST_WHERE_COLUMNS).map((id) => ({ id, label: id }));
    const tree = parseListWhereTreeParam(query.where, fields, DEFAULT_WHERE_OPERATORS);
    const compiled = listWhereIrToSequelize(
      tree ? listWhereTreeToIr(tree, DEFAULT_WHERE_OPERATORS) : null,
      RECORD_EVENTS_LIST_WHERE_COLUMNS,
      Op as unknown as Record<string, symbol>,
    );
    if (compiled && Object.keys(compiled).length > 0) {
      where = { [Op.and]: [baseWhere, compiled] };
    }
  }

  const limit = query.limit ?? 100;
  const offset = query.offset ?? 0;
  if (query.projection === 'latest-per-field') {
    const latestWhere: WhereOptions = {
      ...where,
      outcome: 'success',
      field: fieldQuery
        ? fieldQuery
        : { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
    };
    const latestRows = await Model.findAll({
      where: latestWhere,
      order: [['occurredAt', 'DESC'], ['subjectSeq', 'DESC']],
      limit: Math.min(Math.max(limit, 500), 2000),
    });
    const seen = new Set<string>();
    const items: RecordEventPublicRow[] = [];
    for (const row of latestRows) {
      const field = row.field;
      if (!field || seen.has(field)) continue;
      seen.add(field);
      items.push(toPublicRecordEvent(row.get({ plain: true }) as RecordEventRow, Boolean(options.unmask)));
    }
    return { items: await attachRecordEventParties(items), totalCount: items.length };
  }
  const includeArchived = query.includeArchived === '1' || query.includeArchived === 'true';
  const includeAuth = options.includeAuth
    && (query.subjectKind === 'base_users' || subjectKinds?.includes('base_users'))
    && Boolean(query.subjectId)
    && (!query.eventKind || query.eventKind.startsWith('auth.'));
  const needsWindowMerge = includeArchived || includeAuth;
  const fetchLimit = needsWindowMerge ? offset + limit : limit;
  const fetchOffset = needsWindowMerge ? 0 : offset;
  const { rows, count } = await Model.findAndCountAll({
    where,
    order: [['occurredAt', 'DESC'], ['subjectSeq', 'DESC']],
    limit: fetchLimit,
    offset: fetchOffset,
  });
  let items = rows.map((row) => toPublicRecordEvent(row.get({ plain: true }) as RecordEventRow, Boolean(options.unmask)));
  let totalCount = count;
  let archiveUnavailable = false;
  if (includeArchived) {
    const { listArchivedRecordEventRows } = await import('../retention/archiveLookup');
    const archived = await listArchivedRecordEventRows({ ...query, limit: fetchLimit, offset: 0 });
    archiveUnavailable = archived.unavailable;
    if (!archived.unavailable) {
      const archivedPublic = archived.items.map((row) => toPublicRecordEvent(row, Boolean(options.unmask)));
      const merged = mergeDescendingPage(
        items,
        archivedPublic,
        includeAuth ? 0 : offset,
        includeAuth ? fetchLimit : limit,
        compareOccurredAtDesc,
        count,
        archived.totalCount,
      );
      items = merged.items;
      totalCount = merged.totalCount;
    } else if (!includeAuth) {
      items = items.slice(offset, offset + limit);
    }
  }
  if (!includeAuth) {
    return { items: await attachRecordEventParties(items), totalCount, archiveUnavailable };
  }

  const userId = Number(query.subjectId);
  if (!Number.isFinite(userId)) {
    return {
      items: await attachRecordEventParties(items.slice(offset, offset + limit)),
      totalCount,
      archiveUnavailable,
    };
  }

  try {
    const authWhere = { userId: BigInt(userId) };
    const [authRows, authCount] = await Promise.all([
      prisma().baseAuthAuditLog.findMany({
        where: authWhere,
        orderBy: { createdAt: 'desc' },
        take: fetchLimit,
      }),
      prisma().baseAuthAuditLog.count({ where: authWhere }),
    ]);
    let projected = authRows.map((row) => projectAuthAuditRow(row, userId));
    if (query.eventKind) {
      projected = projected.filter((row) => row.eventKind === query.eventKind);
    }
    const merged = mergeDescendingPage(
      items,
      projected,
      offset,
      limit,
      compareOccurredAtDesc,
      totalCount,
      authCount,
    );
    return { items: await attachRecordEventParties(merged.items), totalCount: merged.totalCount, archiveUnavailable };
  } catch {
    return {
      items: await attachRecordEventParties(items.slice(offset, offset + limit)),
      totalCount,
      archiveUnavailable,
    };
  }
};

export const getRecordEventById = async (
  id: string,
  unmask = false,
): Promise<RecordEventPublicRow | null> => {
  const row = await getRecordEventModel().findByPk(id);
  if (!row) return null;
  const [item] = await attachRecordEventParties([
    toPublicRecordEvent(row.get({ plain: true }) as RecordEventRow, unmask),
  ]);
  return item ?? null;
};

export const listUserDevices = async (userId: number): Promise<Array<{
  installId: string;
  lastSeenAt: string;
  channel: string | null;
  ip: string | null;
  appVersion: string | null;
}>> => {
  const Model = getRecordEventModel();
  const subjectId = String(userId);
  const rows = await Model.findAll({
    where: {
      clientInstallId: { [Op.ne]: null },
      [Op.or]: [
        { subjectKind: 'base_users', subjectId },
        { actorUserId: userId },
      ],
    },
    order: [['occurredAt', 'DESC']],
    limit: 500,
  });
  const seen = new Map<string, {
    installId: string;
    lastSeenAt: string;
    channel: string | null;
    ip: string | null;
    appVersion: string | null;
  }>();
  for (const row of rows) {
    const installId = row.clientInstallId;
    if (!installId || seen.has(installId)) continue;
    const clientJson = parseJson(row.clientJson) as { claimed?: { appVersion?: string } } | null;
    seen.set(installId, {
      installId,
      lastSeenAt: row.occurredAt instanceof Date ? row.occurredAt.toISOString() : String(row.occurredAt),
      channel: row.clientChannel,
      ip: row.clientIp,
      appVersion: typeof clientJson?.claimed?.appVersion === 'string' ? clientJson.claimed.appVersion : null,
    });
  }
  return [...seen.values()];
};

export const hasHttpLogForRequestId = async (requestId: string): Promise<boolean> => {
  if (!requestId.trim()) return false;
  try {
    const sanitized = requestId.replace(/[^A-Za-z0-9._:-]/g, '');
    if (!sanitized) return false;
    const row = await prisma().baseAppLog.findFirst({
      where: { metaJson: { contains: requestIdJsonFragment(sanitized) } },
      select: { id: true },
    });
    if (row) return true;
    const { hasArchivedHttpLogForRequestId } = await import('../retention/archiveLookup');
    const archived = await hasArchivedHttpLogForRequestId(sanitized);
    return archived === true;
  } catch {
    return false;
  }
};
