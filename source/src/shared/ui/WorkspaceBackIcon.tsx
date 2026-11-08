import * as React from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ICON_ACTION_BUTTON_MD_CLASS, ICON_ACTION_CANCEL_CLASS } from './surfaceClasses';
import { PAGE_GUIDE_EN } from '../../core/culture/translations/pageGuideEn';
import { pageGuideLocalProps } from './shell/pageGuide/pageGuideChrome';

export type WorkspaceBackIconProps = {
  onClick: React.MouseEventHandler<HTMLButtonElement>;
  ariaLabel: string;
  title?: string;
  className?: string;
};

/** Ghost back control for development workspace toolbars — icon-only, no AppButton chrome. */
export const WorkspaceBackIcon: React.FC<WorkspaceBackIconProps> = ({
  onClick,
  ariaLabel,
  title,
  className,
}) => (
  <button
    type="button"
    className={cn(
      ICON_ACTION_BUTTON_MD_CLASS,
      ICON_ACTION_CANCEL_CLASS,
      'h-8 w-8 shrink-0',
      className,
    )}
    aria-label={ariaLabel}
    title={title ?? ariaLabel}
    {...pageGuideLocalProps(
      PAGE_GUIDE_EN['pageGuide.chrome.workspaceBack.title'],
      PAGE_GUIDE_EN['pageGuide.chrome.workspaceBack.hint'],
      14,
    )}
    onClick={onClick}
  >
    <ArrowLeft className="h-6 w-6 rtl:rotate-180" strokeWidth={2} />
  </button>
);
