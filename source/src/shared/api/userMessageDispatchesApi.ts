import { apiFetch } from './authSession';

export type UserMessageDispatchItem = {
  id: number;
  userId: number;
  correlationId: string;
  eventType: string;
  channel: string;
  deliveryStatus: string;
  title: string;
  bodySummary: string;
  href: string | null;
  severity: string;
  metadataJson: string | null;
  inAppNotificationId: number | null;
  digestBatchId: string | null;
  deliveredAt: string | null;
  errorSummary: string | null;
  createdAt: string;
};

const call = async <T>(path: string): Promise<T> => {
  const response = await apiFetch(`/api/user-message-dispatches${path}`);
  const payload = await response.json() as { success?: boolean; error?: string } & T;
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error ?? 'Request failed.');
  }
  return payload;
};

export const userMessageDispatchesApi = {
  list: (query?: {
    channel?: string;
    deliveryStatus?: string;
    eventType?: string;
    skip?: number;
    take?: number;
  }) => {
    const params = new URLSearchParams();
    if (query?.channel) params.set('channel', query.channel);
    if (query?.deliveryStatus) params.set('deliveryStatus', query.deliveryStatus);
    if (query?.eventType) params.set('eventType', query.eventType);
    if (query?.skip !== undefined) params.set('skip', String(query.skip));
    if (query?.take !== undefined) params.set('take', String(query.take));
    const qs = params.toString();
    return call<{ items: UserMessageDispatchItem[] }>(qs ? `?${qs}` : '');
  },
  getById: (dispatchId: number) =>
    call<{ item: UserMessageDispatchItem }>(`/${dispatchId}`),
};
