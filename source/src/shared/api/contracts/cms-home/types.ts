export type CmsHomeReviewQueueItem = {
  id: string;
  title: string;
  slug: string | null;
  statusCode: string;
  statusLabel: string | null;
  contentTypeCode: string | null;
  updatedAt: string | null;
};

export type CmsHomeReviewQueueResponse = {
  success: true;
  totalCount: number;
  items: CmsHomeReviewQueueItem[];
};
