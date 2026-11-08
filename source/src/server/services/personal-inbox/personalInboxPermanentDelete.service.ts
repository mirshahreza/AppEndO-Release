import type { AuthRequestContext } from '../../middleware/auth.middleware';
import { HttpError } from '../../errors/HttpError';
import { personalInboxFolderRepository } from '../../domain/personal-inbox/personalInboxFolder.repository';
import { personalInboxSeenRepository } from '../../domain/personal-inbox/personalInboxSeen.repository';
import { deleteUserNotification } from '../notifications/userNotification.service';
import { getUserMessageDispatchById } from '../notifications/userMessageDispatch.service';
import { getUserMessageDispatchModel } from '../../domain/user-message-dispatches/userMessageDispatchSequelizeModels';
import {
  canonicalPersonalInboxItemKey,
  parsePersonalInboxItemRef,
} from './personalInboxItemActions.service';
import {
  itemHasInboxSoftDeletedFolderTag,
  PERSONAL_INBOX_SYSTEM_FOLDER_PURGED,
} from '../../../shared/personal-inbox/personalInboxFolderRefs';
import { removePersonalInboxProjectionItem } from './personalInboxProjectionSync';
import { invalidatePersonalInboxProjection } from './personalInboxProjectionInvalidate';

export async function permanentDeletePersonalInboxItem(
  auth: AuthRequestContext,
  itemKey: string,
): Promise<{ deleted: boolean }> {
  const canonicalKey = canonicalPersonalInboxItemKey(itemKey);
  const ref = parsePersonalInboxItemRef(canonicalKey);
  if (!ref) {
    throw new HttpError(400, 'Invalid itemKey.', { success: false, error: 'Invalid itemKey.' });
  }
  if (ref.type === 'work_item') {
    throw new HttpError(
      403,
      'Work items cannot be permanently deleted from inbox.',
      { success: false, error: 'Work items cannot be permanently deleted from inbox.' },
    );
  }

  const folderRefs = await personalInboxFolderRepository.getItemFolderRefs(auth.userId, canonicalKey);
  if (!itemHasInboxSoftDeletedFolderTag(folderRefs)) {
    throw new HttpError(
      400,
      'Move the item to Deleted before permanent removal.',
      { success: false, error: 'Move the item to Deleted before permanent removal.' },
    );
  }

  if (ref.type === 'notification') {
    await deleteUserNotification(auth.userId, ref.id);
  } else if (ref.type === 'message_dispatch') {
    const row = await getUserMessageDispatchById(auth.userId, ref.id);
    if (row) {
      const model = getUserMessageDispatchModel();
      await model.destroy({ where: { id: ref.id, userId: auth.userId } });
    }
  }

  await personalInboxFolderRepository.setItemFolderRefs(
    auth.userId,
    canonicalKey,
    [PERSONAL_INBOX_SYSTEM_FOLDER_PURGED],
  );
  await personalInboxSeenRepository.clearSeen(auth.userId, canonicalKey);
  await removePersonalInboxProjectionItem(auth.userId, canonicalKey);
  invalidatePersonalInboxProjection(auth.userId);

  return { deleted: true };
}
