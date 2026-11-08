import React from 'react';
import { Download, GitCommitHorizontal, RefreshCw, Upload } from 'lucide-react';
import {
  AppButton,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  ToolbarActionGroupWithRefresh,
  ListPageToolbarFrame,
} from '../../../shared/ui';
import { ListPageToolbarScrollRoot } from '../../../shared/ui/list-page/listPageToolbarChrome';
import { PAGE_GUIDE_EN } from '../../../core/culture/translations/pageGuideEn';
import { pageGuideLocalProps } from '../../../shared/ui/shell/pageGuide/pageGuideChrome';
import { cn } from '../../../lib/utils';
import type { GitPageModel } from '../hooks/useGitPage';
import { GitBranchDropdown } from './GitBranchDropdown';

type GitToolbarProps = {
  page: GitPageModel;
};

const statusToneClass = (statusLabel: string): string => {
  if (statusLabel === 'Error') {
    return 'text-rose-700 bg-rose-50 border-rose-200';
  }
  if (statusLabel === 'Disabled' || statusLabel === 'No local repository') {
    return 'text-amber-700 bg-amber-50 border-amber-200';
  }
  return 'text-slate-600 bg-slate-50 border-slate-200';
};

export const GitToolbar: React.FC<GitToolbarProps> = ({ page }) => {
  const remoteActionDisabled = page.isSyncActionPending || !page.canRunRemoteActions;
  const stagedCount = page.sectionCounts.staged;
  const { unstaged, untracked } = page.sectionCounts;
  const hasUncommittedChanges = stagedCount + unstaged + untracked > 0;
  const ahead = page.changesQuery.data?.ahead ?? 0;
  const syncDisabled = remoteActionDisabled || hasUncommittedChanges;
  const pushDisabled = remoteActionDisabled || hasUncommittedChanges || ahead === 0;
  const showStatusBadge = page.statusQuery.data?.status !== 'connected';

  return (
    <ListPageToolbarFrame>

      <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
        <GitBranchDropdown
          currentBranch={page.currentBranch}
          branches={page.branchesQuery.data?.branches ?? []}
          ahead={page.changesQuery.data?.ahead ?? 0}
          behind={page.changesQuery.data?.behind ?? 0}
          disabled={!page.statusQuery.data?.isRepository}
          isLoading={page.branchesQuery.isLoading || page.branchesQuery.isFetching}
          isError={page.branchesQuery.isError}
          isSwitching={page.isCheckingOutBranch}
          onSelectBranch={page.requestCheckoutBranch}
        />
        <AppButton
          intent="confirm"
          size="sm"
          onClick={() => void page.requestSync()}
          disabled={syncDisabled}
          {...pageGuideLocalProps(
            PAGE_GUIDE_EN['pageGuide.page.git.sync.title'],
            PAGE_GUIDE_EN['pageGuide.page.git.sync.hint'],
            18,
          )}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Sync
        </AppButton>
        <span className={PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS} aria-hidden="true" />
        <AppButton
          intent="secondary"
          size="sm"
          onClick={() => void page.requestPush()}
          disabled={pushDisabled}
          {...pageGuideLocalProps(
            PAGE_GUIDE_EN['pageGuide.page.git.push.title'],
            PAGE_GUIDE_EN['pageGuide.page.git.push.hint'],
            19,
          )}
        >
          <Upload className="w-3.5 h-3.5" />
          Push
        </AppButton>
        <span className={PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS} aria-hidden="true" />
        <div className="flex items-center gap-2 shrink-0">
          <AppButton
            intent="utility"
            size="sm"
            onClick={() => void page.runFetch()}
            disabled={remoteActionDisabled}
            {...pageGuideLocalProps(
              PAGE_GUIDE_EN['pageGuide.page.git.fetch.title'],
              PAGE_GUIDE_EN['pageGuide.page.git.fetch.hint'],
              20,
            )}
          >
            <Download className="w-3.5 h-3.5" />
            Fetch
          </AppButton>
          <AppButton
            intent="secondary"
            size="sm"
            onClick={() => void page.runPull()}
            disabled={remoteActionDisabled}
            {...pageGuideLocalProps(
              PAGE_GUIDE_EN['pageGuide.page.git.pull.title'],
              PAGE_GUIDE_EN['pageGuide.page.git.pull.hint'],
              21,
            )}
          >
            <Download className="w-3.5 h-3.5" />
            Pull
          </AppButton>
        </div>
      </div>

      <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
        {showStatusBadge ? (
          <span className={cn('rounded-lg border px-2.5 py-1 text-xs font-semibold', statusToneClass(page.statusLabel))}>
            {page.statusLabel}
          </span>
        ) : null}
        <ToolbarActionGroupWithRefresh
          onRefresh={() => void page.refreshWorkspace()}
          isRefreshing={page.changesQuery.isFetching || page.statusQuery.isFetching}
          actions={[
            ...(page.showConnectRemotePrompt
              ? [{
                id: 'connect-remote',
                label: 'Connect to Remote',
                icon: <Upload className="w-3.5 h-3.5" aria-hidden="true" />,
                intent: 'secondary' as const,
                onClick: () => page.connectDialog.openConnectModal({ focusRemote: true }),
                guideHint: PAGE_GUIDE_EN['pageGuide.page.git.connect.hint'],
              }]
              : []),
            {
              id: 'commit',
              label: 'Commit',
              icon: <GitCommitHorizontal className="w-3.5 h-3.5" aria-hidden="true" />,
              intent: 'primary',
              primary: true,
              disabled: !page.hasCommittableChanges || page.isCommitting,
              onClick: page.openCommitModal,
              guideHint: PAGE_GUIDE_EN['pageGuide.page.git.commit.hint'],
            },
          ]}
        />
      </div>
    </ListPageToolbarFrame>
  );
};
