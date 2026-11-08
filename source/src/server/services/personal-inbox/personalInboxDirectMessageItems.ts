import type { PersonalInboxItem } from '../../../shared/api/contracts/personal-inbox/types';
import {
  countUnreadMessagesForUser,
  listThreadsForUser,
  otherParticipantUserId,
} from '../../domain/direct-messages/directMessage.repository';
import { findUserIdEmailUsername } from '../../domain/users/userRepository';

const threadHref = (threadId: number): string =>
  `my-inbox?kind=direct_message&threadId=${encodeURIComponent(String(threadId))}`;

export async function collectPersonalInboxDirectMessageItems(userId: number): Promise<PersonalInboxItem[]> {
  const threads = await listThreadsForUser(userId, 120);
  const items: PersonalInboxItem[] = [];
  for (const thread of threads) {
    if (!thread.lastMessageAt) {
      continue;
    }
    const counterpartId = otherParticipantUserId(thread, userId);
    const counterpart = await findUserIdEmailUsername(counterpartId);
    const unread = await countUnreadMessagesForUser(thread.id, userId);
    const title = counterpart?.username ?? `User #${counterpartId}`;
    items.push({
      id: `direct_message:${thread.id}`,
      kind: 'direct_message',
      origin: 'Message',
      originDetail: title,
      title,
      summary: thread.lastMessagePreview,
      surfacedAt: thread.lastMessageAt.toISOString(),
      attention: unread > 0 ? 'unread' : 'none',
      href: threadHref(thread.id),
      ref: { type: 'direct_message', id: thread.id },
      attachmentCount: 0,
    });
  }
  return items;
}
