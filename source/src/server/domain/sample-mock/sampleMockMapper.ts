import type {
  SampleMockRecordDto,
  SampleMockRelationIncludes,
} from '../../../shared/api/contracts/sample-mock/records';

const toId = (value: bigint | number | null | undefined): string | undefined => (
  value == null ? undefined : String(value)
);

const toIso = (value: Date | null | undefined): string | undefined => (
  value instanceof Date ? value.toISOString() : undefined
);

type NamedRef = {
  id: bigint;
  title?: string;
  username?: string;
  displayName?: string;
};

export type SampleMockRecordRow = {
  id: bigint;
  parentId: bigint | null;
  code: string;
  title: string;
  subtitle: string | null;
  website: string | null;
  photo: string | null;
  statusId: bigint;
  ownerId: bigint | null;
  locked: boolean;
  active: boolean;
  latitude?: number | null;
  longitude?: number | null;
  approvedAt: Date | null;
  approvedBy: bigint | null;
  lockedAt: Date | null;
  lockedBy: bigint | null;
  unlockedAt: Date | null;
  unlockedBy: bigint | null;
  createdAt: Date | null;
  createdBy: bigint | null;
  updatedAt: Date | null;
  updatedBy: bigint | null;
  parent?: { id: bigint; title: string; code: string } | null;
  status?: { id: bigint; title: string; code: string } | null;
  owner?: { id: bigint; username: string; displayName: string } | null;
  detail?: { city: string; note: string | null } | null;
  comments?: Array<{ body: string }>;
  recordTags?: Array<{ tag: { slug: string; title: string } }>;
};

export const sampleMockPrismaInclude = (includes: SampleMockRelationIncludes) => ({
  parent: includes.parent,
  status: includes.status,
  owner: includes.owner,
  detail: includes.detail,
  comments: includes.comments ? { orderBy: { createdAt: 'asc' as const } } : false,
  recordTags: includes.tags ? { include: { tag: true } } : false,
});

export const computeSampleMockDepths = (
  rows: ReadonlyArray<{ id: bigint; parentId: bigint | null }>,
): Map<string, number> => {
  const byId = new Map(rows.map((row) => [String(row.id), row]));
  const depths = new Map<string, number>();

  const depthOf = (id: string, stack: Set<string>): number => {
    const cached = depths.get(id);
    if (cached != null) {
      return cached;
    }
    if (stack.has(id)) {
      return 0;
    }
    const row = byId.get(id);
    if (!row?.parentId) {
      depths.set(id, 0);
      return 0;
    }
    stack.add(id);
    const next = depthOf(String(row.parentId), stack) + 1;
    stack.delete(id);
    depths.set(id, next);
    return next;
  };

  for (const row of rows) {
    depthOf(String(row.id), new Set());
  }
  return depths;
};

const actorName = (
  actorId: bigint | null,
  peopleById: Map<string, NamedRef>,
): string | undefined => {
  if (actorId == null) {
    return undefined;
  }
  const person = peopleById.get(String(actorId));
  return person?.username ?? person?.displayName;
};

export const mapSampleMockRecord = (
  row: SampleMockRecordRow,
  includes: SampleMockRelationIncludes,
  peopleById: Map<string, NamedRef>,
  depth?: number,
): SampleMockRecordDto => {
  const dto: SampleMockRecordDto = {
    id: String(row.id),
    code: row.code,
    title: row.title,
    locked: row.locked,
    active: row.active,
  };

  if (row.subtitle) dto.subtitle = row.subtitle;
  if (row.website) dto.website = row.website;
  if (row.photo) dto.photo = row.photo;
  if (typeof row.latitude === 'number' && Number.isFinite(row.latitude)) dto.latitude = row.latitude;
  if (typeof row.longitude === 'number' && Number.isFinite(row.longitude)) dto.longitude = row.longitude;
  if (row.parentId != null) dto.parentId = String(row.parentId);
  if (depth != null) dto.__depth = depth;

  dto.createdAt = toIso(row.createdAt);
  dto.updatedAt = toIso(row.updatedAt);
  dto.createdBy = actorName(row.createdBy, peopleById);
  dto.updatedBy = actorName(row.updatedBy, peopleById);
  dto.approvedAt = toIso(row.approvedAt);
  dto.approvedBy = actorName(row.approvedBy, peopleById);
  dto.lockedAt = toIso(row.lockedAt);
  dto.lockedBy = actorName(row.lockedBy, peopleById);
  dto.unlockedAt = toIso(row.unlockedAt);
  dto.unlockedBy = actorName(row.unlockedBy, peopleById);

  if (includes.parent) {
    dto.parentTitle = row.parent?.title;
  }
  if (includes.status) {
    dto.status = row.status?.title;
    dto.statusId = toId(row.statusId);
  }
  if (includes.owner) {
    dto.owner = row.owner?.username ?? row.owner?.displayName;
    dto.ownerId = toId(row.ownerId);
  }
  if (includes.detail && row.detail) {
    dto.city = row.detail.city;
    if (row.detail.note) dto.detailNote = row.detail.note;
  }
  if (includes.comments) {
    dto.comments = (row.comments ?? []).map((comment) => comment.body);
  }
  if (includes.tags) {
    dto.tags = (row.recordTags ?? []).map((link) => link.tag.title);
  }

  return dto;
};

export const collectSampleMockActorIds = (rows: ReadonlyArray<SampleMockRecordRow>): bigint[] => {
  const ids = new Set<bigint>();
  for (const row of rows) {
    for (const value of [row.createdBy, row.updatedBy, row.approvedBy, row.lockedBy, row.unlockedBy]) {
      if (value != null) ids.add(value);
    }
  }
  return [...ids];
};
