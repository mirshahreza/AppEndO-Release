import * as React from 'react';
import { X } from 'lucide-react';
import { AppButton } from '../../../../shared/ui';
import {
  LIVE_DESIGNER_DOCK_HEADER_CLASS,
  LIVE_DESIGNER_DOCK_TITLE_CLASS,
} from '../../../../shared/ui/surfaceClasses';
import { cn } from '../../../../lib/utils';

export type LiveDesignerDockPanelHeaderProps = {
  title: string;
  titleIcon?: React.ReactNode;
  subtitle?: React.ReactNode;
  closeAriaLabel: string;
  onClose: () => void;
} & React.HTMLAttributes<HTMLDivElement>;

export const LiveDesignerDockPanelHeader: React.FC<LiveDesignerDockPanelHeaderProps> = ({
  title,
  titleIcon,
  subtitle,
  closeAriaLabel,
  onClose,
  className,
  ...rest
}) => (
  <div className={cn(LIVE_DESIGNER_DOCK_HEADER_CLASS, className)} {...rest}>
    <div className="min-w-0">
      <p className={LIVE_DESIGNER_DOCK_TITLE_CLASS} data-testid="live-designer-dock-panel-title">
        {titleIcon}
        {title}
      </p>
      {subtitle ? <div className="min-w-0">{subtitle}</div> : null}
    </div>
    <AppButton
      size="icon-md"
      intent="cancel"
      closeIcon
      aria-label={closeAriaLabel}
      onClick={onClose}
    >
      <X className="h-3.5 w-3.5" />
    </AppButton>
  </div>
);
