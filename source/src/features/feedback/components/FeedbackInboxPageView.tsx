import React from 'react';
import {
  AppButton,
  DirectionalText,
  ListPageShell,
} from '../../../shared/ui';
import { resolveFeedbackSubjectLabel } from '../feedbackSubjectLabel';
import type { FeedbackInboxPageModel } from '../hooks/useFeedbackInboxPage';
import { FeedbackInboxTableGrid } from './FeedbackInboxTableGrid';
import { FeedbackInboxToolbar } from './FeedbackInboxToolbar';
import { FeedbackThreadPanel } from './FeedbackThreadPanel';

const STATUS_LABEL_KEYS: Record<string, string> = {
  NEW: 'feedback.status.new',
  TRIAGED: 'feedback.status.triaged',
  IN_PROGRESS: 'feedback.status.inProgress',
  RESOLVED: 'feedback.status.resolved',
  WONT_FIX: 'feedback.status.wontFix',
  DUPLICATE: 'feedback.status.duplicate',
};

type FeedbackInboxPageViewProps = {
  page: FeedbackInboxPageModel;
};

export const FeedbackInboxPageView: React.FC<FeedbackInboxPageViewProps> = ({ page }) => (
  <ListPageShell onGridScroll={page.onGridScroll}>
    <FeedbackInboxToolbar page={page} />
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col border-e border-slate-200">
        <FeedbackInboxTableGrid page={page} columns={page.gridColumns} />
      </div>

      <div className="flex w-[28rem] shrink-0 flex-col p-3">
        {page.isOpeningDetail ? (
          <p className="text-xs text-slate-500">{page.t('feedback.inbox.openingTicket')}</p>
        ) : !page.selected ? (
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
                {page.selected.submitterDisplayName ? ` · ${page.selected.submitterDisplayName}` : ''}
                {page.selected.subjectId
                  ? ` · ${resolveFeedbackSubjectLabel(page.t, page.selected.subjectId, page.selected.subjectLabel)}`
                  : ''}
              </p>
              <div className="flex flex-wrap gap-1 pt-2">
                <AppButton type="button" intent="utility" size="sm" disabled={page.busy} onClick={() => void page.claimTicket()}>
                  {page.t('feedback.inbox.claim')}
                </AppButton>
                <AppButton type="button" intent="utility" size="sm" disabled={page.busy} onClick={() => void page.updateStatus('IN_PROGRESS')}>
                  {page.t('feedback.inbox.markInProgress')}
                </AppButton>
                <AppButton type="button" intent="success" size="sm" disabled={page.busy} onClick={() => void page.updateStatus('RESOLVED')}>
                  {page.t('feedback.inbox.resolve')}
                </AppButton>
              </div>
              {page.detailError ? <p className="text-xs text-rose-600">{page.detailError}</p> : null}
            </div>
            <FeedbackThreadPanel
              ticket={page.selected}
              mode="staff"
              allowInternalNotes
              onUpdated={page.setSelected}
            />
          </>
        )}
      </div>
    </div>
  </ListPageShell>
);
