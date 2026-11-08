import React from 'react';
import { cn } from '../../lib/utils';
import { PAGE_GUIDE_EN } from '../../core/culture/translations/pageGuideEn';
import { PAGE_TOOLBAR_FILTER_CHECKBOX_GROUP_CLASS } from './surfaceClasses';
import { NativeButton } from './NativeButton';
import { pageGuideLocalProps } from './shell/pageGuide/pageGuideChrome';

export type ToolbarFilterRadioOption = {
  value: string;
  label: string;
  count?: number;
};

export type ToolbarFilterRadioGroupProps = {
  value: string;
  options: ReadonlyArray<ToolbarFilterRadioOption>;
  onChange: (value: string) => void;
  ariaLabel?: string;
  /** Page-guide hint. Defaults to the shared list-filter sentence. */
  hint?: string;
  className?: string;
};

const TOOLBAR_FILTER_RADIO_ALL_LABEL = 'All';

export const TOOLBAR_FILTER_RADIO_ALL_VALUE = '';

const TOOLBAR_FILTER_RADIO_ITEM_CLASS =
  'inline-flex h-6 shrink-0 cursor-pointer select-none items-center rounded px-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-indigo-700';

const TOOLBAR_FILTER_RADIO_ITEM_SELECTED_CLASS =
  'bg-indigo-50 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-700';

export const ToolbarFilterRadioGroup: React.FC<ToolbarFilterRadioGroupProps> = ({
  value,
  options,
  onChange,
  ariaLabel = 'Filter options',
  hint,
  className,
}) => (
  <div
    className={cn(PAGE_TOOLBAR_FILTER_CHECKBOX_GROUP_CLASS, className)}
    role="radiogroup"
    aria-label={ariaLabel}
    {...pageGuideLocalProps(
      ariaLabel,
      hint?.trim() || PAGE_GUIDE_EN['pageGuide.page.filter.hint'],
      20,
    )}
  >
    <NativeButton
      type="button"
      role="radio"
      aria-checked={value === ''}
      className={cn(
        TOOLBAR_FILTER_RADIO_ITEM_CLASS,
        value === '' && TOOLBAR_FILTER_RADIO_ITEM_SELECTED_CLASS,
      )}
      onClick={() => onChange('')}
    >
      {TOOLBAR_FILTER_RADIO_ALL_LABEL}
    </NativeButton>
    {options.map((option) => (
      <NativeButton
        key={option.value}
        type="button"
        role="radio"
        aria-checked={value === option.value}
        className={cn(
          TOOLBAR_FILTER_RADIO_ITEM_CLASS,
          value === option.value && TOOLBAR_FILTER_RADIO_ITEM_SELECTED_CLASS,
        )}
        onClick={() => onChange(option.value)}
      >
        {option.label}
        {option.count != null ? (
          <span className="ms-1 tabular-nums text-[10px] font-bold text-current opacity-70">
            {option.count}
          </span>
        ) : null}
      </NativeButton>
    ))}
  </div>
);
