import React, { useMemo } from 'react';
import { FileDiff } from 'lucide-react';
import { AppButton } from '../../../shared/ui';
import { cn } from '../../../lib/utils';
import type { GitPageModel } from '../hooks/useGitPage';

type GitDiffViewerProps = {
  page: GitPageModel;
  fill?: boolean;
  onOpenViewChanges?: () => void;
};
type DiffLineKind = 'add' | 'remove' | 'hunk' | 'meta' | 'context';

const DIFF_LINE_CLASS: Record<DiffLineKind, string> = {
  add: 'bg-emerald-50 text-emerald-950',
  remove: 'bg-rose-50 text-rose-950',
  hunk: 'bg-slate-50 text-slate-600',
  meta: 'bg-white text-slate-500',
  context: 'bg-white text-slate-800',
};

const classifyDiffLine = (line: string): DiffLineKind => {
  if (line.startsWith('@@')) {
    return 'hunk';
  }
  if (line.startsWith('+++') || line.startsWith('---')) {
    return 'meta';
  }
  if (line.startsWith('+')) {
    return 'add';
  }
  if (line.startsWith('-')) {
    return 'remove';
  }
  return 'context';
};

const GitUnifiedDiffBody: React.FC<{ diff: string }> = ({ diff }) => {
  const lines = useMemo(() => {
    const trimmed = diff.trim();
    if (!trimmed) {
      return ['No diff output.'];
    }
    return trimmed.split('\n');
  }, [diff]);

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-white">
      {lines.map((line, index) => (
        <div
          key={index}
          className={cn(
            'pl-2 pr-0 py-0.5 font-mono text-[11px] leading-5 whitespace-pre-wrap break-all',
            DIFF_LINE_CLASS[classifyDiffLine(line)],
          )}
        >
          {line || ' '}
        </div>
      ))}
    </div>
  );
};

export const GitDiffViewer: React.FC<GitDiffViewerProps> = ({
  page,
  fill = false,
  onOpenViewChanges,
}) => {
  const selected = page.selectedDiff;

  if (!selected) {
    return null;
  }

  return (
    <div className={cn('flex flex-col', fill ? 'h-full min-h-0' : 'gap-2')}>
      <div className={cn(
        'flex shrink-0 items-center gap-2 border-b border-slate-100 bg-slate-50/80 pl-3 pr-0 py-2.5',
        fill && 'min-h-11',
      )}
      >
        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-600">
          {selected.path}
          {' '}
          <span className="font-normal text-slate-400">
            ({selected.staged ? 'staged' : 'unstaged'})
          </span>
        </p>
        {onOpenViewChanges ? (
          <AppButton
            intent="secondary"
            size="sm"
            onClick={onOpenViewChanges}
            className="mr-2.5 h-7 shrink-0 gap-1 px-2 text-[11px] font-medium"
            aria-label="View side by side"
          >
            <FileDiff className="h-3 w-3 shrink-0 opacity-80" />
            View Side By Side
          </AppButton>
        ) : null}
      </div>
      <div className={cn('min-h-0', fill ? 'flex min-h-0 flex-1 flex-col overflow-auto' : 'max-h-72 overflow-auto')}>
        {page.diffQuery.isLoading ? (
          <p className="pl-2 pr-0 py-2 text-xs text-slate-500">Loading diff…</p>
        ) : null}

        {page.diffQuery.isError ? (
          <p className="pl-2 pr-0 py-2 text-xs text-rose-600">Failed to load diff.</p>
        ) : null}

        {page.diffQuery.data ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <GitUnifiedDiffBody diff={page.diffQuery.data.diff} />
            {page.diffQuery.data.truncated ? (
              <p className="shrink-0 pl-2 pr-0 py-1.5 text-[11px] text-amber-700">Diff output was truncated.</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};
