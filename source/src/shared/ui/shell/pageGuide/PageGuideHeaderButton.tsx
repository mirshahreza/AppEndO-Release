import React from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { useOptionalCultureT } from '../../../../core/culture/CultureContext';
import { useViewportTier } from '../../../lib/useViewportTier';
import { HeaderHintTooltip } from '../../SideHintTooltip';
import { PAGE_GUIDE_IGNORE_ATTR } from './pageGuide.attrs';
import { PAGE_GUIDE_COMPANION_WIDTH_PX } from './pageGuide.types';
import { togglePageGuide, usePageGuideActive } from './pageGuideStore';
import { ADMIN_SHELL_HEADER_ICON_BUTTON_CLASS } from '../../surfaceClasses';

const originFromTrigger = (rect: DOMRect) => ({
  x: rect.left + rect.width / 2 - PAGE_GUIDE_COMPANION_WIDTH_PX / 2,
  y: rect.bottom + 8,
});

export const PageGuideHeaderButton: React.FC = () => {
  const t = useOptionalCultureT();
  const viewportTier = useViewportTier();
  const pageGuideActive = usePageGuideActive();

  if (viewportTier === 'phone') {
    return null;
  }

  const label = t('pageGuide.tourGuide');
  const hint = t('pageGuide.tourGuide.hint');

  return (
    <HeaderHintTooltip title={label} hint={hint} tone="indigo">
      <button
        type="button"
        data-testid="page-guide-trigger"
        {...{ [PAGE_GUIDE_IGNORE_ATTR]: '' }}
        className={cn(
          ADMIN_SHELL_HEADER_ICON_BUTTON_CLASS,
          pageGuideActive && 'relative z-[410] bg-primary-subtle/50 [&_svg]:stroke-[2.25]',
        )}
        aria-label={label}
        aria-pressed={pageGuideActive}
        onClick={(event) => {
          togglePageGuide(originFromTrigger(event.currentTarget.getBoundingClientRect()));
        }}
      >
        <Sparkles className="h-5 w-5" aria-hidden />
      </button>
    </HeaderHintTooltip>
  );
};
