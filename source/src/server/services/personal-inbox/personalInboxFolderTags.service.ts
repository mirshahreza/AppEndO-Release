import type { AuthRequestContext } from '../../middleware/auth.middleware';
import { personalInboxFolderRepository } from '../../domain/personal-inbox/personalInboxFolder.repository';
import { itemHasInboxHideFolderTag } from '../../../shared/personal-inbox/personalInboxFolderRefs';
import { removePersonalInboxProjectionItem } from './personalInboxProjectionSync';
import { invalidatePersonalInboxProjection } from './personalInboxProjectionInvalidate';

const parseItemKey = (itemKey: string): boolean => {
  const trimmed = itemKey.trim();
  const colon = trimmed.indexOf(':');
  if (colon <= 0) return false;
  const idPart = trimmed.slice(colon + 1);
  const id = Number(idPart);
  return Number.isInteger(id) && id > 0;
};

export async function setPersonalInboxItemFolderRefs(
  auth: AuthRequestContext,
  itemKey: string,
  folderRefs: string[],
): Promise<{ folderRefs: string[] }> {
  if (!parseItemKey(itemKey)) {
    throw new Error('Invalid itemKey.');
  }
  const nextRefs = await personalInboxFolderRepository.setItemFolderRefs(
    auth.userId,
    itemKey,
    folderRefs,
  );
  if (itemHasInboxHideFolderTag(nextRefs)) {
    await removePersonalInboxProjectionItem(auth.userId, itemKey);
  }
  invalidatePersonalInboxProjection(auth.userId);
  return { folderRefs: nextRefs };
}
