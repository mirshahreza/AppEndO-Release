import * as React from 'react';
import { CirclePause, CirclePlay } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { AppButton } from '../AppButton';

export type ShellMotionControlProps = {
  paused: boolean;
  onPausedChange: (paused: boolean) => void;
  pauseLabel?: string;
  resumeLabel?: string;
  showLabel?: boolean;
  disabled?: boolean;
  className?: string;
};

export const ShellMotionControl: React.FC<ShellMotionControlProps> = ({
  paused,
  onPausedChange,
  pauseLabel = 'Pause decorative motion',
  resumeLabel = 'Resume decorative motion',
  showLabel = false,
  disabled = false,
  className,
}) => {
  const label = paused ? resumeLabel : pauseLabel;
  const Icon = paused ? CirclePlay : CirclePause;
  return (
    <AppButton
      aria-label={label}
      aria-pressed={paused}
      disabled={disabled}
      onClick={() => onPausedChange(!paused)}
      className={cn(
        'inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-medium px-2 text-sm font-semibold text-foreground hover:bg-content2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        className,
      )}
      data-shell-motion-control=""
    >
      <Icon aria-hidden className="h-3.5 w-3.5" />
      {showLabel ? <span>{paused ? 'Resume' : 'Pause'}</span> : null}
    </AppButton>
  );
};
