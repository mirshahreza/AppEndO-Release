export const SAMPLE_MOCK_RELATION_KINDS = [
  'parent',
  'status',
  'owner',
  'detail',
  'comments',
  'tags',
] as const;

export type SampleMockRelationKind = typeof SAMPLE_MOCK_RELATION_KINDS[number];

export type SampleMockRelationIncludes = Record<SampleMockRelationKind, boolean>;

export const SAMPLE_MOCK_RELATION_LABELS: Record<SampleMockRelationKind, string> = {
  parent: 'Self parent (tree)',
  status: 'belongsTo status',
  owner: 'belongsTo owner',
  detail: 'hasOne detail',
  comments: 'hasMany comments',
  tags: 'belongsToMany tags',
};

export const ALL_SAMPLE_MOCK_RELATIONS_ON: SampleMockRelationIncludes = {
  parent: true,
  status: true,
  owner: true,
  detail: true,
  comments: true,
  tags: true,
};

export type SampleMockRecordDto = {
  id: string;
  parentId?: string;
  parentTitle?: string;
  code: string;
  title: string;
  subtitle?: string;
  website?: string;
  photo?: string;
  status?: string;
  statusId?: string;
  owner?: string;
  ownerId?: string;
  city?: string;
  detailNote?: string;
  comments?: string[];
  tags?: string[];
  locked: boolean;
  active: boolean;
  latitude?: number;
  longitude?: number;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
  approvedAt?: string;
  approvedBy?: string;
  lockedAt?: string;
  lockedBy?: string;
  unlockedAt?: string;
  unlockedBy?: string;
  __depth?: number;
};

export type SampleMockLookupDto = {
  id: string;
  code?: string;
  slug?: string;
  title: string;
  username?: string;
};

export const parseSampleMockIncludes = (raw: unknown): SampleMockRelationIncludes => {
  if (raw == null || raw === '') {
    return { ...ALL_SAMPLE_MOCK_RELATIONS_ON };
  }
  const tokens = String(raw)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (tokens.length === 1 && (tokens[0] === 'none' || tokens[0] === 'off')) {
    return {
      parent: false,
      status: false,
      owner: false,
      detail: false,
      comments: false,
      tags: false,
    };
  }
  const enabled = new Set(tokens);
  return {
    parent: enabled.has('parent'),
    status: enabled.has('status'),
    owner: enabled.has('owner'),
    detail: enabled.has('detail'),
    comments: enabled.has('comments'),
    tags: enabled.has('tags'),
  };
};

export const serializeSampleMockIncludes = (includes: SampleMockRelationIncludes): string => (
  SAMPLE_MOCK_RELATION_KINDS.filter((kind) => includes[kind]).join(',')
);

/** Same portrait set as Base Components → Avatar (`https://i.pravatar.cc/160?img=12`). */
const SAMPLE_MOCK_PHOTO_COUNT = 70;

export const sampleMockPhotoSrc = (index: number): string => {
  const img = (Math.abs(index) % SAMPLE_MOCK_PHOTO_COUNT) + 1;
  return `https://i.pravatar.cc/160?img=${img}`;
};
