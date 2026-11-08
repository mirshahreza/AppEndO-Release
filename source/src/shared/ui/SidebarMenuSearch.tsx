import * as React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { PAGE_GUIDE_EN } from '../../core/culture/translations/pageGuideEn';
import { pageGuideChromeProps } from './shell/pageGuide/pageGuideChrome';
import { UiInput } from './ai-field-assist/AiAssistInput';
import { NativeButton } from './NativeButton';
import {
  SIDEBAR_MENU_SEARCH_ADDON_CLASS,
  SIDEBAR_MENU_SEARCH_CLEAR_CLASS,
  SIDEBAR_MENU_SEARCH_HOST_CLASS,
  SIDEBAR_MENU_SEARCH_INPUT_CLASS,
} from './surfaceClasses';

export type SidebarMenuSearchProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
};

export const SidebarMenuSearch: React.FC<SidebarMenuSearchProps> = ({
  value,
  onChange,
  placeholder = 'Search',
  ariaLabel = 'Search menu',
  className,
}) => (
  <div
    className={cn(SIDEBAR_MENU_SEARCH_HOST_CLASS, className)}
    data-sidebar-menu-search=""
    {...pageGuideChromeProps((key) => PAGE_GUIDE_EN[key] ?? key, 'sidebarSearch', 83)}
  >
    <span className={SIDEBAR_MENU_SEARCH_ADDON_CLASS} aria-hidden>
      <Search className="h-3.5 w-3.5" />
    </span>
    <div className="flex min-h-0 min-w-0 flex-1 items-center [&>div]:contents">
      <UiInput
        aiAssist={false}
        nested
        size="xs"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && value) {
            event.preventDefault();
            onChange('');
          }
        }}
        placeholder={placeholder}
        ariaLabel={ariaLabel}
        autoComplete="off"
        className={SIDEBAR_MENU_SEARCH_INPUT_CLASS}
      />
    </div>
    {value ? (
      <NativeButton
        type="button"
        onClick={() => onChange('')}
        className={SIDEBAR_MENU_SEARCH_CLEAR_CLASS}
        aria-label={`Clear ${ariaLabel.toLowerCase()}`}
      >
        <X className="h-3 w-3" />
      </NativeButton>
    ) : null}
  </div>
);
