import { apiFetch } from '../../../shared/api/authSession';

export type InAppNotificationItem = {
  id: number;
  title: string;
  body: string;
  severity: string;
  href: string | null;
  source: string;
  metadataJson: string | null;
  readAt: string | null;
  seenAt: string | null;
  createdAt: string;
};

export const inAppNotificationsApi = {
  list: async (options?: { unreadOnly?: boolean; take?: number }) => {
    const params = new URLSearchParams();
    if (options?.unreadOnly) params.set('unreadOnly', 'true');
    if (options?.take !== undefined) params.set('take', String(options.take));
    const qs = params.toString();
    const response = await apiFetch(`/api/notifications${qs ? `?${qs}` : ''}`);
    const payload = await response.json() as { success?: boolean; items?: InAppNotificationItem[]; error?: string };
    if (!response.ok || !payload.success) {
      throw new Error(payload.error ?? 'Failed to load notifications.');
    }
    return payload.items ?? [];
  },
  unreadCount: async () => {
    const response = await apiFetch('/api/notifications/unread-count');
    const payload = await response.json() as { success?: boolean; count?: number; error?: string };
    if (!response.ok || !payload.success) {
      throw new Error(payload.error ?? 'Failed to load unread count.');
    }
    return payload.count ?? 0;
  },
  unseenCount: async () => {
    const response = await apiFetch('/api/notifications/unseen-count');
    const payload = await response.json() as { success?: boolean; count?: number; error?: string };
    if (!response.ok || !payload.success) {
      throw new Error(payload.error ?? 'Failed to load unseen count.');
    }
    return payload.count ?? 0;
  },
  markBellSeen: async () => {
    const response = await apiFetch('/api/notifications/bell-seen', { method: 'POST' });
    const payload = await response.json() as { success?: boolean; error?: string };
    if (!response.ok || !payload.success) {
      throw new Error(payload.error ?? 'Failed to mark notifications as seen.');
    }
  },
  markRead: async (notificationId: number) => {
    await apiFetch(`/api/notifications/${notificationId}/read`, { method: 'POST' });
  },
  markAllRead: async () => {
    await apiFetch('/api/notifications/read-all', { method: 'POST' });
  },
};
