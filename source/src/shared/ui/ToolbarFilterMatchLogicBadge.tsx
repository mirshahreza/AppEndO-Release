import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  type FilterMatchLogic,
  getLocalizedFilterMatchLogicOption,
  resolveFilterMatchLogicOptions,
} from '../lib/filterMatchLogic';
import { SPLIT_BUTTON_MENU_PANEL_CLASS, SplitButtonMenuItem, useSplitButtonMenu } from './AppSplitButton';
import { NativeButton } from './NativeButton';
import { useOptionalCultureT } from '../../core/culture/CultureContext';
import { PAGE_GUIDE_EN } from '../../core/culture/translations/pageGuideEn';
import { pageGuideLocalProps } from './shell/pageGuide/pageGuideChrome';

export type ToolbarFilterMatchLogicBadgeProps = {
  value: FilterMatchLogic;
  onChange: (value: FilterMatchLogic) => void;
  options?: ReadonlyArray<FilterMatchLogic>;
  ariaLabel?: string;
  className?: string;
};

export const ToolbarFilterMatchLogicBadge: React.FC<ToolbarFilterMatchLogicBadgeProps> = ({
  value,
  onChange,
  options,
  ariaLabel = 'Filter match logic',
  className,
}) => {
  const t = useOptionalCultureT();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useSplitButtonMenu(isOpen, setIsOpen);
  const localizedOptions = resolveFilterMatchLogicOptions(t);
  const allowedOptions = localizedOptions.filter(
    (option) => !options || options.includes(option.value),
  );
  const selected = getLocalizedFilterMatchLogicOption(value, t);
  const matchLogicHint = t('pageGuide.page.matchLogic.hint', { missing: 'silent' });

  return (
    <div
      ref={menuRef}
      className={cn('relative inline-flex shrink-0 items-center', className)}
      {...pageGuideLocalProps(
        ariaLabel,
        matchLogicHint !== 'pageGuide.page.matchLogic.hint'
          ? matchLogicHint
          : PAGE_GUIDE_EN['pageGuide.page.matchLogic.hint'],
        21,
      )}
    >
      <NativeButton
        type="button"
        className="inline-flex cursor-pointer items-center gap-0.5 rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700 transition-colors hover:bg-indigo-100"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((previous) => !previous)}
      >
        <span>{selected.label}</span>
        <ChevronDown className={cn('h-3 w-3 transition-transform', isOpen && 'rotate-180')} />
      </NativeButton>
      {isOpen ? (
        <div
          className={cn(SPLIT_BUTTON_MENU_PANEL_CLASS, 'start-0 end-auto min-w-[11rem]')}
          role="listbox"
          aria-label={ariaLabel}
        >
          {allowedOptions.map((option) => (
            <SplitButtonMenuItem
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              className={cn(
                'flex-col items-start gap-0 py-2',
                option.value === value && 'bg-indigo-50 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-700',
              )}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              <span className="font-semibold">{option.label}</span>
              <span className="text-[10px] font-normal text-slate-500">{option.description}</span>
            </SplitButtonMenuItem>
          ))}
        </div>
      ) : null}
    </div>
  );
};
