import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../client';
import type {
  InAppNotificationAdminDetailResponse,
  InAppNotificationAdminListQuery,
  InAppNotificationAdminListResult,
  InAppNotificationAdminRow,
} from '../contracts/notifications/inAppNotificationsAdmin';
import { RECORDS_LIST_QUERY_OPTIONS } from './recordsListQueryOptions';

export const adminInAppNotificationsQueryKeys = {
  all: ['admin-in-app-notifications'] as const,
  list: (query: InAppNotificationAdminListQuery) => [
    ...adminInAppNotificationsQueryKeys.all,
    'list',
    query.search?.trim() || '',
    query.userId ?? '',
    query.unreadOnly ? 'unread' : 'all',
    query.source?.trim() || '',
    query.page ?? 1,
    query.pageSize ?? 25,
  ] as const,
  detail: (id: number) => [...adminInAppNotificationsQueryKeys.all, 'detail', id] as const,
};

const getLoadErrorMessage = (data: unknown, fallback: string): string => {
  if (!data || typeof data !== 'object') {
    return fallback;
  }
  const payload = data as { error?: string };
  return typeof payload.error === 'string' && payload.error.trim() ? payload.error : fallback;
};

const appendListParams = (params: URLSearchParams, query: InAppNotificationAdminListQuery): void => {
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.userId !== undefined) params.set('userId', String(query.userId));
  if (query.unreadOnly) params.set('unreadOnly', 'true');
  if (query.source?.trim()) params.set('source', query.source.trim());
  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize));
};

export type AdminInAppNotificationListResult = {
  items: InAppNotificationAdminRow[];
  totalCount: number;
  page: number;
  pageSize: number;
};

export async function fetchAdminInAppNotifications(
  query: InAppNotificationAdminListQuery,
  signal?: AbortSignal,
): Promise<AdminInAppNotificationListResult> {
  const params = new URLSearchParams();
  appendListParams(params, query);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const { data, response } = await apiGet<InAppNotificationAdminListResult>(
    `/api/notifications/admin${suffix}`,
    { signal },
  );
  if (!response.ok || !data?.success) {
    throw new Error(getLoadErrorMessage(data, 'Failed to load in-app notifications.'));
  }
  return {
    items: data.items ?? [],
    totalCount: data.totalCount ?? 0,
    page: data.page ?? 1,
    pageSize: data.pageSize ?? 25,
  };
}

export async function fetchAdminInAppNotification(
  id: number,
  signal?: AbortSignal,
): Promise<InAppNotificationAdminRow> {
  const { data, response } = await apiGet<InAppNotificationAdminDetailResponse>(
    `/api/notifications/admin/${id}`,
    { signal },
  );
  if (!response.ok || !data?.success || !data.item) {
    throw new Error(getLoadErrorMessage(data, 'Failed to load in-app notification.'));
  }
  return data.item;
}

export function useAdminInAppNotificationsQuery(query: InAppNotificationAdminListQuery, enabled = true) {
  return useQuery({
    queryKey: adminInAppNotificationsQueryKeys.list(query),
    queryFn: ({ signal }) => fetchAdminInAppNotifications(query, signal),
    enabled,
    ...RECORDS_LIST_QUERY_OPTIONS,
  });
}

export function useAdminInAppNotificationQuery(notificationId: number | null, enabled = true) {
  const hasId = notificationId !== null && Number.isInteger(notificationId) && notificationId > 0;
  const normalizedId = hasId ? notificationId : 0;
  return useQuery({
    queryKey: adminInAppNotificationsQueryKeys.detail(normalizedId),
    queryFn: ({ signal }) => fetchAdminInAppNotification(normalizedId, signal),
    enabled: enabled && hasId,
    ...RECORDS_LIST_QUERY_OPTIONS,
  });
}
