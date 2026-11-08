import React from 'react';
import {
  DirectionalText,
  ListPageShell,
} from '../../../shared/ui';
import { resolveFeedbackSubjectLabel } from '../feedbackSubjectLabel';
import type { MyFeedbackPageModel } from '../hooks/useMyFeedbackPage';
import { FeedbackThreadPanel } from './FeedbackThreadPanel';
import { MyFeedbackTableGrid } from './MyFeedbackTableGrid';
import { MyFeedbackToolbar } from './MyFeedbackToolbar';

const STATUS_LABEL_KEYS: Record<string, string> = {
  NEW: 'feedback.status.new',
  TRIAGED: 'feedback.status.triaged',
  IN_PROGRESS: 'feedback.status.inProgress',
  RESOLVED: 'feedback.status.resolved',
  WONT_FIX: 'feedback.status.wontFix',
  DUPLICATE: 'feedback.status.duplicate',
};

type MyFeedbackPageViewProps = {
  page: MyFeedbackPageModel;
};

export const MyFeedbackPageView: React.FC<MyFeedbackPageViewProps> = ({ page }) => (
  <ListPageShell onGridScroll={page.onGridScroll}>
    <MyFeedbackToolbar page={page} />
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col border-e border-slate-200">
        <MyFeedbackTableGrid page={page} columns={page.gridColumns} />
      </div>

      <div className="flex w-[28rem] shrink-0 flex-col p-3">
        {!page.selected ? (
          <p className="text-xs text-slate-500">{page.t('feedback.inbox.selectTicket')}</p>
        ) : (
          <>
            <div className="mb-3 w-full space-y-1 border-b border-slate-200 pb-3">
              <DirectionalText
                as="h2"
                text={page.selected.title}
                className="text-sm font-semibold text-slate-900"
              />
              <p className="text-xs text-slate-500">
                {page.t(STATUS_LABEL_KEYS[page.selected.status] ?? 'feedback.status.new')}
                {page.selected.subjectId
                  ? ` · ${resolveFeedbackSubjectLabel(page.t, page.selected.subjectId, page.selected.subjectLabel)}`
                  : ''}
              </p>
              {page.detailError ? <p className="text-xs text-rose-600">{page.detailError}</p> : null}
            </div>
            <FeedbackThreadPanel
              ticket={page.selected}
              mode="mine"
              allowInternalNotes={false}
              onUpdated={page.setSelected}
            />
          </>
        )}
      </div>
    </div>
  </ListPageShell>
);
