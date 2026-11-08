import React, { useState } from 'react';
import { Check, ChevronDown, GitBranch } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  SPLIT_BUTTON_MENU_ITEM_CLASS,
  SPLIT_BUTTON_MENU_PANEL_CLASS,
  useSplitButtonMenu,
} from '../../../shared/ui/AppSplitButton';
import type { GitBranchSummary } from '../../../shared/api/queries/git';
import { PAGE_GUIDE_EN } from '../../../core/culture/translations/pageGuideEn';
import { pageGuideLocalProps } from '../../../shared/ui/shell/pageGuide/pageGuideChrome';

type GitBranchDropdownProps = {
  currentBranch: string | null;
  branches: GitBranchSummary[];
  ahead?: number;
  behind?: number;
  disabled?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  isSwitching?: boolean;
  onSelectBranch: (branch: string) => void;
};

export const GitBranchDropdown: React.FC<GitBranchDropdownProps> = ({
  currentBranch,
  branches,
  ahead = 0,
  behind = 0,
  disabled = false,
  isLoading = false,
  isError = false,
  isSwitching = false,
  onSelectBranch,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useSplitButtonMenu(isOpen, setIsOpen);
  const label = currentBranch ?? (isLoading ? 'Loading…' : 'No branch');
  const hasTrackingDelta = ahead > 0 || behind > 0;
  const isDisabled = disabled || isSwitching;

  return (
    <div ref={menuRef} className="relative z-30 shrink-0">
      <button
        type="button"
        className={cn(
          'flex h-8 max-w-[14rem] items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600 transition-colors',
          isDisabled
            ? 'cursor-not-allowed opacity-60'
            : 'hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800',
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Current branch: ${label}`}
        title={label}
        disabled={isDisabled}
        {...pageGuideLocalProps(
          PAGE_GUIDE_EN['pageGuide.page.git.branch.title'],
          PAGE_GUIDE_EN['pageGuide.page.git.branch.hint'],
          17,
        )}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => {
          if (!isDisabled) {
            setIsOpen((open) => !open);
          }
        }}
      >
        <GitBranch className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="truncate font-medium">{label}</span>
        {hasTrackingDelta ? (
          <span className="shrink-0 text-[10px] text-slate-400">
            ↑{ahead} ↓{behind}
          </span>
        ) : null}
        <ChevronDown className={cn('h-3 w-3 shrink-0 text-slate-400 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen ? (
        <div
          className={cn(SPLIT_BUTTON_MENU_PANEL_CLASS, 'left-0 top-[calc(100%+4px)] z-50 min-w-[10rem] max-h-64 overflow-y-auto py-1')}
          role="listbox"
          aria-label="Git branches"
        >
          {isLoading ? (
            <p className={cn(SPLIT_BUTTON_MENU_ITEM_CLASS, 'text-slate-500')}>Loading branches…</p>
          ) : isError ? (
            <p className={cn(SPLIT_BUTTON_MENU_ITEM_CLASS, 'text-rose-600')}>Failed to load branches.</p>
          ) : branches.length === 0 ? (
            <p className={cn(SPLIT_BUTTON_MENU_ITEM_CLASS, 'text-slate-500')}>No local branches found.</p>
          ) : (
            branches.map((branch) => {
              const isSelected = branch.current;
              return (
                <button
                  key={branch.name}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={cn(
                    SPLIT_BUTTON_MENU_ITEM_CLASS,
                    'gap-2',
                    isSelected && 'bg-indigo-50 text-indigo-700',
                  )}
                  onClick={() => {
                    if (!isSelected) {
                      onSelectBranch(branch.name);
                    }
                    setIsOpen(false);
                  }}
                >
                  {isSelected ? (
                    <Check className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <span className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span className="truncate font-medium">{branch.name}</span>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
};
