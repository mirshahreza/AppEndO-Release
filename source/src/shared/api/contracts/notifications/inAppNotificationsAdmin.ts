export type InAppNotificationAdminRow = {
  id: number;
  userId: number;
  username: string;
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

export type InAppNotificationAdminListQuery = {
  search?: string;
  userId?: number;
  unreadOnly?: boolean;
  source?: string;
  page?: number;
  pageSize?: number;
};

export type InAppNotificationAdminListResult = {
  success: true;
  items: InAppNotificationAdminRow[];
  totalCount: number;
  page: number;
  pageSize: number;
};

export type InAppNotificationAdminDetailResponse = {
  success: true;
  item: InAppNotificationAdminRow;
};
