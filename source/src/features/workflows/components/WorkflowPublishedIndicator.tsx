import React from 'react';
import { BadgeCheck } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { ICON_ACTION_BUTTON_SM_CLASS } from '../../../shared/ui/surfaceClasses';
import { UiTooltip } from '../../../shared/ui/UiTooltip';

const PUBLISHED_TOOLTIP_CONTENT = (
  <>
    <p className="text-xs font-semibold leading-tight">Published</p>
    <p className="mt-0.5 text-[11px] font-normal leading-snug text-default-500">
      Live workflow — new instances can be started from this definition.
    </p>
  </>
);

export const WorkflowPublishedIndicator: React.FC<{ className?: string }> = ({ className }) => (
  <UiTooltip
    className={cn(
      ICON_ACTION_BUTTON_SM_CLASS,
      'shrink-0 cursor-default text-emerald-600 outline-none',
      className,
    )}
    aria-label="Published workflow"
    contentClassName="z-[9999] max-w-[15rem] px-3 py-2 text-start"
    content={PUBLISHED_TOOLTIP_CONTENT}
  >
    <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2.25} />
  </UiTooltip>
);
