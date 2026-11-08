import React from 'react';
import {
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  ToolbarActionGroupWithRefresh,
  ToolbarSearchInput,
  UiSelect,
  ListPageToolbarFrame,
} from '../../../shared/ui';
import { ListPageToolbarScrollRoot } from '../../../shared/ui/list-page/listPageToolbarChrome';
import { cn } from '../../../lib/utils';
import { resolveFeedbackSubjectLabel } from '../feedbackSubjectLabel';
import type { MyFeedbackPageModel } from '../hooks/useMyFeedbackPage';

const STATUS_LABEL_KEYS: Record<string, string> = {
  NEW: 'feedback.status.new',
  TRIAGED: 'feedback.status.triaged',
  IN_PROGRESS: 'feedback.status.inProgress',
  RESOLVED: 'feedback.status.resolved',
  WONT_FIX: 'feedback.status.wontFix',
  DUPLICATE: 'feedback.status.duplicate',
};

type MyFeedbackToolbarProps = {
  page: MyFeedbackPageModel;
};

export const MyFeedbackToolbar: React.FC<MyFeedbackToolbarProps> = ({ page }) => (
  <ListPageToolbarFrame>

    <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
      <ToolbarSearchInput
        value={page.searchInput}
        onChange={page.setSearchInput}
        placeholder={page.t('feedback.my.toolbar.searchPlaceholder')}
        ariaLabel={page.t('feedback.my.toolbar.searchPlaceholder')}
      />
      <div className="w-full min-w-0 sm:w-40 sm:shrink-0">
        <UiSelect
          size="sm"
          value={page.statusFilter}
          onChange={(event) => page.setStatusFilter(event.target.value as typeof page.statusFilter)}
          className="w-full"
          ariaLabel={page.t('feedback.my.toolbar.status')}
        >
          <option value="ALL">{page.t('feedback.my.toolbar.statusAll')}</option>
          {page.statusOptions.map((status) => (
            <option key={status} value={status}>
              {page.t(STATUS_LABEL_KEYS[status] ?? 'feedback.status.new')}
            </option>
          ))}
        </UiSelect>
      </div>
      <div className="w-full min-w-0 sm:w-44 sm:shrink-0">
        <UiSelect
          size="sm"
          value={page.subjectFilter}
          onChange={(event) => page.setSubjectFilter(event.target.value)}
          className="w-full"
          ariaLabel={page.t('feedback.my.toolbar.subject')}
        >
          <option value="ALL">{page.t('feedback.my.toolbar.subjectAll')}</option>
          {page.subjectOptions.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {resolveFeedbackSubjectLabel(page.t, subject.id, subject.label)}
            </option>
          ))}
        </UiSelect>
      </div>
      <span className="text-xs font-medium whitespace-nowrap text-slate-500">
        {page.t('feedback.my.toolbar.count')
          .replace('{filtered}', String(page.totalCount))
          .replace('{total}', String(page.totalCount))}
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
