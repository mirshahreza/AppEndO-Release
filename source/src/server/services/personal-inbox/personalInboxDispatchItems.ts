import type { PersonalInboxItem } from '../../../shared/api/contracts/personal-inbox/types';
import { studioRouteRemainderFromHref } from '../../../shared/lib/studioRelativeHref';
import {
  getUserMessageDispatchById,
  listUserMessageDispatches,
  type UserMessageDispatchRecord,
} from '../notifications/userMessageDispatch.service';
import { filterPersonalInboxItemsForFolderScope } from './personalInboxItemActions.service';
import type { PersonalInboxFolderListScope } from './personalInboxFolderFilters';
import { attachFolderRefsToItems } from './personalInboxFolderFilters';
import { personalInboxFolderRepository } from '../../domain/personal-inbox/personalInboxFolder.repository';

export const mapDispatchRowToPersonalInboxItem = (row: UserMessageDispatchRecord): PersonalInboxItem => {
  const hrefRemainder = row.href ? studioRouteRemainderFromHref(row.href) : null;
  return {
    id: `message_dispatch:${row.id}`,
    kind: 'message_dispatch',
    origin: 'Dispatch',
    originDetail: `${row.channel}|${row.deliveryStatus}`,
    title: row.title,
    summary: row.bodySummary?.trim() ? row.bodySummary : row.eventType,
    surfacedAt: row.deliveredAt ?? row.createdAt,
    attention: 'none',
    href: hrefRemainder ?? `my-inbox?kind=message_dispatch&dispatchId=${row.id}`,
    ref: { type: 'message_dispatch', id: row.id },
  };
};

export async function listPersonalInboxDispatchItems(
  userId: number,
  options?: {
    channel?: string;
    deliveryStatus?: string;
    take?: number;
    folderScope?: PersonalInboxFolderListScope;
  },
): Promise<{ items: PersonalInboxItem[]; total: number; unreadTotal: number; inboxAttentionCount?: number }> {
  const take = Math.min(Math.max(options?.take ?? 50, 1), 100);
  const folderScope = options?.folderScope ?? { scope: 'system', slug: 'inbox' };
  const listOptions = {
    channel: options?.channel,
    deliveryStatus: options?.deliveryStatus,
    take: folderScope.scope === 'system' && folderScope.slug !== 'inbox' ? 100 : take,
  };
  const rows = await listUserMessageDispatches(userId, listOptions);
  let items = rows.map(mapDispatchRowToPersonalInboxItem);
  items = await filterPersonalInboxItemsForFolderScope(userId, items, folderScope);
  const tagIndex = await personalInboxFolderRepository.listTagIndex(userId);
  items = attachFolderRefsToItems(items, tagIndex);
  return { items: items.slice(0, take), total: items.length, unreadTotal: 0 };
}

export async function findPersonalInboxDispatchItem(
  userId: number,
  dispatchId: number,
): Promise<PersonalInboxItem | undefined> {
  const row = await getUserMessageDispatchById(userId, dispatchId);
  if (!row) {
    return undefined;
  }
  const tagIndex = await personalInboxFolderRepository.listTagIndex(userId);
  const [item] = attachFolderRefsToItems([mapDispatchRowToPersonalInboxItem(row)], tagIndex);
  return item;
}
