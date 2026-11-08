import * as React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { PAGE_GUIDE_EN } from '../../core/culture/translations/pageGuideEn';
import { pageGuideLocalProps } from './shell/pageGuide/pageGuideChrome';
import { UiInput } from './ai-field-assist/AiAssistInput';
import {
  APP_SEARCH_BOX_BAR_CLASS,
  APP_SEARCH_BOX_CLEAR_BUTTON_CLASS,
  APP_SEARCH_BOX_ICON_CLASS,
  APP_SEARCH_BOX_INPUT_CLASS,
} from './surfaceClasses';

export type AppSearchBoxProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  autoComplete?: string;
  className?: string;
  /** Optional leading control (e.g. built-in toggle) rendered before the search icon. */
  leading?: React.ReactNode;
  /** Optional trailing control (e.g. a compact action) rendered after the input. */
  trailing?: React.ReactNode;
  disabled?: boolean;
  showClear?: boolean;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
};

export const AppSearchBox: React.FC<AppSearchBoxProps> = ({
  value,
  onChange,
  placeholder = '…',
  ariaLabel = 'Search',
  autoComplete = 'off',
  className,
  leading,
  trailing,
  disabled = false,
  showClear = true,
  onKeyDown,
}) => (
  <div
    className={cn(APP_SEARCH_BOX_BAR_CLASS, className)}
    data-studio-chrome-search=""
    {...pageGuideLocalProps(
      PAGE_GUIDE_EN['pageGuide.chrome.search.title'],
      PAGE_GUIDE_EN['pageGuide.chrome.search.hint'],
      22,
    )}
  >
    {leading}
    <Search className={APP_SEARCH_BOX_ICON_CLASS} aria-hidden />
    <div className="relative min-w-0 flex-1">
      <UiInput
        aiAssist={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        ariaLabel={ariaLabel}
        autoComplete={autoComplete}
        disabled={disabled}
        onKeyDown={onKeyDown}
        className={cn(
          'app-search-box-input appearance-none',
          APP_SEARCH_BOX_INPUT_CLASS,
          '!bg-transparent hover:!bg-transparent data-[hover=true]:!bg-transparent',
        )}
      />
      {showClear && value && !disabled ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className={cn(APP_SEARCH_BOX_CLEAR_BUTTON_CLASS, 'end-0')}
          aria-label={`Clear ${ariaLabel}`}
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </div>
    {trailing}
  </div>
);
