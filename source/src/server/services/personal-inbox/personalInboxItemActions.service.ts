import type { AuthRequestContext } from '../../middleware/auth.middleware';
import type { PersonalInboxItem } from '../../../shared/api/contracts/personal-inbox/types';
import { personalInboxFolderRepository } from '../../domain/personal-inbox/personalInboxFolder.repository';
import { markNotificationRead, markNotificationUnread } from '../notifications/userNotification.service';
import { personalInboxSeenRepository } from '../../domain/personal-inbox/personalInboxSeen.repository';
import type { PersonalInboxAttention } from '../../../shared/api/contracts/personal-inbox/types';
import type { FeedbackService } from '../feedback/feedback.service';
import {
  filterPersonalInboxItemsByFolderScope,
  type PersonalInboxFolderListScope,
} from './personalInboxFolderFilters';
import { patchPersonalInboxProjectionAttention } from './personalInboxProjectionSync';
import {
  markThreadReadForUser,
  markThreadUnreadForUser,
} from '../../domain/direct-messages/directMessage.repository';

export const parsePersonalInboxItemRef = (itemKey: string): PersonalInboxItem['ref'] | null => {
  const trimmed = itemKey.trim();
  const colon = trimmed.indexOf(':');
  if (colon <= 0) return null;
  const typePart = trimmed.slice(0, colon);
  const idPart = trimmed.slice(colon + 1);
  const id = Number(idPart);
  if (!Number.isInteger(id) || id <= 0) return null;
  if (typePart === 'work_item') return { type: 'work_item', id };
  if (typePart === 'feedback') return { type: 'feedback', id };
  if (typePart === 'alert') return { type: 'notification', id };
  if (typePart === 'message_dispatch') return { type: 'message_dispatch', id };
  if (typePart === 'direct_message') return { type: 'direct_message', id };
  return null;
};

/** Stable inbox row key for DB (`feedback:12`, not padded variants). */
export const canonicalPersonalInboxItemKey = (itemKey: string): string => {
  const ref = parsePersonalInboxItemRef(itemKey);
  if (!ref) {
    return itemKey.trim();
  }
  if (ref.type === 'work_item') return `work_item:${ref.id}`;
  if (ref.type === 'feedback') return `feedback:${ref.id}`;
  if (ref.type === 'notification') return `alert:${ref.id}`;
  if (ref.type === 'message_dispatch') return `message_dispatch:${ref.id}`;
  return `direct_message:${ref.id}`;
};

const clearAttentionForRef = async (
  auth: AuthRequestContext,
  ref: PersonalInboxItem['ref'],
  feedbackService: FeedbackService,
): Promise<void> => {
  if (ref.type === 'notification') {
    await markNotificationRead(auth.userId, ref.id);
    await patchPersonalInboxProjectionAttention(auth.userId, `alert:${ref.id}`, 'none');
    return;
  }
  if (ref.type === 'feedback') {
    try {
      await feedbackService.markRead(ref.id, auth);
    } catch {
      // Inbox dismiss is persisted in base_personal_inbox_item_seen (see PersonalInboxService).
    }
    await patchPersonalInboxProjectionAttention(auth.userId, `feedback:${ref.id}`, 'none');
    return;
  }
};

const defaultUnreadAttention = (ref: PersonalInboxItem['ref']): PersonalInboxAttention =>
  (ref.type === 'work_item' ? 'action_required' : 'unread');

export async function markPersonalInboxUnread(
  auth: AuthRequestContext,
  itemKey: string,
  feedbackService: FeedbackService,
): Promise<{ updated: boolean }> {
  const ref = parsePersonalInboxItemRef(itemKey);
  if (!ref || ref.type === 'message_dispatch') {
    return { updated: false };
  }
  if (ref.type === 'direct_message') {
    await markThreadUnreadForUser(ref.id, auth.userId);
    await patchPersonalInboxProjectionAttention(auth.userId, itemKey.trim(), 'unread');
    return { updated: true };
  }
  await personalInboxSeenRepository.clearSeen(
    auth.userId,
    canonicalPersonalInboxItemKey(itemKey),
  );
  const attention = defaultUnreadAttention(ref);
  if (ref.type === 'feedback') {
    try {
      await feedbackService.markUnread(ref.id, auth);
    } catch {
      // Cursor reset may fail; inbox unread still comes from cleared seen + projection.
    }
    await patchPersonalInboxProjectionAttention(
      auth.userId,
      canonicalPersonalInboxItemKey(itemKey),
      'unread',
    );
  } else {
    await patchPersonalInboxProjectionAttention(auth.userId, itemKey.trim(), attention);
    if (ref.type === 'notification') {
      await markNotificationUnread(auth.userId, ref.id);
    }
  }
  return { updated: true };
}

export async function dismissPersonalInboxAttention(
  auth: AuthRequestContext,
  itemKey: string,
  feedbackService: FeedbackService,
): Promise<{ dismissed: boolean }> {
  const ref = parsePersonalInboxItemRef(itemKey);
  if (!ref) {
    return { dismissed: false };
  }
  if (ref.type === 'message_dispatch') {
    return { dismissed: false };
  }
  if (ref.type === 'direct_message') {
    await markThreadReadForUser(ref.id, auth.userId);
    return { dismissed: true };
  }
  if (ref.type === 'work_item') {
    return { dismissed: true };
  }
  await clearAttentionForRef(auth, ref, feedbackService);
  return { dismissed: true };
}

export async function filterPersonalInboxItemsForFolderScope<T extends { id: string }>(
  userId: number,
  items: T[],
  folderScope: PersonalInboxFolderListScope,
): Promise<T[]> {
  const tagIndex = await personalInboxFolderRepository.listTagIndex(userId);
  return filterPersonalInboxItemsByFolderScope(items, tagIndex, folderScope);
}
