import type { ChangeReasonPolicy } from '../../../shared/api/contracts/record-events';
import { prisma } from '../users/prismaHelpers';
import type { SampleMockLookupDto, SampleMockRecordDto, SampleMockRelationIncludes } from '../../../shared/api/contracts/sample-mock/records';
import { sampleMockPhotoSrc } from '../../../shared/api/contracts/sample-mock/records';
import {
  emitSampleMockCreatedHistory,
  emitSampleMockDeletedHistory,
  emitSampleMockSnapshotDiff,
  loadSampleMockHistorySnapshot,
} from '../record-events/sampleMockHistory';
import {
  collectSampleMockActorIds,
  computeSampleMockDepths,
  mapSampleMockRecord,
  sampleMockPrismaInclude,
  type SampleMockRecordRow,
} from './sampleMockMapper';

const APPROVED_STATUS_CODE = 'approved';
const OPEN_STATUS_CODE = 'open';

const loadPeopleById = async (ids: bigint[]) => {
  if (ids.length === 0) {
    return new Map<string, { id: bigint; username: string; displayName: string }>();
  }
  const people = await prisma().baseSampleMockPerson.findMany({
    where: { id: { in: ids } },
    select: { id: true, username: true, displayName: true },
  });
  return new Map(people.map((person) => [String(person.id), person]));
};

const mapRows = async (
  rows: SampleMockRecordRow[],
  includes: SampleMockRelationIncludes,
): Promise<SampleMockRecordDto[]> => {
  const peopleById = await loadPeopleById(collectSampleMockActorIds(rows));
  const depths = includes.parent ? computeSampleMockDepths(rows) : new Map<string, number>();
  return rows.map((row) => mapSampleMockRecord(
    row,
    includes,
    peopleById,
    includes.parent ? depths.get(String(row.id)) : undefined,
  ));
};

export const listSampleMockLookups = async (): Promise<{
  statuses: SampleMockLookupDto[];
  people: SampleMockLookupDto[];
  tags: SampleMockLookupDto[];
}> => {
  const [statuses, people, tags] = await Promise.all([
    prisma().baseSampleMockStatus.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma().baseSampleMockPerson.findMany({ orderBy: { username: 'asc' } }),
    prisma().baseSampleMockTag.findMany({ orderBy: { title: 'asc' } }),
  ]);
  return {
    statuses: statuses.map((row) => ({ id: String(row.id), code: row.code, title: row.title })),
    people: people.map((row) => ({
      id: String(row.id),
      username: row.username,
      title: row.displayName,
    })),
    tags: tags.map((row) => ({ id: String(row.id), slug: row.slug, title: row.title })),
  };
};

export const listSampleMockRecords = async (
  includes: SampleMockRelationIncludes,
): Promise<SampleMockRecordDto[]> => {
  const rows = await prisma().baseSampleMockRecord.findMany({
    include: sampleMockPrismaInclude(includes),
    orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
  });
  return mapRows(rows as SampleMockRecordRow[], includes);
};

const parseRecordId = (raw: string): bigint => {
  try {
    return BigInt(raw);
  } catch {
    throw new HttpError(400, 'Invalid sample mock record id.');
  }
};

export const getSampleMockRecordById = async (
  rawId: string,
  includes: SampleMockRelationIncludes,
): Promise<SampleMockRecordDto> => {
  const id = parseRecordId(rawId);
  const row = await prisma().baseSampleMockRecord.findUnique({
    where: { id },
    include: sampleMockPrismaInclude(includes),
  });
  if (!row) {
    throw new HttpError(404, 'Sample mock record was not found.');
  }
  const [mapped] = await mapRows([row as SampleMockRecordRow], includes);
  return mapped;
};

export const resolveSampleMockActorId = async (username: string): Promise<bigint> => {
  const trimmed = username.trim() || 'admin';
  const existing = await prisma().baseSampleMockPerson.findUnique({ where: { username: trimmed } });
  if (existing) {
    return existing.id;
  }
  const created = await prisma().baseSampleMockPerson.create({
    data: {
      username: trimmed,
      displayName: trimmed,
    },
  });
  return created.id;
};

const optionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
};

const optionalBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return undefined;
};

const optionalNumber = (value: unknown): number | undefined => {
  if (value === '' || value == null) {
    return undefined;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const resolveStatusId = async (status: string | undefined, fallbackCode: string): Promise<bigint> => {
  const token = status?.trim();
  if (token) {
    const match = await prisma().baseSampleMockStatus.findFirst({
      where: {
        OR: [
          { code: token.toLowerCase() },
          { title: token },
        ],
      },
    });
    if (match) {
      return match.id;
    }
  }
  const fallback = await prisma().baseSampleMockStatus.findUnique({ where: { code: fallbackCode } });
  if (!fallback) {
    throw new HttpError(500, 'Sample mock statuses are not seeded.');
  }
  return fallback.id;
};

const resolveOwnerId = async (owner: unknown): Promise<bigint | null> => {
  const token = optionalString(owner);
  if (!token) {
    return null;
  }
  const match = await prisma().baseSampleMockPerson.findFirst({
    where: {
      OR: [
        { username: token },
        { displayName: token },
      ],
    },
  });
  return match?.id ?? null;
};

const asStringArray = (value: unknown): string[] | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return undefined;
};

const slugifyTag = (title: string): string => (
  title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tag'
);

const resolveParentId = async (parent: unknown, excludeId?: bigint): Promise<bigint | null> => {
  const token = optionalString(parent);
  if (!token) {
    return null;
  }
  const match = await prisma().baseSampleMockRecord.findFirst({
    where: {
      OR: [
        { title: token },
        { code: token },
      ],
    },
  });
  if (!match || (excludeId != null && match.id === excludeId)) {
    return null;
  }
  return match.id;
};

const resolveTagIds = async (tags: unknown, actorId: bigint): Promise<bigint[] | undefined> => {
  const titles = asStringArray(tags);
  if (titles === undefined) {
    return undefined;
  }
  const ids: bigint[] = [];
  for (const title of titles) {
    const slug = slugifyTag(title);
    const existing = await prisma().baseSampleMockTag.findFirst({
      where: { OR: [{ title }, { slug }] },
    });
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    const created = await prisma().baseSampleMockTag.create({
      data: { title, slug, createdBy: actorId, updatedBy: actorId },
    });
    ids.push(created.id);
  }
  return [...new Set(ids)];
};

const upsertRecordDetail = async (input: {
  recordId: bigint;
  city: unknown;
  note: unknown;
  actorId: bigint;
}): Promise<void> => {
  if (input.city === undefined && input.note === undefined) {
    return;
  }
  const city = optionalString(input.city);
  const note = typeof input.note === 'string' ? input.note.trim() : undefined;
  const existing = await prisma().baseSampleMockDetail.findUnique({ where: { recordId: input.recordId } });
  const nextCity = city ?? existing?.city;
  if (!nextCity) {
    return;
  }
  await prisma().baseSampleMockDetail.upsert({
    where: { recordId: input.recordId },
    create: {
      recordId: input.recordId,
      city: nextCity,
      note: note || null,
      createdBy: input.actorId,
      updatedBy: input.actorId,
    },
    update: {
      ...(city ? { city } : {}),
      ...(input.note !== undefined ? { note: note || null } : {}),
      updatedBy: input.actorId,
      updatedAt: new Date(),
    },
  });
};

const syncRecordTags = async (recordId: bigint, tags: unknown, actorId: bigint): Promise<void> => {
  const tagIds = await resolveTagIds(tags, actorId);
  if (tagIds === undefined) {
    return;
  }
  await prisma().baseSampleMockRecordTag.deleteMany({ where: { recordId } });
  if (tagIds.length === 0) {
    return;
  }
  await prisma().baseSampleMockRecordTag.createMany({
    data: tagIds.map((tagId) => ({ recordId, tagId })),
  });
};

const syncRecordComments = async (recordId: bigint, comments: unknown, actorId: bigint): Promise<void> => {
  const bodies = asStringArray(comments);
  if (bodies === undefined) {
    return;
  }
  await prisma().baseSampleMockComment.deleteMany({ where: { recordId } });
  if (bodies.length === 0) {
    return;
  }
  await prisma().baseSampleMockComment.createMany({
    data: bodies.map((body) => ({
      recordId,
      body,
      createdBy: actorId,
      updatedBy: actorId,
    })),
  });
};

const nextOrderCode = async (): Promise<string> => {
  const latest = await prisma().baseSampleMockRecord.findMany({
    where: { code: { startsWith: 'ORD-' } },
    orderBy: { code: 'desc' },
    take: 1,
    select: { code: true },
  });
  const last = latest[0]?.code.match(/^ORD-(\d+)$/)?.[1];
  const next = (last ? Number(last) : 0) + 1;
  return `ORD-${String(next).padStart(3, '0')}`;
};

const nextSortOrder = async (): Promise<number> => {
  const latest = await prisma().baseSampleMockRecord.findFirst({
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });
  return (latest?.sortOrder ?? 0) + 1;
};

type SampleMockWritableFields = {
  code?: unknown;
  title?: unknown;
  subtitle?: unknown;
  website?: unknown;
  status?: unknown;
  owner?: unknown;
  parentTitle?: unknown;
  parentId?: unknown;
  city?: unknown;
  detailNote?: unknown;
  tags?: unknown;
  comments?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  active?: unknown;
};

type CreateSampleMockInput = SampleMockWritableFields & {
  actorId: bigint;
};

export const createSampleMockRecord = async (input: CreateSampleMockInput): Promise<SampleMockRecordDto> => {
  const title = optionalString(input.title) || 'New order';
  const code = optionalString(input.code) || await nextOrderCode();
  const existing = await prisma().baseSampleMockRecord.findUnique({ where: { code } });
  if (existing) {
    throw new HttpError(409, `Code ${code} is already used.`);
  }
  const statusId = await resolveStatusId(optionalString(input.status), OPEN_STATUS_CODE);
  const ownerId = await resolveOwnerId(input.owner)
    ?? (await prisma().baseSampleMockPerson.findFirst({ orderBy: { username: 'asc' } }))?.id
    ?? null;
  const count = await prisma().baseSampleMockRecord.count();
  const city = optionalString(input.city);
  const note = optionalString(input.detailNote);
  const parentId = await resolveParentId(input.parentTitle ?? input.parentId);
  const created = await prisma().baseSampleMockRecord.create({
    data: {
      code,
      title,
      subtitle: optionalString(input.subtitle) ?? `Customer ${count + 1}`,
      photo: sampleMockPhotoSrc(count + 1),
      website: optionalString(input.website) ?? `https://example.com/orders/${code.toLowerCase()}`,
      statusId,
      ownerId,
      parentId,
      active: optionalBoolean(input.active) ?? true,
      latitude: optionalNumber(input.latitude),
      longitude: optionalNumber(input.longitude),
      sortOrder: await nextSortOrder(),
      createdBy: input.actorId,
      updatedBy: input.actorId,
      ...(city ? {
        detail: {
          create: {
            city,
            note: note || null,
            createdBy: input.actorId,
            updatedBy: input.actorId,
          },
        },
      } : {}),
    },
  });
  await syncRecordTags(created.id, input.tags, input.actorId);
  await syncRecordComments(created.id, input.comments, input.actorId);
  if (!city && note) {
    await upsertRecordDetail({
      recordId: created.id,
      city: undefined,
      note: input.detailNote,
      actorId: input.actorId,
    });
  }
  const createdDto = await getSampleMockRecordById(String(created.id), {
    parent: true,
    status: true,
    owner: true,
    detail: true,
    comments: true,
    tags: true,
  });
  const snapshot = await loadSampleMockHistorySnapshot(String(created.id));
  if (snapshot) {
    await emitSampleMockCreatedHistory(snapshot);
  }
  return createdDto;
};

export const createSampleMockRecordsBulk = async (input: {
  title?: string;
  actorId: bigint;
}): Promise<SampleMockRecordDto[]> => {
  const stem = String(input.title || '').trim() || 'Bulk order';
  const created: SampleMockRecordDto[] = [];
  for (let index = 1; index <= 3; index += 1) {
    created.push(await createSampleMockRecord({
      title: `${stem} ${index}`,
      actorId: input.actorId,
    }));
  }
  return created;
};

export const patchSampleMockRecord = async (input: SampleMockWritableFields & {
  id: string;
  actorId: bigint;
  changeReasonPolicy?: ChangeReasonPolicy;
}): Promise<SampleMockRecordDto> => {
  const id = parseRecordId(input.id);
  const existing = await prisma().baseSampleMockRecord.findUnique({ where: { id } });
  if (!existing) {
    throw new HttpError(404, 'Sample mock record was not found.');
  }
  const before = await loadSampleMockHistorySnapshot(input.id);
  const data: {
    title?: string;
    subtitle?: string | null;
    website?: string | null;
    statusId?: bigint;
    ownerId?: bigint | null;
    parentId?: bigint | null;
    active?: boolean;
    latitude?: number | null;
    longitude?: number | null;
    updatedBy: bigint;
    updatedAt: Date;
    approvedAt?: Date | null;
    approvedBy?: bigint | null;
  } = {
    updatedBy: input.actorId,
    updatedAt: new Date(),
  };
  const title = optionalString(input.title);
  if (title) {
    data.title = title;
  }
  const subtitle = optionalString(input.subtitle);
  if (subtitle) {
    data.subtitle = subtitle;
  }
  const website = optionalString(input.website);
  if (website) {
    data.website = website;
  }
  const status = optionalString(input.status);
  if (status) {
    data.statusId = await resolveStatusId(status, OPEN_STATUS_CODE);
    const approved = status === 'Approved' || status.toLowerCase() === APPROVED_STATUS_CODE
      || status === 'Shipped'
      || status.toLowerCase() === 'shipped';
    if (approved) {
      data.approvedAt = new Date();
      data.approvedBy = input.actorId;
    }
  }
  if (optionalString(input.owner)) {
    const ownerId = await resolveOwnerId(input.owner);
    if (ownerId) {
      data.ownerId = ownerId;
    }
  }
  const active = optionalBoolean(input.active);
  if (active !== undefined) {
    data.active = active;
  }
  const latitude = optionalNumber(input.latitude);
  if (latitude !== undefined) {
    data.latitude = latitude;
  }
  const longitude = optionalNumber(input.longitude);
  if (longitude !== undefined) {
    data.longitude = longitude;
  }
  if (typeof input.parentTitle === 'string' || typeof input.parentId === 'string') {
    data.parentId = await resolveParentId(input.parentTitle ?? input.parentId, id);
  }
  await prisma().baseSampleMockRecord.update({ where: { id }, data });
  await upsertRecordDetail({
    recordId: id,
    city: input.city,
    note: input.detailNote,
    actorId: input.actorId,
  });
  await syncRecordTags(id, input.tags, input.actorId);
  await syncRecordComments(id, input.comments, input.actorId);
  const after = await loadSampleMockHistorySnapshot(input.id);
  if (before && after) {
    await emitSampleMockSnapshotDiff(before, after, { policy: input.changeReasonPolicy });
  }
  return getSampleMockRecordById(input.id, {
    parent: true,
    status: true,
    owner: true,
    detail: true,
    comments: true,
    tags: true,
  });
};

export const approveSampleMockRecord = async (input: {
  id: string;
  status?: unknown;
  actorId: bigint;
  changeReasonPolicy?: ChangeReasonPolicy;
}): Promise<SampleMockRecordDto> => {
  const nextStatus = typeof input.status === 'string' && input.status.trim()
    ? input.status.trim()
    : 'Approved';
  return patchSampleMockRecord({
    id: input.id,
    status: nextStatus,
    actorId: input.actorId,
    changeReasonPolicy: input.changeReasonPolicy,
  });
};

export const lockSampleMockRecord = async (input: {
  id: string;
  locked?: unknown;
  actorId: bigint;
  changeReasonPolicy?: ChangeReasonPolicy;
}): Promise<SampleMockRecordDto> => {
  const id = parseRecordId(input.id);
  const existing = await prisma().baseSampleMockRecord.findUnique({ where: { id } });
  if (!existing) {
    throw new HttpError(404, 'Sample mock record was not found.');
  }
  const before = await loadSampleMockHistorySnapshot(input.id);
  const nextLocked = typeof input.locked === 'boolean' ? input.locked : !existing.locked;
  const now = new Date();
  await prisma().baseSampleMockRecord.update({
    where: { id },
    data: nextLocked
      ? {
        locked: true,
        lockedAt: now,
        lockedBy: input.actorId,
        unlockedAt: null,
        unlockedBy: null,
        updatedAt: now,
        updatedBy: input.actorId,
      }
      : {
        locked: false,
        unlockedAt: now,
        unlockedBy: input.actorId,
        updatedAt: now,
        updatedBy: input.actorId,
      },
  });
  const after = await loadSampleMockHistorySnapshot(input.id);
  if (before && after) {
    await emitSampleMockSnapshotDiff(before, after, { policy: input.changeReasonPolicy });
  }
  return getSampleMockRecordById(input.id, {
    parent: true,
    status: true,
    owner: true,
    detail: true,
    comments: true,
    tags: true,
  });
};

export const deleteSampleMockRecord = async (
  rawId: string,
  changeReasonPolicy?: ChangeReasonPolicy,
): Promise<void> => {
  const id = parseRecordId(rawId);
  const existing = await prisma().baseSampleMockRecord.findUnique({ where: { id } });
  if (!existing) {
    throw new HttpError(404, 'Sample mock record was not found.');
  }
  await emitSampleMockDeletedHistory(rawId, changeReasonPolicy);
  await prisma().baseSampleMockRecord.delete({ where: { id } });
};
