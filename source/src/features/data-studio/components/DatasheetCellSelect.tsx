import React from 'react';
import { cn } from '../../../lib/utils';
import {
  HERO_UI_FIELD_TEXT_ALIGN_CLASS,
  resolveHeroUiFieldSizeTokens,
} from '../../../shared/ui/heroFieldSize';
import { UiSelectMenu, type UiSelectMenuOption } from '../../../shared/ui/UiSelectMenu';

const SIZE_TOKENS = resolveHeroUiFieldSizeTokens('xs');

const TRIGGER_CLASS = cn(
  'flex w-full items-center justify-between gap-1 rounded-none !border-0 px-1.5 shadow-none',
  SIZE_TOKENS.controlHeightClass,
  SIZE_TOKENS.textClass,
  'leading-tight font-semibold text-slate-800',
  '!bg-white hover:!bg-white data-[hover=true]:!bg-white data-[open=true]:!bg-white',
  // Locked cells keep full-contrast text (HeroUI disabled defaults are too faint).
  'disabled:!cursor-not-allowed disabled:!opacity-100 disabled:!text-slate-800',
  'data-[disabled=true]:!cursor-not-allowed data-[disabled=true]:!opacity-100 data-[disabled=true]:!text-slate-800',
  'focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-indigo-300',
);

type DatasheetCellSelectProps = {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel: string;
};

export const DatasheetCellSelect: React.FC<DatasheetCellSelectProps> = ({
  value,
  options,
  onChange,
  disabled = false,
  ariaLabel,
}) => (
  <UiSelectMenu
    ariaLabel={ariaLabel}
    selectedKey={value}
    isDisabled={disabled}
    size="sm"
    className={cn(
      '!bg-white',
      disabled && '!opacity-100 data-[disabled=true]:!opacity-100',
    )}
    triggerClassName={TRIGGER_CLASS}
    valueClassName={cn(
      'min-w-0 flex-1 truncate font-semibold leading-tight text-slate-800',
      SIZE_TOKENS.textClass,
      HERO_UI_FIELD_TEXT_ALIGN_CLASS,
      disabled && '!opacity-100 !text-slate-800',
    )}
    indicatorClassName={cn(
      'shrink-0 text-slate-500',
      SIZE_TOKENS.textClass,
      disabled && 'invisible',
    )}
    popoverClassName="z-[220] rounded-md border border-slate-200 bg-white shadow-lg"
    popoverPlacement="bottom"
    popoverShouldFlip
    listBoxClassName={cn('max-h-56 overflow-y-auto p-1 leading-tight', SIZE_TOKENS.textClass)}
    onSelectionChange={onChange}
    options={options.map((option): UiSelectMenuOption => ({
      id: option,
      textValue: option,
      content: option,
      className: cn(
        'rounded px-2 py-1 font-medium text-slate-700 data-[focused=true]:bg-indigo-50 data-[selected=true]:bg-indigo-100',
        SIZE_TOKENS.textClass,
      ),
    }))}
  />
);
