import type { AuthRequestContext } from '../../middleware/auth.middleware';
import { listWorkItemInbox } from '../../domain/workflow/engine/workItemInboxService';
import { listUserNotifications } from '../notifications/userNotification.service';
import type { PersonalInboxItem } from '../../../shared/api/contracts/personal-inbox/types';
import { studioRouteRemainderFromHref } from '../../../shared/lib/studioRelativeHref';
import type { FeedbackService } from '../feedback/feedback.service';
import type { FeedbackTicketDto } from '../../../shared/api/contracts/feedback/types';
import { buildPersonalInboxFeedbackFocusHref } from '../../../shared/lib/personalInboxFeedbackDeepLink';
import { filterPersonalInboxItemsForFolderScope } from './personalInboxItemActions.service';
import { collectPersonalInboxDirectMessageItems } from './personalInboxDirectMessageItems';
import { personalInboxSeenRepository } from '../../domain/personal-inbox/personalInboxSeen.repository';
import type { PersonalInboxAttention } from '../../../shared/api/contracts/personal-inbox/types';

const workItemHref = (workItemId: number): string =>
  `my-inbox?workItemId=${encodeURIComponent(String(workItemId))}`;

const parseMetadataIds = (metadataJson: string | null): { workItemId?: number; feedbackId?: number } => {
  if (!metadataJson?.trim()) return {};
  try {
    const parsed = JSON.parse(metadataJson) as { workItemId?: unknown; feedbackId?: unknown };
    const workItemId = typeof parsed.workItemId === 'number' ? parsed.workItemId : undefined;
    const feedbackId = typeof parsed.feedbackId === 'number' ? parsed.feedbackId : undefined;
    return { workItemId, feedbackId };
  } catch {
    return {};
  }
};

const toIso = (value: string | null | undefined): string => {
  if (!value) return new Date(0).toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
};

const applySeenAttention = (
  itemKey: string,
  attention: PersonalInboxAttention,
  seenKeys: Set<string>,
): PersonalInboxAttention => (
  seenKeys.has(itemKey.trim()) ? 'none' : attention
);

/** Inbox list flag for feedback: `base_personal_inbox_item_seen` + thread unread (see user-message-inbox.md). */
export const resolveFeedbackInboxAttention = (
  itemKey: string,
  ticket: { unreadCount: number; messageCount: number },
  seenKeys: Set<string>,
): PersonalInboxAttention => {
  const key = itemKey.trim();
  if (seenKeys.has(key)) {
    return 'none';
  }
  if (ticket.unreadCount > 0) {
    return 'unread';
  }
  if (ticket.messageCount > 0) {
    return 'unread';
  }
  return 'none';
};

const mapWorkItem = (
  item: {
    id: number;
    workItemType: string;
    titleText: string;
    summaryText: string | null;
    status: string;
    createdAt: string | null;
  },
  seenKeys: Set<string>,
): PersonalInboxItem => {
  const id = `work_item:${item.id}`;
  return {
    id,
    kind: 'work_item',
    origin: 'Workflow',
    originDetail: item.workItemType,
    title: item.titleText,
    summary: item.summaryText,
    surfacedAt: toIso(item.createdAt),
    attention: applySeenAttention(id, 'action_required', seenKeys),
    href: workItemHref(item.id),
    ref: { type: 'work_item', id: item.id },
  };
};

const feedbackHref = (ticket: FeedbackTicketDto, auth: AuthRequestContext): string => {
  const ticketId = Number(ticket.id);
  const isSubmitter = ticket.submitterUserId === auth.userId;
  return buildPersonalInboxFeedbackFocusHref(ticketId, isSubmitter ? 'mine' : 'staff');
};

const feedbackOriginDetail = (ticket: FeedbackTicketDto, auth: AuthRequestContext): string => {
  if (ticket.submitterUserId === auth.userId) return 'My submission';
  if (ticket.assigneeUserId === auth.userId) return 'Assigned to me';
  if (ticket.assigneeRoleName) return `Role: ${ticket.assigneeRoleName}`;
  return 'Feedback';
};

const mapFeedback = (
  ticket: FeedbackTicketDto,
  auth: AuthRequestContext,
  seenKeys: Set<string>,
): PersonalInboxItem => {
  const id = `feedback:${Number(ticket.id)}`;
  const attention = resolveFeedbackInboxAttention(id, ticket, seenKeys);
  return {
    id,
    kind: 'feedback',
    origin: 'Feedback',
    originDetail: feedbackOriginDetail(ticket, auth),
    title: ticket.title,
    summary: ticket.lastMessagePreview ?? null,
    surfacedAt: toIso(ticket.lastMessageAt ?? ticket.updatedAt ?? ticket.submittedAt),
    attention,
    href: feedbackHref(ticket, auth),
    ref: { type: 'feedback', id: Number(ticket.id) },
  };
};

const mapAlert = (row: {
  id: number;
  title: string;
  body: string;
  href: string | null;
  source: string;
  metadataJson: string | null;
  readAt: string | null;
  createdAt: string;
}): PersonalInboxItem => ({
  id: `alert:${row.id}`,
  kind: 'alert',
  origin: 'Alert',
  originDetail: row.source,
  title: row.title,
  summary: row.body,
  surfacedAt: row.createdAt,
  attention: row.readAt ? 'none' : 'unread',
  href: (() => {
    const remainder = studioRouteRemainderFromHref(row.href);
    if (remainder) return remainder;
    if (row.href?.trim()) return row.href.replace(/^\/+/, '');
    return 'my-inbox';
  })(),
  ref: { type: 'notification', id: row.id },
});

const sortItems = (items: PersonalInboxItem[]): PersonalInboxItem[] =>
  [...items].sort((a, b) => Date.parse(b.surfacedAt) - Date.parse(a.surfacedAt));

const filterAlertsByEntityOverlap = (
  notifications: PersonalInboxItem[],
  workItemIds: Set<number>,
  feedbackIds: Set<number>,
  rawMetadata: Map<number, string | null>,
): PersonalInboxItem[] =>
  notifications.filter((item) => {
    if (item.ref.type !== 'notification') return true;
    const meta = parseMetadataIds(rawMetadata.get(item.ref.id) ?? null);
    if (meta.workItemId != null && workItemIds.has(meta.workItemId)) {
      return false;
    }
    if (meta.feedbackId != null && feedbackIds.has(meta.feedbackId)) {
      return false;
    }
    return true;
  });

/** Phase A read-time union — includes archived rows (for archived-only list views). */
export async function collectPersonalInboxItemsUnfiltered(
  auth: AuthRequestContext,
  feedbackService: FeedbackService,
): Promise<PersonalInboxItem[]> {
  const actor = { userId: auth.userId, roles: auth.roles ?? [] };
  const seenKeys = await personalInboxSeenRepository.listSeenItemKeys(auth.userId);

  const [assigned, claimed, claimable, notifications, directMessages] = await Promise.all([
    listWorkItemInbox('MINE_ASSIGNED', actor),
    listWorkItemInbox('MINE_CLAIMED', actor),
    listWorkItemInbox('AVAILABLE_TO_CLAIM', actor),
    listUserNotifications(auth.userId, { take: 40 }),
    collectPersonalInboxDirectMessageItems(auth.userId),
  ]);

  const workItemById = new Map<number, PersonalInboxItem>();
  for (const wi of [...assigned, ...claimed, ...claimable]) {
    workItemById.set(wi.id, mapWorkItem(wi, seenKeys));
  }
  const workItemIds = new Set(workItemById.keys());

  const feedbackById = new Map<string, PersonalInboxItem>();
  const mine = await feedbackService.listMine(auth, { page: 1, pageSize: 40 });
  for (const ticket of mine.items) {
    feedbackById.set(ticket.id, mapFeedback(ticket, auth, seenKeys));
  }

  const staffBuckets = ['ASSIGNED_TO_ME', 'MY_ROLE_QUEUE'] as const;
  for (const bucket of staffBuckets) {
    try {
      const result = await feedbackService.listAdmin(auth, bucket, 40);
      for (const ticket of result.items) {
        feedbackById.set(ticket.id, mapFeedback(ticket, auth, seenKeys));
      }
    } catch {
      // Bucket not allowed for this actor — skip.
    }
  }
  const feedbackItems = [...feedbackById.values()];
  const feedbackIds = new Set(
    feedbackItems.map((item) => (item.ref.type === 'feedback' ? item.ref.id : 0)).filter((id) => id > 0),
  );

  const metadataByNotificationId = new Map<number, string | null>();
  const alertCandidates = notifications.map((row) => {
    metadataByNotificationId.set(row.id, row.metadataJson);
    return mapAlert(row);
  });
  const alerts = filterAlertsByEntityOverlap(
    alertCandidates,
    workItemIds,
    feedbackIds,
    metadataByNotificationId,
  );

  return sortItems([...workItemById.values(), ...feedbackItems, ...alerts, ...directMessages]);
}

/** Phase A read-time union — source for projection refresh (Phase B). */
export async function collectPersonalInboxItems(
  auth: AuthRequestContext,
  feedbackService: FeedbackService,
): Promise<PersonalInboxItem[]> {
  const merged = await collectPersonalInboxItemsUnfiltered(auth, feedbackService);
  return filterPersonalInboxItemsForFolderScope(auth.userId, merged, { scope: 'system', slug: 'inbox' });
}
