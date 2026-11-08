import React from 'react';
import { FileCode2, Settings2 } from 'lucide-react';
import { AppButton } from '../../../shared/ui';
import type { GitPageModel } from '../hooks/useGitPage';

type GitPageFooterProps = {
  page: GitPageModel;
};

export const GitPageFooter: React.FC<GitPageFooterProps> = ({ page }) => {
  const { staged, unstaged, untracked } = page.sectionCounts;

  return (
    <div className="flex h-9 shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-2.5 text-[11px] text-slate-500">
      <div className="flex min-w-0 items-center gap-3">
        <span>
          <span className="font-semibold text-slate-600">{staged}</span> staged
        </span>
        <span className="text-slate-300">·</span>
        <span>
          <span className="font-semibold text-slate-600">{unstaged}</span> changes
        </span>
        {untracked > 0 ? (
          <>
            <span className="text-slate-300">·</span>
            <span>
              <span className="font-semibold text-slate-600">{untracked}</span> untracked
            </span>
          </>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <AppButton
          intent="secondary"
          size="icon-sm"
          aria-label="Git preferences"
          title="Preferences"
          onClick={page.openPreferencesModal}
        >
          <Settings2 className="w-3.5 h-3.5" />
        </AppButton>
        <AppButton
          intent="secondary"
          size="icon-sm"
          aria-label="Edit CI workflow"
          title="Workflow"
          onClick={page.openWorkflowEditorModal}
          disabled={!page.statusQuery.data?.isRepository}
        >
          <FileCode2 className="w-3.5 h-3.5" />
        </AppButton>
      </div>
    </div>
  );
};
