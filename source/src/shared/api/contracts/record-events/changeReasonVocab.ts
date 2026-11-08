/** Platform Base Info catalog for save-gate change reasons. Do not move off `100.6`. */

export const RECORD_CHANGE_REASON_VOCAB_ROOT = '100.6';
export const RECORD_CHANGE_REASON_GENERAL = '100.6.0';
export const RECORD_CHANGE_REASON_USERS_LOCK = '100.6.20';
export const RECORD_CHANGE_REASON_USERS_ROLES = '100.6.21';
export const RECORD_CHANGE_REASON_USERS_LIFECYCLE = '100.6.22';
export const RECORD_CHANGE_REASON_SAMPLE_MOCK = '100.6.35';
export const RECORD_CHANGE_REASON_REVERTED = '100.6.8';
export const RECORD_CHANGE_REASON_LOCK = '100.6.6';
export const RECORD_CHANGE_REASON_UNLOCK = '100.6.7';
export const RECORD_CHANGE_REASON_ROLE_ASSIGNMENT = '100.6.4';

export type ChangeReasonSelectOption = {
  id: string;
  label: string;
};

export type ChangeReasonSeedRow = {
  id: string;
  parentId: string;
  title: string;
  viewOrder: number;
  value: number;
};

export const RECORD_CHANGE_REASON_FOLDER_OPTIONS: readonly ChangeReasonSelectOption[] = [
  { id: RECORD_CHANGE_REASON_GENERAL, label: 'General' },
  { id: RECORD_CHANGE_REASON_USERS_LOCK, label: 'Users lock' },
  { id: RECORD_CHANGE_REASON_USERS_ROLES, label: 'Users roles' },
  { id: RECORD_CHANGE_REASON_USERS_LIFECYCLE, label: 'Users lifecycle' },
  { id: RECORD_CHANGE_REASON_SAMPLE_MOCK, label: 'Sample mock' },
];

/** Folders + leaves. Combo uses leaves only. Keep existing leaf ids when adding items. */
export const RECORD_CHANGE_REASON_SEED_ROWS: readonly ChangeReasonSeedRow[] = [
  { id: RECORD_CHANGE_REASON_VOCAB_ROOT, parentId: '100', title: 'Record change reasons', viewOrder: 6, value: 6 },
  { id: RECORD_CHANGE_REASON_GENERAL, parentId: RECORD_CHANGE_REASON_VOCAB_ROOT, title: 'General', viewOrder: 0, value: 0 },
  { id: RECORD_CHANGE_REASON_USERS_LOCK, parentId: RECORD_CHANGE_REASON_VOCAB_ROOT, title: 'Users lock', viewOrder: 20, value: 20 },
  { id: RECORD_CHANGE_REASON_USERS_ROLES, parentId: RECORD_CHANGE_REASON_VOCAB_ROOT, title: 'Users roles', viewOrder: 21, value: 21 },
  { id: RECORD_CHANGE_REASON_USERS_LIFECYCLE, parentId: RECORD_CHANGE_REASON_VOCAB_ROOT, title: 'Users lifecycle', viewOrder: 22, value: 22 },
  { id: RECORD_CHANGE_REASON_SAMPLE_MOCK, parentId: RECORD_CHANGE_REASON_VOCAB_ROOT, title: 'Sample mock', viewOrder: 35, value: 35 },
  { id: '100.6.1', parentId: RECORD_CHANGE_REASON_GENERAL, title: 'Correction', viewOrder: 1, value: 1 },
  { id: '100.6.2', parentId: RECORD_CHANGE_REASON_GENERAL, title: 'User requested', viewOrder: 2, value: 2 },
  { id: '100.6.12', parentId: RECORD_CHANGE_REASON_GENERAL, title: 'Data entry error', viewOrder: 3, value: 12 },
  { id: '100.6.16', parentId: RECORD_CHANGE_REASON_GENERAL, title: 'Name or identity change', viewOrder: 4, value: 16 },
  { id: '100.6.13', parentId: RECORD_CHANGE_REASON_GENERAL, title: 'Duplicate or merge', viewOrder: 5, value: 13 },
  { id: '100.6.15', parentId: RECORD_CHANGE_REASON_GENERAL, title: 'Policy update', viewOrder: 6, value: 15 },
  { id: '100.6.3', parentId: RECORD_CHANGE_REASON_GENERAL, title: 'Security', viewOrder: 7, value: 3 },
  { id: '100.6.11', parentId: RECORD_CHANGE_REASON_GENERAL, title: 'Compliance', viewOrder: 8, value: 11 },
  { id: '100.6.14', parentId: RECORD_CHANGE_REASON_GENERAL, title: 'Legal or court order', viewOrder: 9, value: 14 },
  { id: '100.6.8', parentId: RECORD_CHANGE_REASON_GENERAL, title: 'Reverted', viewOrder: 10, value: 8 },
  { id: '100.6.17', parentId: RECORD_CHANGE_REASON_GENERAL, title: 'Other', viewOrder: 11, value: 17 },
  { id: RECORD_CHANGE_REASON_LOCK, parentId: RECORD_CHANGE_REASON_USERS_LOCK, title: 'Lock', viewOrder: 1, value: 6 },
  { id: RECORD_CHANGE_REASON_UNLOCK, parentId: RECORD_CHANGE_REASON_USERS_LOCK, title: 'Unlock', viewOrder: 2, value: 7 },
  { id: '100.6.23', parentId: RECORD_CHANGE_REASON_USERS_LOCK, title: 'Inactivity', viewOrder: 3, value: 23 },
  { id: '100.6.24', parentId: RECORD_CHANGE_REASON_USERS_LOCK, title: 'Policy violation', viewOrder: 4, value: 24 },
  { id: '100.6.25', parentId: RECORD_CHANGE_REASON_USERS_LOCK, title: 'Security incident', viewOrder: 5, value: 25 },
  { id: '100.6.26', parentId: RECORD_CHANGE_REASON_USERS_LOCK, title: 'Account recovery', viewOrder: 6, value: 26 },
  { id: RECORD_CHANGE_REASON_ROLE_ASSIGNMENT, parentId: RECORD_CHANGE_REASON_USERS_ROLES, title: 'Role assignment', viewOrder: 1, value: 4 },
  { id: '100.6.5', parentId: RECORD_CHANGE_REASON_USERS_ROLES, title: 'Scope assignment', viewOrder: 2, value: 5 },
  { id: '100.6.27', parentId: RECORD_CHANGE_REASON_USERS_ROLES, title: 'Access review', viewOrder: 3, value: 27 },
  { id: '100.6.28', parentId: RECORD_CHANGE_REASON_USERS_ROLES, title: 'Temporary access', viewOrder: 4, value: 28 },
  { id: '100.6.29', parentId: RECORD_CHANGE_REASON_USERS_ROLES, title: 'Job change', viewOrder: 5, value: 29 },
  { id: '100.6.30', parentId: RECORD_CHANGE_REASON_USERS_ROLES, title: 'Least privilege', viewOrder: 6, value: 30 },
  { id: '100.6.9', parentId: RECORD_CHANGE_REASON_USERS_LIFECYCLE, title: 'Onboarding', viewOrder: 1, value: 9 },
  { id: '100.6.10', parentId: RECORD_CHANGE_REASON_USERS_LIFECYCLE, title: 'Offboarding', viewOrder: 2, value: 10 },
  { id: '100.6.31', parentId: RECORD_CHANGE_REASON_USERS_LIFECYCLE, title: 'Hire', viewOrder: 3, value: 31 },
  { id: '100.6.32', parentId: RECORD_CHANGE_REASON_USERS_LIFECYCLE, title: 'Transfer', viewOrder: 4, value: 32 },
  { id: '100.6.33', parentId: RECORD_CHANGE_REASON_USERS_LIFECYCLE, title: 'Contractor ended', viewOrder: 5, value: 33 },
  { id: '100.6.34', parentId: RECORD_CHANGE_REASON_USERS_LIFECYCLE, title: 'Identity verified', viewOrder: 6, value: 34 },
  { id: '100.6.36', parentId: RECORD_CHANGE_REASON_SAMPLE_MOCK, title: 'Status change', viewOrder: 1, value: 36 },
  { id: '100.6.37', parentId: RECORD_CHANGE_REASON_SAMPLE_MOCK, title: 'Approval', viewOrder: 2, value: 37 },
  { id: '100.6.38', parentId: RECORD_CHANGE_REASON_SAMPLE_MOCK, title: 'Record update', viewOrder: 3, value: 38 },
];

const FOLDER_IDS = new Set(RECORD_CHANGE_REASON_FOLDER_OPTIONS.map((item) => item.id));
FOLDER_IDS.add(RECORD_CHANGE_REASON_VOCAB_ROOT);

export const RECORD_CHANGE_REASON_LEAVES: readonly ChangeReasonSeedRow[] = RECORD_CHANGE_REASON_SEED_ROWS.filter(
  (row) => !FOLDER_IDS.has(row.id),
);

export const resolveReasonVocabNodeId = (nodeId?: string | null): string => {
  const trimmed = nodeId?.trim() || RECORD_CHANGE_REASON_GENERAL;
  if (trimmed === RECORD_CHANGE_REASON_VOCAB_ROOT) {
    return RECORD_CHANGE_REASON_GENERAL;
  }
  return trimmed;
};

/** True when the API already owns a situation folder (not General / root / empty). */
export const hasAssignedReasonFolder = (nodeId?: string | null): boolean => {
  const trimmed = nodeId?.trim() ?? '';
  if (!trimmed) return false;
  if (trimmed === RECORD_CHANGE_REASON_GENERAL) return false;
  if (trimmed === RECORD_CHANGE_REASON_VOCAB_ROOT) return false;
  return true;
};

export const reasonIncludeGeneralEnabled = (value?: boolean | null): boolean => value !== false;

export const catalogLabelForReasonCode = (code?: string | null): string | null => {
  const trimmed = code?.trim();
  if (!trimmed) return null;
  return RECORD_CHANGE_REASON_LEAVES.find((leaf) => leaf.id === trimmed)?.title ?? null;
};

export const catalogLeavesForReasonVocab = (nodeId?: string | null): ChangeReasonSelectOption[] => {
  const resolved = resolveReasonVocabNodeId(nodeId);
  return RECORD_CHANGE_REASON_LEAVES
    .filter((leaf) => leaf.parentId === resolved)
    .slice()
    .sort((left, right) => left.viewOrder - right.viewOrder || left.id.localeCompare(right.id))
    .map((leaf) => ({ id: leaf.id, label: leaf.title }));
};

export const withSelectedChangeReasonCode = (
  options: readonly ChangeReasonSelectOption[],
  code?: string | null,
): ChangeReasonSelectOption[] => {
  const labeled = options.map((item) => ({
    id: item.id,
    label: catalogLabelForReasonCode(item.id) ?? item.label,
  }));
  const trimmed = code?.trim();
  if (!trimmed) return labeled;
  if (labeled.some((item) => item.id === trimmed)) return labeled;
  return [{ id: trimmed, label: catalogLabelForReasonCode(trimmed) ?? trimmed }, ...labeled];
};

export const catalogAllowedReasonCodes = (
  nodeId?: string | null,
  includeGeneral?: boolean,
): string[] => {
  const resolved = resolveReasonVocabNodeId(nodeId);
  const ids = catalogLeavesForReasonVocab(resolved).map((item) => item.id);
  if (reasonIncludeGeneralEnabled(includeGeneral) && resolved !== RECORD_CHANGE_REASON_GENERAL) {
    for (const item of catalogLeavesForReasonVocab(RECORD_CHANGE_REASON_GENERAL)) {
      ids.push(item.id);
    }
  }
  return ids;
};

export const toChangeReasonSelectOptions = (
  rows: ReadonlyArray<{
    id: string;
    label?: string | null;
    title?: string | null;
    title_en?: string | null;
    has_children?: boolean;
  }>,
  parentId: string,
): ChangeReasonSelectOption[] => (
  rows
    .filter((row) => row.id !== parentId && row.has_children !== true && !FOLDER_IDS.has(row.id))
    .map((row) => ({
      id: row.id,
      label: (row.label || row.title_en || row.title || row.id).trim() || row.id,
    }))
);

export const unionChangeReasonSelectOptions = (
  catalog: readonly ChangeReasonSelectOption[],
  extra: readonly ChangeReasonSelectOption[],
): ChangeReasonSelectOption[] => {
  const seen = new Set<string>();
  const out: ChangeReasonSelectOption[] = [];
  for (const item of [...catalog, ...extra]) {
    if (!item.id || seen.has(item.id) || FOLDER_IDS.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
};

export const mergeChangeReasonSelectOptions = (
  situational: readonly ChangeReasonSelectOption[],
  general: readonly ChangeReasonSelectOption[],
  includeGeneral: boolean,
  vocabNodeId?: string | null,
): ChangeReasonSelectOption[] => {
  const resolved = resolveReasonVocabNodeId(vocabNodeId);
  const seen = new Set<string>();
  const out: ChangeReasonSelectOption[] = [];
  const push = (items: readonly ChangeReasonSelectOption[]) => {
    for (const item of items) {
      if (!item.id || seen.has(item.id) || FOLDER_IDS.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
  };
  if (resolved === RECORD_CHANGE_REASON_GENERAL) {
    push(situational.length > 0 ? situational : general);
    return out;
  }
  push(situational);
  if (includeGeneral) {
    push(general);
  }
  return out;
};

/** Shared situation folders for related platform APIs (lock/unlock/locked share one folder). */
export const RECORD_CHANGE_REASON_FAMILIES = {
  usersLock: {
    folderId: RECORD_CHANGE_REASON_USERS_LOCK,
    routes: [
      'PATCH /api/users/:id/lock',
      'PATCH /api/users/:id/unlock',
      'PATCH /api/users/:id/locked',
    ],
  },
  usersRoles: {
    folderId: RECORD_CHANGE_REASON_USERS_ROLES,
    routes: ['PUT /api/users/:id/roles'],
  },
  usersLifecycle: {
    folderId: RECORD_CHANGE_REASON_USERS_LIFECYCLE,
    routes: [
      'PUT /api/users/:id',
      'PUT /api/users/:id/profile',
      'PUT /api/profile',
      'PUT /api/profile/me',
      'PUT /api/profile/me/editable-fields',
      'DELETE /api/users/:id',
    ],
  },
  sampleMock: {
    folderId: RECORD_CHANGE_REASON_SAMPLE_MOCK,
    routes: [
      'PATCH /api/sample-mock/records/:id',
      'PATCH /api/sample-mock/records/:id/approve',
      'PATCH /api/sample-mock/records/:id/lock',
      'DELETE /api/sample-mock/records/:id',
    ],
  },
} as const;

export const familyFolderIdForRoute = (method: string, path: string): string | undefined => {
  const withoutQuery = path.split('?')[0]?.trim() || '/';
  const normalized = withoutQuery.length > 1 && withoutQuery.endsWith('/')
    ? withoutQuery.slice(0, -1)
    : withoutQuery;
  const key = `${method.toUpperCase()} ${normalized}`;
  for (const family of Object.values(RECORD_CHANGE_REASON_FAMILIES)) {
    if ((family.routes as readonly string[]).includes(key)) {
      return family.folderId;
    }
  }
  return undefined;
};
