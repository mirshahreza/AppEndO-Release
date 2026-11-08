import type { PersonalInboxItem } from '../../../shared/api/contracts/personal-inbox/types';
import {
  encodePersonalInboxUserFolderRef,
  itemHasInboxHideFolderTag,
  itemHasInboxPurgedFolderTag,
  PERSONAL_INBOX_SYSTEM_FOLDER_ARCHIVED,
  PERSONAL_INBOX_SYSTEM_FOLDER_DELETED,
  type PersonalInboxSystemFolderSlug,
} from '../../../shared/personal-inbox/personalInboxFolderRefs';

export type PersonalInboxFolderListScope =
  | { scope: 'system'; slug: PersonalInboxSystemFolderSlug }
  | { scope: 'user'; folderId: number };

export const filterPersonalInboxItemsByFolderScope = <T extends { id: string }>(
  items: T[],
  tagIndex: Map<string, Set<string>>,
  folderScope: PersonalInboxFolderListScope,
): T[] => {
  const visible = items.filter((item) => {
    const tags = tagIndex.get(item.id);
    if (!tags || tags.size === 0) {
      return true;
    }
    return !itemHasInboxPurgedFolderTag(tags);
  });
  if (folderScope.scope === 'system' && folderScope.slug === 'all') {
    return visible;
  }
  if (folderScope.scope === 'system' && folderScope.slug === 'inbox') {
    return visible.filter((item) => {
      const tags = tagIndex.get(item.id);
      if (!tags || tags.size === 0) {
        return true;
      }
      return !itemHasInboxHideFolderTag(tags);
    });
  }
  if (folderScope.scope === 'system' && folderScope.slug === 'archived') {
    return visible.filter((item) => tagIndex.get(item.id)?.has(PERSONAL_INBOX_SYSTEM_FOLDER_ARCHIVED));
  }
  if (folderScope.scope === 'system' && folderScope.slug === 'deleted') {
    return visible.filter((item) => tagIndex.get(item.id)?.has(PERSONAL_INBOX_SYSTEM_FOLDER_DELETED));
  }
  if (folderScope.scope === 'user') {
    const ref = encodePersonalInboxUserFolderRef(folderScope.folderId);
    return visible.filter((item) => tagIndex.get(item.id)?.has(ref));
  }
  return visible;
};

export const attachFolderRefsToItems = (
  items: PersonalInboxItem[],
  tagIndex: Map<string, Set<string>>,
): PersonalInboxItem[] =>
  items.map((item) => ({
    ...item,
    folderRefs: [...(tagIndex.get(item.id) ?? [])],
  }));

export const shouldHideFromInboxSummary = (folderRefs: ReadonlySet<string> | readonly string[]): boolean =>
  itemHasInboxHideFolderTag(folderRefs);
