import { apiFetch } from '../../../shared/api/authSession';

export type UserNotificationPreference = {
  id: number;
  userId: number;
  eventType: string;
  channel: 'IN_APP' | 'EMAIL';
  digest: boolean;
  createdAt: string;
  updatedAt: string;
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(`/api/notifications${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || body.success === false) {
    throw new Error(typeof body.error === 'string' ? body.error : 'Notification preference request failed.');
  }
  return body as T;
}

/** HWF-4.2 — self-service per-event-type channel preference; no row for an eventType means the untouched IN_APP/immediate default. */
export const notificationPreferencesApi = {
  list: () => call<{ preferences: UserNotificationPreference[] }>('/preferences'),
  upsert: (eventType: string, channel: 'IN_APP' | 'EMAIL', digest: boolean) =>
    call<{ preference: UserNotificationPreference }>('/preferences', { method: 'PUT', body: JSON.stringify({ eventType, channel, digest }) }),
  remove: (eventType: string) => call<{ success: true }>(`/preferences/${encodeURIComponent(eventType)}`, { method: 'DELETE' }),
};
