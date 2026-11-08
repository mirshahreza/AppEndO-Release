import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileDiff, Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { CreateEditModalShell } from '../../../shared/ui';
import { fetchGitDiff } from '../../../shared/api/queries/git';
import type { GitChangeEntry } from '../../../shared/api/queries/git';
import {
  SIDE_BY_SIDE_LEFT_LINE_CLASS,
  SIDE_BY_SIDE_RIGHT_LINE_CLASS,
  type SideBySideDiffRow,
} from '../../packages/utils/sideBySideLineDiff';
import {
  hasUnifiedDiffChanges,
  parseUnifiedDiffToSideBySideRows,
} from '../utils/unifiedDiffSideBySide';

const LINE_ROW_CLASS = 'grid grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-2 px-0';
const LINE_NUMBER_CLASS = 'select-none py-0.5 pr-2 text-right text-[10px] leading-5 text-slate-400';
const LINE_TEXT_CLASS = 'min-w-0 py-0.5 pr-3 font-mono text-[11px] leading-5 whitespace-pre-wrap break-all';

type DiffPanelProps = {
  title: string;
  headerClassName: string;
  side: 'left' | 'right';
  rows: SideBySideDiffRow[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: (event: React.UIEvent<HTMLDivElement>) => void;
};

const DiffPanel: React.FC<DiffPanelProps> = ({
  title,
  headerClassName,
  side,
  rows,
  scrollRef,
  onScroll,
}) => {
  const lineClassMap = side === 'left' ? SIDE_BY_SIDE_LEFT_LINE_CLASS : SIDE_BY_SIDE_RIGHT_LINE_CLASS;
  const kindKey = side === 'left' ? 'leftKind' : 'rightKind';
  const textKey = side === 'left' ? 'left' : 'right';

  let lineNumber = 0;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className={cn('flex shrink-0 items-center border-b border-slate-200 px-3 py-1.5', headerClassName)}>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{title}</span>
      </div>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-auto bg-white"
      >
        {rows.map((row, index) => {
          const kind = row[kindKey];
          const text = row[textKey];
          if (kind !== 'padding') {
            lineNumber += 1;
          }
          const displayNumber = kind === 'padding' ? '' : String(lineNumber);

          return (
            <div
              key={`${side}-${index}`}
              className={cn(LINE_ROW_CLASS, lineClassMap[kind])}
            >
              <span className={LINE_NUMBER_CLASS}>{displayNumber}</span>
              <span className={LINE_TEXT_CLASS}>{text || ' '}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export type GitChangesDiffTarget = {
  path: string;
  staged: boolean;
  section: GitChangeEntry['section'];
} | null;

type GitChangesDiffModalProps = {
  target: GitChangesDiffTarget;
  onClose: () => void;
};

export const GitChangesDiffModal: React.FC<GitChangesDiffModalProps> = ({
  target,
  onClose,
}) => {
  const [diffText, setDiffText] = useState('');
  const [truncated, setTruncated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const syncingScrollRef = useRef(false);

  const rows = useMemo(
    () => parseUnifiedDiffToSideBySideRows(diffText),
    [diffText],
  );

  const syncScroll = (source: HTMLDivElement, targetEl: HTMLDivElement | null) => {
    if (!targetEl || syncingScrollRef.current) return;
    syncingScrollRef.current = true;
    targetEl.scrollTop = source.scrollTop;
    targetEl.scrollLeft = source.scrollLeft;
    window.requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  };

  useEffect(() => {
    if (!target) {
      setDiffText('');
      setTruncated(false);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void fetchGitDiff(target.path, target.staged, target.section)
      .then((diff) => {
        if (cancelled) return;
        setDiffText(diff.diff ?? '');
        setTruncated(diff.truncated);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setDiffText('');
        setTruncated(false);
        setError((err as Error).message || 'Failed to load changes.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [target]);

  if (!target) return null;

  const hasTextualChanges = hasUnifiedDiffChanges(diffText);

  return (
    <CreateEditModalShell
      size="maximized"
      gradient={false}
      shellClassName="flex min-h-0 flex-col"
      bodyOuterClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      bodyClassName="!flex !min-h-0 !flex-1 !flex-col !overflow-hidden !p-0 !min-h-full"
      title={(
        <span className="inline-flex items-center gap-2">
          <FileDiff className="h-4 w-4 shrink-0 text-primary-500" aria-hidden="true" />
          <span>View Changes</span>
        </span>
      )}
      subtitle={target.path}
      subtitleTone="elevated"
      subtitleClassName="py-2 font-mono text-xs"
      onClose={onClose}
      closeOnEscape={false}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {isLoading ? (
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading changes…
          </div>
        ) : null}

        {error ? (
          <div className="mx-3 mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        ) : null}

        {!isLoading && !error && hasTextualChanges ? (
          <>
            <div className="grid min-h-0 flex-1 grid-cols-2 divide-x divide-slate-200 overflow-hidden">
              <DiffPanel
                title="Before"
                headerClassName="bg-slate-50"
                side="left"
                rows={rows}
                scrollRef={leftScrollRef}
                onScroll={(event) => syncScroll(event.currentTarget, rightScrollRef.current)}
              />
              <DiffPanel
                title="After"
                headerClassName="bg-cyan-50"
                side="right"
                rows={rows}
                scrollRef={rightScrollRef}
                onScroll={(event) => syncScroll(event.currentTarget, leftScrollRef.current)}
              />
            </div>
            {truncated ? (
              <p className="shrink-0 border-t border-slate-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-700">
                Diff output was truncated.
              </p>
            ) : null}
          </>
        ) : null}
        {!isLoading && !error && !hasTextualChanges ? (
          <p className="px-3 py-2 text-xs text-slate-500">
            No textual changes to compare for this file.
          </p>
        ) : null}
      </div>
    </CreateEditModalShell>
  );
};
