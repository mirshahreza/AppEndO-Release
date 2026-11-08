import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useOptionalCulture } from '../../core/culture/CultureContext';
import { CULTURE_ACTION_FALLBACK_LABELS } from '../../core/culture/cultureShellKeys';
import { AppButton } from './AppButton';
import { PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS } from './surfaceClasses';
import { PAGE_GUIDE_EN } from '../../core/culture/translations/pageGuideEn';
import { pageGuideLocalProps } from './shell/pageGuide/pageGuideChrome';

export type ToolbarRefreshButtonProps = {
  onClick: () => void;
  isRefreshing?: boolean;
  disabled?: boolean;
  /** When false, omits the leading separator (e.g. refresh is the only action). */
  separatorBefore?: boolean;
};

export const ToolbarRefreshButton: React.FC<ToolbarRefreshButtonProps> = ({
  onClick,
  isRefreshing = false,
  disabled = false,
  separatorBefore = true,
}) => {
  const culture = useOptionalCulture();
  const ariaLabel = culture?.ready
    ? culture.t('actions.refresh')
    : CULTURE_ACTION_FALLBACK_LABELS['actions.refresh'];

  return (
    <>
      {separatorBefore ? (
        <span className={PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS} aria-hidden="true" />
      ) : null}
      <AppButton
        size="icon-md"
        intent="utility"
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
        <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
      </AppButton>
    </>
  );
};
