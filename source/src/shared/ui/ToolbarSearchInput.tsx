import * as React from 'react';
import { X } from 'lucide-react';
import { useCultureT } from '../../core/culture/CultureContext';
import { cn } from '../../lib/utils';
import { UiInput } from './ai-field-assist/AiAssistInput';
import { NativeButton } from './NativeButton';
import { TOOLBAR_SEARCH_INPUT_HOST_CLASS } from './surfaceClasses';
import { PAGE_GUIDE_EN } from '../../core/culture/translations/pageGuideEn';
import { pageGuideLocalProps } from './shell/pageGuide/pageGuideChrome';

/** Typography-only overrides — height, radius, and border come from heroFieldChrome via UiInput. */
export const TOOLBAR_SEARCH_INPUT_CLASS =
  'font-medium text-slate-800 placeholder:text-slate-400';

export type ToolbarSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  autoComplete?: string;
  className?: string;
  inputClassName?: string;
  showClear?: boolean;
  disabled?: boolean;
};

export const ToolbarSearchInput: React.FC<ToolbarSearchInputProps> = ({
  value,
  onChange,
  placeholder,
  ariaLabel,
  autoComplete = 'off',
  className,
  inputClassName,
  showClear = true,
  disabled = false,
}) => {
  const t = useCultureT();
  const resolvedPlaceholder = placeholder ?? t('grid.searchEllipsis');
  const resolvedAriaLabel = ariaLabel ?? t('grid.search');

  return (
    <div
      className={cn(TOOLBAR_SEARCH_INPUT_HOST_CLASS, className)}
      {...pageGuideLocalProps(
        PAGE_GUIDE_EN['pageGuide.chrome.search.title'],
        PAGE_GUIDE_EN['pageGuide.chrome.search.hint'],
        20,
      )}
    >
      <UiInput
        aiAssist={false}
        size="sm"
        placeholder={resolvedPlaceholder}
        ariaLabel={resolvedAriaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        disabled={disabled}
        endContent={showClear && value && !disabled ? (
          <NativeButton
            type="button"
            onClick={() => onChange('')}
            className="flex h-5 w-5 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-indigo-700 outline-none transition-colors hover:text-cyan-700"
            aria-label={`Clear ${resolvedAriaLabel.toLowerCase()}`}
          >
            <X className="h-3 w-3" />
          </NativeButton>
        ) : undefined}
        endContentClassName="px-1.5"
        className={cn(TOOLBAR_SEARCH_INPUT_CLASS, inputClassName)}
      />
    </div>
  );
};
