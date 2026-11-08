import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { CreateEditModalShell } from '../../../shared/ui';
import { fetchPackageRepackDiff } from '../../../shared/api/queries/packages';
import type { PackageRepackChangedItem, PackageRepackItemDiff } from '../../../shared/api/contracts/package/repack';
import type { PackageRow } from '../types';
import {
  buildSideBySideLineDiff,
  SIDE_BY_SIDE_LEFT_LINE_CLASS,
  SIDE_BY_SIDE_RIGHT_LINE_CLASS,
  type SideBySideDiffRow,
} from '../utils/sideBySideLineDiff';

const LINE_ROW_CLASS = 'grid grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-2 px-0';
const LINE_NUMBER_CLASS = 'select-none py-0.5 pr-2 text-right text-[10px] leading-5 text-slate-400';
const LINE_TEXT_CLASS = 'min-w-0 py-0.5 pr-3 font-mono text-[11px] leading-5 whitespace-pre-wrap break-all';

type DiffPanelProps = {
  title: string;
  subtitle: string;
  headerClassName: string;
  side: 'left' | 'right';
  rows: SideBySideDiffRow[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: (event: React.UIEvent<HTMLDivElement>) => void;
};

const DiffPanel: React.FC<DiffPanelProps> = ({
  title,
  subtitle,
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
      <div className={cn('flex shrink-0 items-center gap-2 border-b border-slate-200 px-3 py-1.5', headerClassName)}>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{title}</span>
        <span className="text-slate-300">·</span>
        <span className="truncate text-xs font-medium text-slate-700">{subtitle}</span>
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

export type PackageRepackDiffModalProps = {
  target: PackageRow | null;
  item: PackageRepackChangedItem | null;
  onClose: () => void;
};

export const PackageRepackDiffModal: React.FC<PackageRepackDiffModalProps> = ({
  target,
  item,
  onClose,
}) => {
  const [diffData, setDiffData] = useState<PackageRepackItemDiff | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const syncingScrollRef = useRef(false);

  const rows = useMemo(() => {
    if (!diffData) return [];
    return buildSideBySideLineDiff(diffData.baseline, diffData.current);
  }, [diffData]);

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
    if (!target || !item) {
      setDiffData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    void fetchPackageRepackDiff(target.packageId, item.itemId)
      .then((diff) => {
        if (cancelled) return;
        setDiffData(diff);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setDiffData(null);
        setError((err as Error).message || 'Failed to load diff.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [item, target]);

  if (!target || !item) return null;

  return (
    <CreateEditModalShell
      size="maximized"
      shellClassName="flex min-h-0 flex-1 flex-col"
      bodyOuterClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden !p-0"
      title="Item Diff"
      subtitle={(
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="shrink-0 font-semibold text-slate-800">{item.label}</span>
          <span className="shrink-0 text-slate-400">·</span>
          <span className="min-w-0 truncate font-mono text-xs text-slate-500">{item.entryPath}</span>
        </div>
      )}
      subtitleTone="elevated"
      subtitleClassName="py-2 text-[13px]"
      onClose={onClose}
      closeOnEscape={false}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {isLoading ? (
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading diff…
          </div>
        ) : null}

        {error ? (
          <div className="mx-3 mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        ) : null}

        {diffData ? (
          <>
            <div className="grid min-h-0 flex-1 grid-cols-2 divide-x divide-slate-200 overflow-hidden">
              <DiffPanel
                title="Package baseline"
                subtitle="Unchanged artifact"
                headerClassName="bg-slate-50"
                side="left"
                rows={rows}
                scrollRef={leftScrollRef}
                onScroll={(event) => syncScroll(event.currentTarget, rightScrollRef.current)}
              />
              <DiffPanel
                title="Installed current"
                subtitle="After install changes"
                headerClassName="bg-cyan-50"
                side="right"
                rows={rows}
                scrollRef={rightScrollRef}
                onScroll={(event) => syncScroll(event.currentTarget, leftScrollRef.current)}
              />
            </div>
            {diffData.truncated ? (
              <p className="shrink-0 border-t border-slate-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-700">
                Diff summary was truncated; full source is shown in both panels.
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </CreateEditModalShell>
  );
};
