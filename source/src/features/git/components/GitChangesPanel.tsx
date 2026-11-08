import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Minus, Plus, Undo2 } from 'lucide-react';
import { useCultureT } from '../../../core/culture/CultureContext';
import {
  ICON_ACTION_BUTTON_SM_CLASS,
  ICON_ACTION_DELETE_CLASS,
  ICON_ACTION_EDIT_CLASS,
} from '../../../shared/ui/surfaceClasses';
import { WorkspaceVerticalSplitHandle, useWorkspaceSplitRatioPanel, WORKSPACE_SPLIT_PANEL_KEYS } from '../../../shared/ui';
import { useViewportTier } from '../../../shared/lib/useViewportTier';
import { isCompactChromeTier } from '../../../shared/lib/viewportTokens';
import { cn } from '../../../lib/utils';
import type { GitChangeEntry, GitChangeSection } from '../../../shared/api/queries/git';
import type { GitPageModel } from '../hooks/useGitPage';
import { GitChangesDiffModal, type GitChangesDiffTarget } from './GitChangesDiffModal';
import { GitDiffViewer } from './GitDiffViewer';

type GitChangesPanelProps = {
  page: GitPageModel;
};

type ChangeSectionGroup = {
  id: GitChangeSection;
  label: string;
  entries: GitChangeEntry[];
};

const SECTION_ORDER: GitChangeSection[] = ['staged', 'unstaged', 'untracked'];

const SECTION_LABEL_KEYS: Record<GitChangeSection, string> = {
  staged: 'git.changes.staged',
  unstaged: 'git.changes.unstaged',
  untracked: 'git.changes.untracked',
};

const statusCodeClass = (statusCode: string): string => {
  switch (statusCode) {
    case 'M':
      return 'text-amber-600';
    case 'A':
    case 'U':
      return 'text-emerald-600';
    case 'D':
      return 'text-rose-600';
    case 'R':
    case 'C':
      return 'text-cyan-600';
    default:
      return 'text-slate-500';
  }
};

const entryKey = (entry: GitChangeEntry): string => `${entry.section}:${entry.path}`;

const ACTION_SLOT_CLASS = 'h-5 w-5 shrink-0';

const ActionSlotSpacer: React.FC = () => (
  <span className={ACTION_SLOT_CLASS} aria-hidden="true" />
);

const isEntrySelectedForDiff = (
  entry: GitChangeEntry,
  selectedDiff: GitPageModel['selectedDiff'],
): boolean => (
  Boolean(
    selectedDiff
    && selectedDiff.path === entry.path
    && selectedDiff.staged === (entry.section === 'staged'),
  )
);

export const GitChangesPanel: React.FC<GitChangesPanelProps> = ({ page }) => {
  const t = useCultureT();
  const compactChrome = isCompactChromeTier(useViewportTier());
  const [expandedSections, setExpandedSections] = useState<Record<GitChangeSection, boolean>>({
    staged: true,
    unstaged: true,
    untracked: true,
  });
  const [viewChangesTarget, setViewChangesTarget] = useState<GitChangesDiffTarget>(null);
  const splitHostRef = useRef<HTMLDivElement>(null);
  const diffSplit = useWorkspaceSplitRatioPanel({
    panelKey: WORKSPACE_SPLIT_PANEL_KEYS.gitChangesDiff,
    defaultRatio: 0.4,
    minLeadingPx: 220,
    minTrailingPx: 220,
    containerRef: splitHostRef,
    side: 'end',
    collapsible: false,
    displayClassName: compactChrome ? 'hidden' : 'block',
  });

  const allEntries = page.changesQuery.data?.entries ?? [];
  const visibleEntries = allEntries;

  const sectionGroups = useMemo<ChangeSectionGroup[]>(() => (
    SECTION_ORDER
      .map((id) => ({
        id,
        label: t(SECTION_LABEL_KEYS[id]),
        entries: visibleEntries.filter((entry) => entry.section === id),
      }))
      .filter((group) => group.entries.length > 0)
  ), [t, visibleEntries]);

  useEffect(() => {
    setExpandedSections((current) => {
      const next = { ...current };
      for (const group of sectionGroups) {
        if (!(group.id in next)) {
          next[group.id] = true;
        }
      }
      return next;
    });
  }, [sectionGroups]);

  const showDiffPane = Boolean(page.selectedDiff);

  useEffect(() => {
    if (!page.selectedDiff) {
      setViewChangesTarget(null);
    }
  }, [page.selectedDiff]);

  const toggleSection = useCallback((section: GitChangeSection) => {
    setExpandedSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }, []);


  const openViewChangesForSelection = useCallback(() => {
    const selected = page.selectedDiff;
    if (!selected) {
      return;
    }

    const entries = page.changesQuery.data?.entries ?? [];
    const entry = entries.find((item) => (
      item.path === selected.path
      && (item.section === 'staged') === selected.staged
    )) ?? entries.find((item) => item.path === selected.path);

    setViewChangesTarget({
      path: selected.path,
      staged: selected.staged,
      section: entry?.section ?? (selected.staged ? 'staged' : 'unstaged'),
    });
  }, [page.changesQuery.data?.entries, page.selectedDiff]);

  const closeViewChanges = useCallback(() => {
    setViewChangesTarget(null);
  }, []);

  const handleEntryClick = useCallback((entry: GitChangeEntry) => {
    if (isEntrySelectedForDiff(entry, page.selectedDiff)) {
      page.clearDiff();
      return;
    }
    page.openDiff(entry);
  }, [page]);

  return (
    <div className="flex h-full min-h-0 flex-col">
        <div
          ref={splitHostRef}
          className={cn(
            'flex h-full min-h-0 flex-1 items-stretch',
            compactChrome && showDiffPane && 'flex-col',
            diffSplit.isResizing && 'select-none',
          )}
        >
          <div
            className={cn(
              'min-h-0 overflow-y-auto',
              showDiffPane && !compactChrome && 'pr-2',
              !showDiffPane && 'flex-1',
              compactChrome && showDiffPane && 'max-h-[40%] w-full shrink-0',
            )}
            style={showDiffPane && !compactChrome ? { width: `${diffSplit.ratio * 100}%` } : undefined}
            onScroll={page.handleGridScroll}
          >
            {page.changesQuery.isLoading ? (
              <p className="px-1 py-2 text-xs text-slate-500">{t('git.changes.loading')}</p>
            ) : page.changesQuery.isError ? (
              <p className="px-1 py-2 text-xs text-rose-600">{t('git.changes.loadFailed')}</p>
            ) : sectionGroups.length === 0 ? (
              <p className="px-1 py-2 text-xs text-slate-500">
                {page.statusQuery.data?.isRepository ? t('git.changes.empty') : t('git.changes.repoUnavailable')}
              </p>
            ) : (
              <div className="flex flex-col gap-1 py-1">
                {sectionGroups.map((group) => {
                  const isExpanded = expandedSections[group.id];
                  return (
                    <div key={group.id}>
                      <div className="group flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-slate-100">
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                          onClick={() => toggleSection(group.id)}
                          aria-expanded={isExpanded}
                        >
                          <ChevronRight
                            className={cn(
                              'h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform',
                              isExpanded && 'rotate-90',
                            )}
                          />
                          <span className="shrink-0 text-xs font-semibold text-slate-700">
                            {group.label}
                          </span>
                          {group.id === 'unstaged' ? (
                            <span className="inline-flex shrink-0 items-center rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-amber-700">
                              {group.entries.length}
                            </span>
                          ) : (
                            <span className="shrink-0 text-[10px] font-mono text-slate-400">
                              {group.entries.length}
                            </span>
                          )}
                        </button>
                        <div className="flex shrink-0 items-center gap-[7px]">
                          <ActionSlotSpacer />
                          {group.id === 'unstaged' ? (
                            <button
                              type="button"
                              className={cn(
                                ICON_ACTION_BUTTON_SM_CLASS,
                                'text-rose-600 hover:bg-rose-50 hover:text-rose-700',
                                'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
                              )}
                              onClick={() => page.confirmDiscardAll()}
                              aria-label={t('git.changes.discardAll')}
                              title={t('git.changes.discardAll')}
                            >
                              <Undo2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <ActionSlotSpacer />
                          )}
                        </div>
                        <span className="w-5 shrink-0" aria-hidden="true" />
                      </div>

                      {isExpanded ? (
                        <div className="ml-3 border-l border-slate-100 pl-1">
                          {group.entries.map((entry) => {
                            const isDiffSelected = isEntrySelectedForDiff(entry, page.selectedDiff);
                            return (
                              <div
                                key={entryKey(entry)}
                                className={cn(
                                  'group flex items-center gap-1 rounded-md px-1.5 py-0.5',
                                  isDiffSelected ? 'bg-indigo-50 hover:bg-indigo-100' : 'hover:bg-slate-100',
                                )}
                              >
                                <button
                                  type="button"
                                  className="flex min-w-0 flex-1 items-center text-left"
                                  onClick={() => handleEntryClick(entry)}
                                  title={entry.path}
                                >
                                  <span className={cn(
                                    'min-w-0 flex-1 truncate text-xs',
                                    entry.denied ? 'text-slate-400' : 'text-slate-700',
                                  )}
                                  >
                                    {entry.path}
                                  </span>
                                </button>
                                <div className="flex shrink-0 items-center gap-[7px]">
                                  {entry.section === 'unstaged' ? (
                                    <button
                                      type="button"
                                      className={cn(
                                        ICON_ACTION_BUTTON_SM_CLASS,
                                        ICON_ACTION_EDIT_CLASS,
                                        'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
                                      )}
                                      disabled={entry.denied}
                                      onClick={() => void page.stagePaths([entry.path])}
                                      aria-label={t('git.changes.stagePath', { path: entry.path })}
                                      title={t('git.changes.stage')}
                                    >
                                      <Plus className="w-4 h-4" />
                                    </button>
                                  ) : entry.section === 'staged' ? (
                                    <button
                                      type="button"
                                      className={cn(
                                        ICON_ACTION_BUTTON_SM_CLASS,
                                        ICON_ACTION_EDIT_CLASS,
                                        'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
                                      )}
                                      disabled={entry.denied}
                                      onClick={() => void page.unstagePaths([entry.path])}
                                      aria-label={t('git.changes.unstagePath', { path: entry.path })}
                                      title={t('git.changes.unstage')}
                                    >
                                      <Minus className="w-4 h-4" />
                                    </button>
                                  ) : (
                                    <ActionSlotSpacer />
                                  )}
                                  <button
                                    type="button"
                                    className={cn(
                                      ICON_ACTION_BUTTON_SM_CLASS,
                                      ICON_ACTION_DELETE_CLASS,
                                      'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
                                    )}
                                    disabled={entry.denied}
                                    onClick={() => page.confirmDiscardPaths([entry.path], entry.section === 'untracked')}
                                    aria-label={t('git.changes.discardPath', { path: entry.path })}
                                    title={t('git.changes.discard')}
                                  >
                                    <Undo2 className="w-4 h-4" />
                                  </button>
                                </div>
                                <span className={cn(
                                  'w-5 shrink-0 text-center font-mono text-base font-semibold leading-none',
                                  statusCodeClass(entry.statusCode),
                                )}
                                >
                                  {entry.statusCode}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {showDiffPane ? (
            <>
              <WorkspaceVerticalSplitHandle {...diffSplit.splitHandleProps} />
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white">
                <GitDiffViewer
                  page={page}
                  fill
                  onOpenViewChanges={openViewChangesForSelection}
                />
              </div>
            </>
          ) : null}
        </div>

      <GitChangesDiffModal
        target={viewChangesTarget}
        onClose={closeViewChanges}
      />
    </div>
  );
};
