import * as React from 'react';
import { AppButton } from '../../../../shared/ui';
import { pageGuideLocalProps } from '../../../../shared/ui/shell/pageGuide/pageGuideChrome';
import {
  LIVE_DESIGNER_DOCK_TOGGLE_RAIL_CLASS,
  LIVE_DESIGNER_DOCK_TOGGLE_RAIL_LABEL_CLASS,
} from '../../../../shared/ui/surfaceClasses';
import { cn } from '../../../../lib/utils';
import {
  LIVE_DESIGNER_TOOLBOX_MINIMIZE_BESIDE_ATTR,
  LIVE_DESIGNER_TOOLBOX_RESTORE_BEFORE_ATTR,
} from './liveDesignerToolboxAnchor';

export type LiveDesignerDockToggleRailProps = {
  label: string;
  hint: string;
  open: boolean;
  onToggle: () => void;
  side: 'start' | 'end';
  className?: string;
};

export const LiveDesignerDockToggleRail: React.FC<LiveDesignerDockToggleRailProps> = ({
  label,
  hint,
  open,
  onToggle,
  side,
  className,
}) => (
  <AppButton
    type="button"
    size="sm"
    intent={open ? 'toggle-on' : 'toggle-off'}
    aria-pressed={open}
    aria-label={open ? `Hide ${label}` : `Show ${label}`}
    title={label}
    className={cn(
      LIVE_DESIGNER_DOCK_TOGGLE_RAIL_CLASS,
      side === 'start' ? 'border-e border-slate-200' : 'border-s border-slate-200',
      className,
    )}
    onClick={onToggle}
    {...pageGuideLocalProps(label, hint, 17)}
  >
    <span
      className={cn(
        LIVE_DESIGNER_DOCK_TOGGLE_RAIL_LABEL_CLASS,
        side === 'start' && 'rotate-180',
      )}
    >
      {label}
    </span>
  </AppButton>
);

export const LiveDesignerDockColumn: React.FC<{
  testId: string;
  children: React.ReactNode;
  /** Marks this dock as the left edge the minimized toolbox sits next to. */
  toolboxMinimizeBeside?: boolean;
  /** Marks this dock as the right edge the restored toolbox sits before. */
  toolboxRestoreBefore?: boolean;
}> = ({ testId, children, toolboxMinimizeBeside = false, toolboxRestoreBefore = false }) => (
  <div
    className="flex h-full min-h-0 shrink-0 items-stretch"
    data-testid={testId}
    {...(toolboxMinimizeBeside ? { [LIVE_DESIGNER_TOOLBOX_MINIMIZE_BESIDE_ATTR]: '' } : {})}
    {...(toolboxRestoreBefore ? { [LIVE_DESIGNER_TOOLBOX_RESTORE_BEFORE_ATTR]: '' } : {})}
  >
    {children}
  </div>
);
