import React from 'react';
import { RefreshCw } from 'lucide-react';

import { useOptionalCulture } from '../../core/culture/CultureContext';
import { CULTURE_ACTION_FALLBACK_LABELS } from '../../core/culture/cultureShellKeys';
import { cn } from '../../lib/utils';
import { AppButton } from './AppButton';
import { PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS } from './surfaceClasses';
import { PAGE_GUIDE_EN } from '../../core/culture/translations/pageGuideEn';
import { pageGuideLocalProps } from './shell/pageGuide/pageGuideChrome';

export type ToolbarRefreshWithListCountProps = {
  count: number;
  onClick: () => void;
  isRefreshing?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
};

/** Single toolbar control: refresh + bold list total (Hawiety member lists). */
export const ToolbarRefreshWithListCount: React.FC<ToolbarRefreshWithListCountProps> = ({
  count,
  onClick,
  isRefreshing = false,
  disabled = false,
  separatorBefore = true,
}) => {
  const culture = useOptionalCulture();
  const refreshLabel = culture?.ready
    ? culture.t('actions.refresh')
    : CULTURE_ACTION_FALLBACK_LABELS['actions.refresh'];
  const safeCount = Math.max(0, Math.floor(count));
  const ariaLabel = `${refreshLabel} (${safeCount.toLocaleString()})`;

  return (
    <>
      {separatorBefore ? (
        <span className={PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS} aria-hidden="true" />
      ) : null}
      <AppButton
        type="button"
        size="sm"
        intent="utility"
        className={cn(
          'h-8 shrink-0 items-center gap-0 border border-slate-200 bg-slate-50 p-0',
          'text-slate-800 hover:bg-slate-100/90',
        )}
        aria-label={ariaLabel}
        title={ariaLabel}
        {...pageGuideLocalProps(
          PAGE_GUIDE_EN['pageGuide.chrome.refresh.title'],
          PAGE_GUIDE_EN['pageGuide.chrome.refresh.hint'],
          26,
        )}
        onClick={onClick}
        disabled={disabled || isRefreshing}
      >
        <span className="inline-flex items-center px-2">
          <RefreshCw
            className={cn('h-3.5 w-3.5 shrink-0', isRefreshing ? 'animate-spin' : '')}
            aria-hidden
          />
        </span>
        <span
          className="h-5 w-px shrink-0 bg-slate-200"
          aria-hidden="true"
        />
        <span
          className="inline-flex min-w-[2.75rem] items-center justify-center px-2.5 text-sm font-bold tabular-nums"
          aria-live="polite"
        >
          {safeCount.toLocaleString()}
        </span>
      </AppButton>
    </>
  );
};
