/** System folder tags stored on items (`system:archived`, `system:deleted`). */
export const PERSONAL_INBOX_SYSTEM_FOLDER_ARCHIVED = 'system:archived';
export const PERSONAL_INBOX_SYSTEM_FOLDER_DELETED = 'system:deleted';
/** User permanently removed the row from inbox surfaces (not shown in any folder). */
export const PERSONAL_INBOX_SYSTEM_FOLDER_PURGED = 'system:purged';

export const PERSONAL_INBOX_SYSTEM_FOLDER_TAG_REFS = [
  PERSONAL_INBOX_SYSTEM_FOLDER_ARCHIVED,
  PERSONAL_INBOX_SYSTEM_FOLDER_DELETED,
  PERSONAL_INBOX_SYSTEM_FOLDER_PURGED,
] as const;

export type PersonalInboxSystemFolderSlug = 'inbox' | 'archived' | 'deleted' | 'all';

export const encodePersonalInboxUserFolderRef = (folderId: number): string => `user:${folderId}`;

export const parsePersonalInboxFolderRef = (
  ref: string,
): { kind: 'system'; slug: 'archived' | 'deleted' } | { kind: 'user'; folderId: number } | null => {
  const trimmed = ref.trim();
  if (trimmed === PERSONAL_INBOX_SYSTEM_FOLDER_ARCHIVED) {
    return { kind: 'system', slug: 'archived' };
  }
  if (trimmed === PERSONAL_INBOX_SYSTEM_FOLDER_DELETED) {
    return { kind: 'system', slug: 'deleted' };
  }
  if (trimmed.startsWith('user:')) {
    const id = Number(trimmed.slice(5));
    if (Number.isInteger(id) && id > 0) {
      return { kind: 'user', folderId: id };
    }
  }
  return null;
};

/** URL / API folder filter token. */
export type PersonalInboxFolderFilterToken =
  | PersonalInboxSystemFolderSlug
  | `u:${number}`;

export const parsePersonalInboxFolderFilterToken = (
  raw: string | undefined | null,
): { scope: 'system'; slug: PersonalInboxSystemFolderSlug } | { scope: 'user'; folderId: number } => {
  const value = raw?.trim().toLowerCase() ?? '';
  if (value === 'archived' || value === 'deleted' || value === 'all') {
    return { scope: 'system', slug: value };
  }
  if (value.startsWith('u:')) {
    const folderId = Number(value.slice(2));
    if (Number.isInteger(folderId) && folderId > 0) {
      return { scope: 'user', folderId };
    }
  }
  return { scope: 'system', slug: 'inbox' };
};

export const serializePersonalInboxFolderFilterToken = (
  filter: { scope: 'system'; slug: PersonalInboxSystemFolderSlug } | { scope: 'user'; folderId: number },
): string => {
  if (filter.scope === 'user') {
    return `u:${filter.folderId}`;
  }
  return filter.slug === 'inbox' ? '' : filter.slug;
};

export const itemHasInboxPurgedFolderTag = (folderRefs: ReadonlySet<string> | readonly string[]): boolean => {
  const set = folderRefs instanceof Set ? folderRefs : new Set(folderRefs);
  return set.has(PERSONAL_INBOX_SYSTEM_FOLDER_PURGED);
};

export const itemHasInboxHideFolderTag = (folderRefs: ReadonlySet<string> | readonly string[]): boolean => {
  const set = folderRefs instanceof Set ? folderRefs : new Set(folderRefs);
  return set.has(PERSONAL_INBOX_SYSTEM_FOLDER_ARCHIVED)
    || set.has(PERSONAL_INBOX_SYSTEM_FOLDER_DELETED)
    || set.has(PERSONAL_INBOX_SYSTEM_FOLDER_PURGED);
};

export const itemHasInboxSoftDeletedFolderTag = (folderRefs: ReadonlySet<string> | readonly string[]): boolean => {
  const set = folderRefs instanceof Set ? folderRefs : new Set(folderRefs);
  return set.has(PERSONAL_INBOX_SYSTEM_FOLDER_DELETED);
};
