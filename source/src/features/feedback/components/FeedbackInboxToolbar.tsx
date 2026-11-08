import React from 'react';
import {
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  ToolbarActionGroupWithRefresh,
  UiSelect,
  ListPageToolbarFrame,
} from '../../../shared/ui';
import type { FeedbackInboxBucket } from '../../../shared/api/contracts/feedback/types';
import type { FeedbackInboxPageModel } from '../hooks/useFeedbackInboxPage';

const BUCKET_LABEL_KEYS: Record<FeedbackInboxBucket, string> = {
  ASSIGNED_TO_ME: 'feedback.inbox.bucket.assignedToMe',
  MY_ROLE_QUEUE: 'feedback.inbox.bucket.myRoleQueue',
  UNASSIGNED: 'feedback.inbox.bucket.unassigned',
  ALL: 'feedback.inbox.bucket.all',
};

type FeedbackInboxToolbarProps = {
  page: FeedbackInboxPageModel;
};

export const FeedbackInboxToolbar: React.FC<FeedbackInboxToolbarProps> = ({ page }) => (
  <ListPageToolbarFrame>
    <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
      <div className="w-full min-w-0 sm:w-52 sm:shrink-0">
        <UiSelect
          size="sm"
          value={page.bucket}
          onChange={(event) => page.setBucket(event.target.value as FeedbackInboxBucket)}
          className="w-full"
          ariaLabel={page.t('feedback.inbox.toolbar.bucket')}
        >
          {page.bucketOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {page.t(BUCKET_LABEL_KEYS[option.value])}
            </option>
          ))}
        </UiSelect>
      </div>
      <span className="text-xs font-medium whitespace-nowrap text-slate-500">
        {page.t('feedback.inbox.toolbar.count').replace('{count}', String(page.totalCount))}
      </span>
    </div>
    <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
      <ToolbarActionGroupWithRefresh
        onRefresh={page.refresh}
        isRefreshing={page.isRefreshing && !page.isLoading}
        actions={[]}
      />
    </div>
  </ListPageToolbarFrame>
);
