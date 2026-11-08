import React from 'react';
import { cn } from '../../../lib/utils';
import { NavigationIcon } from '../../../shared/lib/navigationIcons/NavigationIcon';
import type { ProductIdeaListItem } from '../../../shared/api/contracts/idea-foundry/types';
import {
  formatIdeaHomeLabel,
  IDEA_IMPORTANCE_LABEL,
  IDEA_MATURITY_LABEL,
  IDEA_SCALE_LABEL,
  resolveIdeaCardChrome,
  resolveIdeaIconRef,
} from '../ideaFoundryCatalog';

type IdeaFoundryCardProps = {
  item: ProductIdeaListItem;
  onOpen: (id: string) => void;
};

export const IdeaFoundryCard: React.FC<IdeaFoundryCardProps> = ({ item, onOpen }) => {
  const chrome = resolveIdeaCardChrome(item);
  return (
    <button
      type="button"
      className={cn(
        'flex h-full w-full overflow-hidden rounded-xl border text-start shadow-sm transition-shadow hover:shadow-md',
        chrome.shellClass,
      )}
      data-testid="idea-foundry-card"
      data-maturity={item.maturity}
      data-target-kind={item.targetKind}
      onClick={() => onOpen(item.id)}
    >
      <span className={cn('shrink-0 self-stretch', chrome.barClass, chrome.barWidthClass)} aria-hidden />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={chrome.maturityChipClass}>
            {IDEA_MATURITY_LABEL[item.maturity] ?? item.maturity}
          </span>
          <span className={chrome.homeChipClass}>{formatIdeaHomeLabel(item)}</span>
          <span className={chrome.importanceChipClass}>
            {IDEA_IMPORTANCE_LABEL[item.importance] ?? item.importance}
          </span>
          <span className={chrome.scaleChipClass}>
            {IDEA_SCALE_LABEL[item.scale] ?? item.scale}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white"
            aria-hidden
          >
            <NavigationIcon
              iconRef={resolveIdeaIconRef(item.icon)}
              className={cn('h-4 w-4', chrome.titleClass)}
            />
          </span>
          <span
            className={cn('min-w-0 flex-1 truncate text-base leading-none', chrome.titleClass, chrome.titleWeightClass)}
            title={item.title}
          >
            {item.title}
          </span>
        </div>
        <p className="line-clamp-4 min-h-0 flex-1 text-xs font-normal leading-relaxed text-slate-500">
          {item.description}
        </p>
      </div>
    </button>
  );
};
